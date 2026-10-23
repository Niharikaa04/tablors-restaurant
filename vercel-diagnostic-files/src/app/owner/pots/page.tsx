import Link from "next/link";
import { Receipt, Users, Package, Wrench, RefreshCw, Percent, Wallet, Box, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildDashboard, STATUS_LABEL, type PotStatus } from "@/server/modules/pots/views";
import { formatINR } from "@/server/modules/pots/money";

const iconByType: Record<string, LucideIcon> = {
  GST: Receipt, SALARY: Users, INVENTORY: Package, MAINTENANCE: Wrench,
  SUBSCRIPTIONS: RefreshCw, SERVICE_CHARGES: Percent, OWNER_PROFIT: Wallet,
};
const statusClass: Record<PotStatus, string> = {
  NO_RULE: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  COLLECTING: "text-[var(--radium-green)] bg-[var(--radium-green)]/10 border-[var(--radium-green)]/30",
  TARGET_MET: "text-sky-400 bg-sky-500/10 border-sky-500/30",
};

export const dynamic = "force-dynamic"; // ledger is live in-memory state

export default function FinancialPotsPage() {
  const d = buildDashboard(getPotsRuntime());
  const summary = [
    { label: "Total settled balance", value: d.totals.totalSettledBalance },
    { label: "Collected today", value: d.totals.collectedToday },
    { label: "Allocated to pots", value: d.totals.allocatedToPots },
    { label: "Unallocated", value: d.totals.unallocated },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Business Pots</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Pots are virtual ledger allocations of your settled sales — not separate bank accounts.
            Sandbox mode: payments are simulated and reset when the server restarts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link href="/owner/pots/transactions" className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700">
          Transactions
        </Link>
        <Link href="/owner/pots/rules" className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700">
          <SlidersHorizontal className="h-4 w-4" /> Allocation rules
        </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-400">{s.label}</p>
            <p className="mt-2 text-xl font-extrabold text-zinc-100">{formatINR(s.value)}</p>
          </div>
        ))}
      </div>

      <p className={`text-xs ${d.reconciliation.ok ? "text-zinc-500" : "text-red-400"}`}>
        {d.reconciliation.ok
          ? "Ledger reconciled: Pots + unallocated = settled balance."
          : "Reconciliation mismatch — review the ledger before trusting these figures."}
      </p>

      {!d.hasAnyRule && (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
          No allocation rules are configured yet, so settled payments stay <span className="text-zinc-200">unallocated</span>.
          Set your own rules (percentage, fixed, monthly target or remaining-to-profit) on the{" "}
          <Link href="/owner/pots/rules" className="text-[var(--radium-green)] underline">Rules</Link> screen.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {d.cards.map((c) => {
          const Icon = iconByType[c.pot.type] ?? Box;
          const profit = c.pot.type === "OWNER_PROFIT";
          return (
            <Link key={c.pot.id} href={`/owner/pots/${c.slug}`} className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition-all duration-200 hover:border-zinc-700">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{c.pot.name}</p>
                <div className="rounded-lg bg-zinc-900 p-2 text-zinc-400 transition-colors group-hover:text-[var(--radium-green)]"><Icon className="h-4 w-4" /></div>
              </div>
              <p className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-100">{formatINR(c.balance)}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{profit ? "Profit balance (withdrawal needs owner approval)" : "Current balance"}</p>

              {c.targetPaise !== undefined && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Monthly target</span><span className="text-zinc-200">{formatINR(c.targetPaise)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Allocated this month</span><span className="text-zinc-200">{formatINR(c.allocatedThisMonth)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div className="h-full rounded-full bg-[var(--radium-green)]" style={{ width: `${c.progressPercent ?? 0}%` }} />
                  </div>
                  <p className="text-right text-[11px] text-zinc-500">{c.progressPercent ?? 0}% of target</p>
                </div>
              )}

              <span className={`mt-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusClass[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </Link>
          );
        })}
      </div>

      {(d.alerts.length > 0 || d.exceptions.length > 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Recent alerts</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {d.exceptions.map((e, i) => (<li key={`x${i}`} className="text-amber-400">Reconciliation: {e.code} — {e.detail}</li>))}
            {d.alerts.map((a, i) => (<li key={`a${i}`}>{a.message}</li>))}
          </ul>
        </div>
      )}
    </div>
  );
}
