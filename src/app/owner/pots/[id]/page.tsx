import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildPotView, describeRuleValue, STATUS_LABEL } from "@/server/modules/pots/views";
import { formatINR } from "@/server/modules/pots/money";
import { DEMO_BUSINESS_ID } from "@/server/modules/pots/runtime";
import { movePotAction } from "@/server/modules/pots/money-actions";
import { Notice, Field, inputCls, btnCls, btnMuted } from "../_components/ui";

export const dynamic = "force-dynamic";

// params is a Promise on Next 15+. On older Next, drop the `await`.
export default async function FinancialPotDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  const { notice } = await searchParams;
  const rt = getPotsRuntime();
  const v = buildPotView(rt, id);
  if (!v) notFound();
  const { card } = v;

  return (
    <div className="space-y-6">
      <Link href="/owner/pots" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Back to Pots
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">{card.pot.name} Pot</h1>
          <p className="text-sm text-zinc-400">Virtual ledger balance (sandbox, simulated) — every figure below comes from ledger entries.</p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">{STATUS_LABEL[card.status]}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Current balance</p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--radium-green)]">{formatINR(card.balance)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Allocated this month</p>
          <p className="mt-2 text-2xl font-extrabold text-zinc-100">{formatINR(card.allocatedThisMonth)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-400">Monthly target</p>
          <p className="mt-2 text-2xl font-extrabold text-zinc-100">{card.targetPaise !== undefined ? formatINR(card.targetPaise) : "—"}</p>
          {card.progressPercent !== undefined && <p className="mt-1 text-xs text-zinc-500">{card.progressPercent}% reached</p>}
        </div>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Active rules</h2>
          <Link href="/owner/pots/rules" className="text-xs text-[var(--radium-green)] underline">Manage rules</Link>
        </div>
        {v.activeRules.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No active rule feeds this Pot, so it only changes through other ledger movements.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {v.activeRules.map((r) => (
              <li key={r.id}><span className="font-medium">{r.ruleKey}</span> v{r.version} · {describeRuleValue(r)} · priority {r.priority}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-200">Why this balance? Transaction history</h2>
        {v.transactions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No ledger movements yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="text-zinc-500">
                <tr><th className="py-2 pr-4">When</th><th className="pr-4">What</th><th className="pr-4">Source</th><th className="pr-4">Rule</th><th className="pr-4 text-right">Amount</th><th className="text-right">Balance after</th></tr>
              </thead>
              <tbody>
                {v.transactions.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-900">
                    <td className="py-2 pr-4 whitespace-nowrap">{t.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                    <td className="pr-4 text-zinc-200">{t.label}{t.reason ? ` — ${t.reason}` : ""}</td>
                    <td className="pr-4">{t.sourceId}</td>
                    <td className="pr-4">{t.ruleId ? `${t.ruleId.split(":").slice(-2, -1)[0] ?? t.ruleId} v${t.ruleVersion}` : "—"}</td>
                    <td className={`pr-4 text-right ${t.amount < 0 ? "text-red-400" : "text-[var(--radium-green)]"}`}>{t.amount < 0 ? "-" : "+"}{formatINR(Math.abs(t.amount))}</td>
                    <td className="text-right text-zinc-200">{formatINR(t.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Notice code={notice} />
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="mb-1 text-sm font-semibold text-zinc-200">Reserve, transfer and pay out</h2>
        <p className="mb-4 text-xs text-zinc-500">Owner only, step-up and a reason are required. Available to move: {formatINR(rt.payouts.getAvailable(DEMO_BUSINESS_ID, card.pot.id))}. Sandbox: payouts are simulated.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <form action={movePotAction} className="space-y-3">
            <input type="hidden" name="potId" value={card.pot.id} /><input type="hidden" name="mode" value="reserve" />
            <p className="text-xs font-medium text-zinc-300">Reserve from unallocated money into this Pot</p>
            <Field label="Amount (₹)"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
            <Field label="Reason"><input name="reason" required className={inputCls} /></Field>
            <button className={btnCls}>Reserve</button>
          </form>
          <form action={movePotAction} className="space-y-3">
            <input type="hidden" name="potId" value={card.pot.id} /><input type="hidden" name="mode" value="transfer" />
            <p className="text-xs font-medium text-zinc-300">Transfer out of this Pot</p>
            <Field label="To"><select name="to" className={inputCls}><option value="UNALLOCATED">Unallocated</option>{rt.pots.filter((p) => p.id !== card.pot.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Amount (₹)"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
            <Field label="Reason"><input name="reason" required className={inputCls} /></Field>
            <button className={btnMuted}>Transfer</button>
          </form>
        </div>
        <p className="mt-4 text-xs text-zinc-500">To pay money out: <Link className="text-[var(--radium-green)] underline" href="/owner/pots/suppliers">Supplier payment</Link> · <Link className="text-[var(--radium-green)] underline" href="/owner/pots/salary">Salary</Link> · <Link className="text-[var(--radium-green)] underline" href="/owner/pots/profit">Profit withdrawal</Link> · <Link className="text-[var(--radium-green)] underline" href="/owner/pots/approvals">Approvals</Link></p>
      </section>
    </div>
  );
}
