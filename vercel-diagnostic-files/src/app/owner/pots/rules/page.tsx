import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildRulesView } from "@/server/modules/pots/views";
import { publishRuleAction } from "@/server/modules/pots/rule-actions";
import { formatINR } from "@/server/modules/pots/money";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, { text: string; ok?: boolean }> = {
  published: { text: "New rule version published. Past allocations are unchanged; it applies from its effective date.", ok: true },
  forbidden: { text: "Only the owner can change allocation rules." },
  "step-up-required": { text: "PIN verification is required to change allocation rules." },
  "invalid-rule-key": { text: "Rule name must be lowercase letters, numbers or dashes." },
  "invalid-method": { text: "Choose a valid method." },
  "invalid-pot": { text: "Choose a valid Pot." },
  "invalid-value": { text: "Enter a valid value (numbers only, up to 2 decimals)." },
  "invalid-cap-floor": { text: "Cap and floor must be valid amounts." },
  "invalid-priority": { text: "Priority must be a whole number (lower runs first)." },
  "invalid-date": { text: "Enter a valid effective date." },
  "reason-required": { text: "A reason is required for every rule change." },
};

const inputCls = "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--radium-green)]";
const labelCls = "block text-xs font-medium uppercase tracking-wider text-zinc-400";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ notice?: string; edit?: string }> }) {
  const { notice, edit } = await searchParams;
  const v = buildRulesView(getPotsRuntime());
  const editing = edit ? v.rules.find((r) => r.rule.ruleKey === edit)?.rule : undefined;
  const n = notice ? NOTICES[notice] ?? (notice.startsWith("rule-error:") ? { text: notice.slice(11) } : undefined) : undefined;
  const pctOrRupees = (m: string, val: number) => (m === "PERCENTAGE" ? String(val / 100) : m === "REMAINING" ? "" : String(val / 100));

  return (
    <div className="space-y-6">
      <Link href="/owner/pots" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Back to Pots
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Allocation rules</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Rules decide how each settled payment is split across Pots. There are no default percentages — you set them.
          Every change creates a new version; earlier payments keep the version they were allocated with. GST treatment must be set to match your accountant&apos;s advice.
        </p>
      </div>

      {n && <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${n.ok ? "border-[var(--radium-green)]/30 text-[var(--radium-green)]" : "border-red-500/30 text-red-400"}`}>{n.text}</p>}

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Current rules</h2>
        {v.rules.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No rules yet. Settled payments stay unallocated until you add one.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="text-zinc-500"><tr><th className="py-2 pr-4">Priority</th><th className="pr-4">Rule</th><th className="pr-4">Pot</th><th className="pr-4">Method / value</th><th className="pr-4">Cap / floor</th><th className="pr-4">Version</th><th className="pr-4">State</th><th /></tr></thead>
              <tbody>
                {v.rules.map(({ rule: r, active, potName, summary }) => (
                  <tr key={r.id} className="border-t border-zinc-900">
                    <td className="py-2 pr-4">{r.priority}</td>
                    <td className="pr-4 text-zinc-200">{r.ruleKey}</td>
                    <td className="pr-4">{potName}</td>
                    <td className="pr-4">{summary}</td>
                    <td className="pr-4">{r.cap != null ? formatINR(r.cap) : "—"} / {r.floor != null ? formatINR(r.floor) : "—"}</td>
                    <td className="pr-4">v{r.version} ({v.versionsByKey[r.ruleKey] ?? 1} total)</td>
                    <td className="pr-4">{active ? "Active" : r.enabled ? "Not in effect now" : "Disabled"}</td>
                    <td><Link className="text-[var(--radium-green)] underline" href={`/owner/pots/rules?edit=${encodeURIComponent(r.ruleKey)}`}>New version</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">{editing ? `Publish new version of “${editing.ruleKey}”` : "Add a rule"}</h2>
        <p className="mt-1 text-xs text-zinc-500">High-risk action: requires your verified PIN session and a reason, and is written to the audit log.</p>
        <form action={publishRuleAction} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className={labelCls} htmlFor="ruleKey">Rule name</label>
            <input id="ruleKey" name="ruleKey" required defaultValue={editing?.ruleKey ?? ""} readOnly={!!editing} className={inputCls} placeholder="e.g. inventory" /></div>
          <div><label className={labelCls} htmlFor="potId">Pot</label>
            <select id="potId" name="potId" defaultValue={editing?.potId} className={inputCls}>{v.pots.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}</select></div>
          <div><label className={labelCls} htmlFor="method">Method</label>
            <select id="method" name="method" defaultValue={editing?.method ?? "PERCENTAGE"} className={inputCls}>
              <option value="PERCENTAGE">Percentage of eligible payment</option><option value="FIXED">Fixed amount per payment</option>
              <option value="MONTHLY_TARGET">Monthly target</option><option value="REMAINING">Remaining balance</option>
            </select></div>
          <div><label className={labelCls} htmlFor="value">Value (% for percentage, ₹ otherwise; blank for remaining)</label>
            <input id="value" name="value" inputMode="decimal" defaultValue={editing ? pctOrRupees(editing.method, editing.value) : ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="priority">Priority (lower runs first)</label>
            <input id="priority" name="priority" inputMode="numeric" required defaultValue={editing?.priority ?? 10} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="effectiveFrom">Effective from (IST, blank = now)</label>
            <input id="effectiveFrom" name="effectiveFrom" type="date" className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="capRupees">Cap per payment (₹, optional)</label>
            <input id="capRupees" name="capRupees" inputMode="decimal" defaultValue={editing?.cap != null ? String(editing.cap / 100) : ""} className={inputCls} /></div>
          <div><label className={labelCls} htmlFor="floorRupees">Floor per payment (₹, optional)</label>
            <input id="floorRupees" name="floorRupees" inputMode="decimal" defaultValue={editing?.floor != null ? String(editing.floor / 100) : ""} className={inputCls} /></div>
          <div className="sm:col-span-2"><label className={labelCls} htmlFor="reason">Reason for this change</label>
            <input id="reason" name="reason" required className={inputCls} placeholder="Why are you changing this rule?" /></div>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="enabled" defaultChecked={editing ? editing.enabled : true} /> Enabled</label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="rounded-lg bg-[var(--radium-green)] px-4 py-2 text-sm font-medium text-black">Publish version</button>
          </div>
        </form>
      </section>
    </div>
  );
}
