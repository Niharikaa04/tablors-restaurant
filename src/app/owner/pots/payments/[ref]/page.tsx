import { notFound } from "next/navigation";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildPaymentResult } from "@/server/modules/pots/reports";
import { getLoyaltyRuntime } from "@/server/modules/financial-pots/loyalty-runtime";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Section, statusCls } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function PaymentResultPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params; const v = buildPaymentResult(getPotsRuntime(), decodeURIComponent(ref)); if (!v) notFound();
  const lr = getLoyaltyRuntime(); const link = lr.links.get(v.providerRef);
  const pts = link ? lr.ledger.ledger(link.businessId, link.customerId).filter((t) => t.type === "EARN" && t.sourceId === link.billId).reduce((a, t) => a + t.points, 0) : 0;
  return (
    <div className="space-y-6">
      <Back /><Header title="Payment result" sub="Sandbox: simulated payment." />
      <Section title={v.status}><p className={`text-lg ${statusCls(v.status)}`}>{v.status}</p>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-4"><div><dt className="text-xs text-zinc-500">Amount</dt><dd className="text-zinc-100">{formatINR(v.amount)}</dd></div><div><dt className="text-xs text-zinc-500">Provider ref</dt><dd className="text-zinc-300">{v.providerRef}</dd></div><div><dt className="text-xs text-zinc-500">Bill</dt><dd className="text-zinc-300">{v.billId}</dd></div><div><dt className="text-xs text-zinc-500">Allocation</dt><dd className="text-zinc-300">{v.allocationStatus}</dd></div></dl></Section>
      {v.lines.length ? <Section title="Pot allocation">{v.lines.map((l) => <p key={l.pot + l.rule} className="border-t border-zinc-900 py-2 text-sm text-zinc-300 first:border-0">{l.pot} · {formatINR(l.amount)} <span className="text-xs text-zinc-500">({l.rule})</span></p>)}{v.unallocated ? <p className="text-xs text-amber-400">Unallocated {formatINR(v.unallocated)}</p> : null}</Section> : null}
      <Section title="Loyalty">{pts ? <p className="text-sm text-[var(--radium-green)]">{pts} points earned (separate from money).</p> : <p className="text-sm text-zinc-400">No points for this payment.</p>}</Section>
    </div>
  );
}
