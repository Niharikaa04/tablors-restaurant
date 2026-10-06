import { notFound } from "next/navigation";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { adjustPayrollItemAction, approvePayrollAction, executePayrollAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Section, inputCls, btnCls, btnMuted, statusCls, when } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function SalaryReviewPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { runId } = await params; const { notice } = await searchParams; const rt = getPotsRuntime();
  let r; try { r = rt.payroll.review(runId); } catch { notFound(); }
  const run = r.run; const draft = run.status === "DRAFT";
  return (
    <div className="space-y-6">
      <Back href="/owner/pots/salary" label="Back to Salary" />
      <Header title={`Salary review — ${run.period}`} sub="Original and edited amounts side by side. Originals are never overwritten." />
      <Notice code={notice} />
      <Section title={`Status: ${run.status}`}>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs text-zinc-400">
          <thead className="text-zinc-500"><tr><th className="py-2">Employee</th><th>Payout to</th><th className="text-right">Original</th><th className="text-right">Final</th><th className="pl-4">Reason</th><th>Payout</th></tr></thead>
          <tbody>{run.items.map((it) => (
            <tr key={it.employeeId} className="border-t border-zinc-900 align-top">
              <td className="py-2 text-zinc-200">{it.name}</td><td>{it.maskedPayoutRef}</td>
              <td className="text-right">{formatINR(it.originalPaise)}</td>
              <td className={`text-right ${it.finalPaise !== it.originalPaise ? "text-amber-400" : "text-zinc-200"}`}>{formatINR(it.finalPaise)}</td>
              <td className="pl-4">{it.adjustments.at(-1)?.reason ?? "—"}{it.adjustments.at(-1) ? <span className="block text-[10px] text-zinc-600">{it.adjustments.at(-1)!.actorId}, {when(it.adjustments.at(-1)!.at)}</span> : null}</td>
              <td className={statusCls(it.status)}>{it.status}{it.failureReason ? ` (${it.failureReason})` : ""}</td>
            </tr>))}</tbody></table></div>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-zinc-500">Original total</dt><dd className="text-zinc-200">{formatINR(r.totals.original)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Total payout</dt><dd className="text-zinc-100">{formatINR(r.totals.final)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Salary Pot balance</dt><dd className="text-zinc-200">{formatINR(r.availableInPot)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Remaining after payout</dt><dd className={r.shortfall ? "text-red-400" : "text-zinc-200"}>{r.shortfall ? `Short by ${formatINR(r.shortfall)}` : formatINR(r.remainingAfterPayout)}</dd></div>
        </dl>
      </Section>
      {draft ? (
        <Section title="Edit an employee (reason required)">
          {run.items.map((it) => (
            <form key={it.employeeId} action={adjustPayrollItemAction} className="grid gap-2 border-t border-zinc-900 py-3 first:border-0 sm:grid-cols-6">
              <input type="hidden" name="runId" value={run.id} /><input type="hidden" name="employeeId" value={it.employeeId} />
              <span className="self-center text-sm text-zinc-200">{it.name}</span>
              <input name="newAmount" placeholder="New amount ₹" className={inputCls} inputMode="decimal" />
              <input name="absentDays" placeholder="Absent days" className={inputCls} inputMode="numeric" />
              <input name="workingDays" placeholder="Working days" className={inputCls} inputMode="numeric" />
              <input name="reason" required placeholder="Reason" className={inputCls} />
              <button className={btnMuted}>Save</button>
            </form>))}
          <p className="mt-2 text-xs text-zinc-500">Either enter a new amount, or absent + working days (calculated on the original salary).</p>
          <form action={approvePayrollAction} className="mt-4"><input type="hidden" name="runId" value={run.id} /><button className={btnCls}>Owner: authorize this salary batch</button></form>
        </Section>
      ) : (
        <Section title="Payout">
          <p className="mb-3 text-xs text-zinc-500">Approved by {run.approvedBy} at {run.approvedAt ? when(run.approvedAt) : ""}. Sandbox: choose the simulated provider result.</p>
          {run.status !== "COMPLETED" ? (
            <div className="flex gap-2">
              <form action={executePayrollAction}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="outcome" value="SUCCESS" /><button className={btnCls}>Release salaries (simulate success)</button></form>
              <form action={executePayrollAction}><input type="hidden" name="runId" value={run.id} /><input type="hidden" name="outcome" value="FAILED" /><button className={btnMuted}>Simulate provider failure</button></form>
            </div>) : <p className="text-sm text-[var(--radium-green)]">All salaries paid (simulated). Receipt is in Transactions.</p>}
        </Section>
      )}
    </div>
  );
}
