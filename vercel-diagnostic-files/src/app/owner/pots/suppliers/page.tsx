import { getPotsRuntime, DEMO_BUSINESS_ID as B } from "@/server/modules/pots/runtime";
import { addVendorAction, supplierPaymentAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Field, Section, inputCls, btnCls, statusCls, when } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams; const rt = getPotsRuntime();
  const vendors = rt.directory.vendors(B); const list = rt.payouts.list(B, "SUPPLIER");
  return (
    <div className="space-y-6">
      <Back /><Header title="Supplier payment" sub="Choose the supplier, invoice and the Pot to pay from. Payments need approval; the Pot reduces only when the (simulated) provider confirms." />
      <Notice code={notice} />
      <Section title="Pay a supplier">
        <form action={supplierPaymentAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Supplier"><select name="vendorId" required className={inputCls}><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.maskedRef})</option>)}</select></Field>
          <Field label="Pay from Pot"><select name="potId" required className={inputCls}>{rt.pots.filter((p) => ["INVENTORY", "MAINTENANCE", "SUBSCRIPTIONS", "SERVICE_CHARGES", "CUSTOM"].includes(p.type)).map((p) => <option key={p.id} value={p.id}>{p.name} — {formatINR(rt.payouts.getAvailable(B, p.id))}</option>)}</select></Field>
          <Field label="Invoice number"><input name="invoice" required className={inputCls} /></Field>
          <Field label="Amount (₹)"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
          <Field label="Payment method"><select name="method" className={inputCls}><option>Bank transfer (simulated)</option><option>UPI (simulated)</option></select></Field>
          <Field label="Note"><input name="note" className={inputCls} /></Field>
          <div className="sm:col-span-3"><button className={btnCls}>Request payment</button></div>
        </form>
      </Section>
      <Section title="Add a supplier">
        <form action={addVendorAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input name="name" required className={inputCls} /></Field>
          <Field label="Bank / UPI reference (token)"><input name="payoutRef" required minLength={4} className={inputCls} autoComplete="off" /></Field>
          <div className="flex items-end"><button className={btnCls}>Add supplier</button></div>
        </form>
      </Section>
      <Section title="Supplier payments">
        {list.length === 0 ? <p className="text-sm text-zinc-400">None yet.</p> : (
          <table className="w-full text-left text-xs text-zinc-400"><tbody>{list.map((p) => (
            <tr key={p.id} className="border-t border-zinc-900"><td className="py-2">{when(p.createdAt)}</td><td>{p.maskedRef}</td><td>{p.invoiceRef}</td><td>{formatINR(p.amount)}</td><td className={statusCls(p.status)}>{p.status}</td></tr>))}</tbody></table>)}
        <p className="mt-2 text-xs text-zinc-500">Approve pending payments under Approvals.</p>
      </Section>
    </div>
  );
}
