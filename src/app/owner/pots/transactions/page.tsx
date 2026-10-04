import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildTransactionsView, type TransactionFilter } from "@/server/modules/pots/views";
import { formatINR } from "@/server/modules/pots/money";

export const dynamic = "force-dynamic";

const FILTERS: { key: TransactionFilter; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "PAYMENTS", label: "Payments" }, { key: "ALLOCATIONS", label: "Allocations" },
  { key: "REFUNDS", label: "Refunds & reversals" }, { key: "PAYOUTS", label: "Payouts & transfers" },
];

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = (FILTERS.find((x) => x.key === f)?.key ?? "ALL") as TransactionFilter;
  const v = buildTransactionsView(getPotsRuntime(), filter);
  return (
    <div className="space-y-6">
      <Link href="/owner/pots" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200">
        <ArrowLeft className="h-4 w-4" /> Back to Pots
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Transactions</h1>
        <p className="mt-1 text-sm text-zinc-400">Every ledger movement, never edited — corrections appear as new reversal rows. Sandbox: payments are simulated.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/owner/pots/transactions?f=${x.key}`} className={`rounded-full border px-3 py-1 text-xs ${x.key === filter ? "border-[var(--radium-green)]/40 text-[var(--radium-green)]" : "border-zinc-800 text-zinc-400"}`}>{x.label}</Link>
        ))}
      </div>
      <p className={`text-xs ${v.reconciliation.ok ? "text-zinc-500" : "text-red-400"}`}>{v.reconciliation.ok ? "Ledger reconciled." : "Reconciliation mismatch — review before trusting these figures."}</p>
      <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        {v.rows.length === 0 ? <p className="text-sm text-zinc-400">No transactions yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-400">
              <thead className="text-zinc-500"><tr><th className="py-2 pr-4">When</th><th className="pr-4">What</th><th className="pr-4">Account</th><th className="pr-4">Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {v.rows.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-900">
                    <td className="py-2 pr-4 whitespace-nowrap">{t.at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                    <td className="pr-4 text-zinc-200">{t.label}{t.reason ? ` — ${t.reason}` : ""}</td>
                    <td className="pr-4">{t.account}</td>
                    <td className="pr-4">{t.sourceId}</td>
                    <td className={`text-right ${t.amount < 0 ? "text-red-400" : "text-[var(--radium-green)]"}`}>{t.amount < 0 ? "-" : "+"}{formatINR(Math.abs(t.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
