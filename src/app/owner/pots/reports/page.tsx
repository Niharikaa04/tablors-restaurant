import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildReports } from "@/server/modules/pots/reports";
import { getLoyaltyRuntime, loyaltySummary } from "@/server/modules/financial-pots/loyalty-runtime";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Section, when } from "../_components/ui";

export const dynamic = "force-dynamic";

function T({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-400">No data yet.</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full text-left text-xs text-zinc-400"><thead className="text-zinc-500"><tr>{head.map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i} className="border-t border-zinc-900">{row.map((c, j) => <td key={j} className="py-2 pr-4">{c}</td>)}</tr>)}</tbody></table></div>
  );
}
export default function ReportsPage() {
  const rt = getPotsRuntime(); const r = buildReports(rt); const l = loyaltySummary(getLoyaltyRuntime(), "demo-business");
  
    <div className="space-y-6">
      <Back /><Header title="Reports" sub="Derived from the ledger, payouts, payroll and audit log. Sandbox data." />
      <Section title="Reconciliation"><p className={r.reconciliation.ok ? "text-sm text-[var(--radium-green)]" : "text-sm text-red-400"}>{r.reconciliation.ok ? "Ledger reconciles: Pots + unallocated = merchant funds." : "Mismatch — investigate."}</p>
        <p className="text-xs text-zinc-500">{r.providerFees}</p>{r.reconciliation.exceptions.length ? <p className="text-xs text-amber-400">{r.reconciliation.exceptions.length} open exception(s)</p> : null}</Section>
      <Section title="Daily sales & collections"><T head={["Day", "Collected", "Refunds"]} rows={r.dailySales.map((d) => [d.day, formatINR(d.amount), formatINR(d.refunds)])} /></Section>
      <Section title="Pot balance & movement"><T head={["Pot", "Balance", "Allocated in", "Reversals", "Paid out", "Transfers / adjustments"]} rows={r.potMovement.map((p) => [p.pot, formatINR(p.balance), formatINR(p.inflow), formatINR(p.reversals), formatINR(p.payouts), formatINR(p.adjustments)])} /></Section>
      <Section title="Allocation by payment"><T head={["Payment", "When", "Split"]} rows={r.allocationByPayment.slice(0, 20).map((a) => [a.payment, when(a.at), Object.entries(a.lines).map(([k, v]) => `${k} ${formatINR(v)}`).join(" · ")])} /></Section>
      <Section title="Payroll & attendance adjustments"><T head={["Period", "Status", "Original", "Paid", "Adjustments"]} rows={r.payroll.map((p) => [p.period, p.status, formatINR(p.original), formatINR(p.final), p.adjustments.map((a) => `${a.name}: ${formatINR(a.from)}→${formatINR(a.to)} (${a.reason})`).join("; ") || "—"])} /></Section>
      <Section title="Supplier spend"><T head={["Payout", "To", "Invoice", "Amount"]} rows={r.supplierSpend.map((s) => [s.id, s.to, s.invoice, formatINR(s.amount)])} /></Section>
      <Section title="Tax reserve by period"><T head={["Month", "Reserved"]} rows={r.taxReserveByMonth.map((t) => [t.month, formatINR(t.amount)])} /></Section>
      <Section title="Service charges">{r.serviceCharges ? <p className="text-sm text-zinc-300">Balance {formatINR(r.serviceCharges.balance)} · allocated in {formatINR(r.serviceCharges.inflow)}</p> : <p className="text-sm text-zinc-400">No Service Charges Pot.</p>}</Section>
      <Section title="Owner profit withdrawals"><T head={["Payout", "Amount", "Fee"]} rows={r.profitWithdrawals.map((p) => [p.id, formatINR(p.amount), formatINR(p.fee)])} /></Section>
      <Section title="Loyalty"><p className="text-sm text-zinc-300">Members {l.totalMembers} (new this month {l.newThisMonth}, active {l.activeThisMonth}) · issued {l.issued} · redeemed {l.redeemed} · expired {l.expired} · outstanding {l.outstanding} points</p></Section>
      <Section title="Audit trail (latest)"><T head={["When", "Actor", "Action", "Entity"]} rows={r.auditTrail.map((a) => [when(a.at), a.actorId, a.action, a.entityId])} /></Section>
    </div>

}
