import Link from "next/link";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { buildGstView } from "@/server/modules/pots/reports";
import { gstAdjustAction, taxTransferAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Field, Section, inputCls, btnCls, btnMuted, statusCls, when } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function GstPage({ searchParams }: { searchParams: Promise<{ notice?: string; m?: string }> }) {
  const { notice, m } = await searchParams; const v = buildGstView(getPotsRuntime(), m);
  if (!v) return <div className="space-y-4"><Back /><p className="text-sm text-zinc-400">No GST Pot configured.</p></div>;
  return (
    <div className="space-y-6">
      <Back /><Header title="GST / Tax reserve" sub="This is an accounting reserve, not a promise of direct government payment. The tax rate comes from your allocation rules, never a hard-coded percentage." />
      <Notice code={notice} />
      <Section title="Reserved amount">
        <p className="text-2xl font-semibold text-zinc-100">{formatINR(v.balance)}</p>
        <p className="text-xs text-zinc-500">Available to transfer: {formatINR(v.available)} · This period ({v.month ?? "—"}): {formatINR(v.reservedInMonth)}</p>
        <div className="mt-3 flex flex-wrap gap-2">{v.months.map((x) => <Link key={x} href={`/owner/pots/gst?m=${x}`} className={btnMuted}>{x}</Link>)}
          <a href={`/owner/pots/gst/export${v.month ? `?m=${v.month}` : ""}`} className={btnCls}>Export CSV for accountant</a></div>
      </Section>
      <Section title="Source transactions">
        {v.rows.length === 0 ? <p className="text-sm text-zinc-400">None in this period.</p> : (
          <table className="w-full text-left text-xs text-zinc-400"><tbody>{v.rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-900"><td className="py-2">{when(r.at)}</td><td>{r.sourceType}</td><td>{r.sourceId}</td><td>{r.reason}</td><td className={`text-right ${r.amount < 0 ? "text-red-400" : "text-[var(--radium-green)]"}`}>{formatINR(r.amount)}</td></tr>))}</tbody></table>)}
      </Section>
      <Section title="Adjust reserve (owner, reason required)">
        <form action={gstAdjustAction} className="grid gap-3 sm:grid-cols-4">
          <Field label="Direction"><select name="direction" className={inputCls}><option value="reserve">Add to reserve</option><option value="release">Release from reserve</option></select></Field>
          <Field label="Amount (₹)"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
          <Field label="Reason"><input name="reason" required className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Adjust</button></div>
        </form>
      </Section>
      <Section title="Withdraw / transfer for tax payment">
        <p className="mb-3 text-xs text-zinc-500">No compliant tax-payment integration is connected, so this moves money to your account and you pay the tax externally.</p>
        <form action={taxTransferAction} className="grid gap-3 sm:grid-cols-4">
          <Field label="Destination account (token)"><input name="destination" required minLength={4} className={inputCls} autoComplete="off" /></Field>
          <Field label="Amount (₹)"><input name="amount" required inputMode="decimal" className={inputCls} /></Field>
          <Field label="Tax reference / period"><input name="invoice" className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Request transfer</button></div>
        </form>
        {v.taxPayouts.map((p) => <p key={p.id} className="mt-2 text-xs text-zinc-400">{when(p.createdAt)} · {p.maskedRef} · {formatINR(p.amount)} · <span className={statusCls(p.status)}>{p.status}</span></p>)}
      </Section>
    </div>
  );
}
