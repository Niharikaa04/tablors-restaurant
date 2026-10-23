import { getPotsRuntime, DEMO_BUSINESS_ID as B } from "@/server/modules/pots/runtime";
import { approvePayoutAction, cancelPayoutAction, executePayoutAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Section, btnCls, btnMuted, statusCls, when } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams; const rt = getPotsRuntime();
  const pending = rt.payouts.pending(B); const recent = rt.payouts.list(B).filter((p) => p.status === "SUCCESS" || p.status === "FAILED" || p.status === "CANCELLED").slice(0, 10);
  const name = (id: string) => rt.pots.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="space-y-6">
      <Back /><Header title="Authorization" sub="Approve or cancel payouts. High-risk items need step-up (your Pots PIN session). Sandbox: you choose the simulated provider result." />
      <Notice code={notice} />
      <Section title="Waiting for action">
        {pending.length === 0 ? <p className="text-sm text-zinc-400">Nothing pending.</p> : pending.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-900 py-3 first:border-0">
            <div className="text-sm"><p className="text-zinc-200">{p.kind} · {formatINR(p.amount)} from {name(p.potId)}{p.highRisk ? <span className="ml-2 text-xs text-amber-400">HIGH RISK</span> : null}</p>
              <p className="text-xs text-zinc-500">To {p.maskedRef}{p.invoiceRef ? ` · invoice ${p.invoiceRef}` : ""} · requested by {p.requestedBy}, {when(p.createdAt)} · <span className={statusCls(p.status)}>{p.status}</span></p></div>
            <div className="flex gap-2">
              {p.status === "PENDING_APPROVAL" ? <form action={approvePayoutAction}><input type="hidden" name="payoutId" value={p.id} /><button className={btnCls}>Approve</button></form> : (<>
                <form action={executePayoutAction}><input type="hidden" name="payoutId" value={p.id} /><input type="hidden" name="outcome" value="SUCCESS" /><button className={btnCls}>Pay (simulate success)</button></form>
                <form action={executePayoutAction}><input type="hidden" name="payoutId" value={p.id} /><input type="hidden" name="outcome" value="FAILED" /><button className={btnMuted}>Simulate failure</button></form></>)}
              <form action={cancelPayoutAction}><input type="hidden" name="payoutId" value={p.id} /><button className={btnMuted}>Cancel</button></form>
            </div>
          </div>))}
      </Section>
      <Section title="Recently completed">
        {recent.map((p) => <p key={p.id} className="border-t border-zinc-900 py-2 text-xs text-zinc-400 first:border-0">{when(p.createdAt)} · {p.kind} · {formatINR(p.amount)} · {p.maskedRef} · <span className={statusCls(p.status)}>{p.status}</span>{p.failureReason ? ` — ${p.failureReason}` : ""}</p>)}
      </Section>
    </div>
  );
}
