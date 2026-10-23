import Link from "next/link";
import { getPotsRuntime, DEMO_BUSINESS_ID as B } from "@/server/modules/pots/runtime";
import { addEmployeeAction, createPayrollRunAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Field, Section, inputCls, btnCls, statusCls } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SalaryPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams; const rt = getPotsRuntime();
  const pot = rt.pots.find((p) => p.type === "SALARY")!; const emps = rt.directory.employees(B); const runs = rt.payroll.list(B).reverse();
  const month = new Date().toISOString().slice(0, 7);
  return (
    <div className="space-y-6">
      <Back />
      <Header title="Salary" sub={`Salary Pot available: ${formatINR(rt.payouts.getAvailable(B, pot.id))}. Pick a payroll period, review each employee, edit with a reason, then the owner authorizes the batch.`} />
      <Notice code={notice} />
      <Section title="Employees">
        {emps.length === 0 ? <p className="text-sm text-zinc-400">No employees yet.</p> : (
          <table className="w-full text-left text-xs text-zinc-400"><thead className="text-zinc-500"><tr><th className="py-2">Name</th><th>Payout to</th><th className="text-right">Monthly salary</th></tr></thead>
            <tbody>{emps.map((e) => <tr key={e.id} className="border-t border-zinc-900"><td className="py-2 text-zinc-200">{e.name}</td><td>{e.maskedRef}</td><td className="text-right">{formatINR(e.salaryPaise)}</td></tr>)}</tbody></table>
        )}
        <form action={addEmployeeAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Name"><input name="name" required className={inputCls} /></Field>
          <Field label="Bank / UPI reference (token)"><input name="payoutRef" required minLength={4} className={inputCls} autoComplete="off" /></Field>
          <Field label="Monthly salary (₹)"><input name="salary" required inputMode="decimal" className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Add employee</button></div>
        </form>
      </Section>
      <Section title="Distribute salary">
        <form action={createPayrollRunAction} className="flex flex-wrap items-end gap-3">
          <Field label="Payroll period"><input type="month" name="period" defaultValue={month} required className={inputCls} /></Field>
          <button className={btnCls}>Start payroll draft</button>
        </form>
      </Section>
      <Section title="Payroll runs">
        {runs.length === 0 ? <p className="text-sm text-zinc-400">No payroll runs yet.</p> : runs.map((r) => (
          <Link key={r.id} href={`/owner/pots/salary/${r.id}`} className="flex items-center justify-between border-t border-zinc-900 py-2 text-sm first:border-0 hover:text-zinc-100">
            <span className="text-zinc-300">{r.period} · {formatINR(rt.payroll.total(r).final)}</span><span className={`text-xs ${statusCls(r.status)}`}>{r.status}</span>
          </Link>))}
      </Section>
    </div>
  );
}
