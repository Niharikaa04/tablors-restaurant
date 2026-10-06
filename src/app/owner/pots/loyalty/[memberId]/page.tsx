import { notFound } from "next/navigation";
import { DEMO_BUSINESS_ID as B } from "@/server/modules/pots/runtime";
import { getLoyaltyRuntime } from "@/server/modules/financial-pots/loyalty-runtime";
import { adjustPointsAction, setMemberStatusAction } from "@/server/modules/pots/money-actions";
import { Back, Header, Notice, Field, Section, inputCls, btnCls, btnMuted, when } from "../../_components/ui";

export const dynamic = "force-dynamic";

export default async function MemberPage({ params, searchParams }: { params: Promise<{ memberId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { memberId } = await params; const { notice } = await searchParams; const lr = getLoyaltyRuntime(); const m = lr.members.get(memberId);
  if (!m || m.businessId !== B) notFound();
  const led = lr.ledger.ledger(B, m.id).slice().reverse(); const avail = lr.catalog.listAvailable(B, m.id);
  const earnedMonth = led.filter((t) => t.type === "EARN" && t.createdAt.toISOString().slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, t) => a + t.points, 0);
  return (
    <div className="space-y-6">
      <Back href="/owner/pots/loyalty" label="Back to Loyalty" /><Header title={`${m.name} · ${m.maskedPhone}`} sub={m.status === "SUSPENDED" ? "Account suspended — cannot redeem." : "Loyalty account"} />
      <Notice code={notice} />
      <Section title="Balance"><p className="text-2xl font-semibold text-zinc-100">{lr.ledger.balance(B, m.id)} points</p><p className="text-xs text-zinc-500">Available now {lr.ledger.available(B, m.id)} · earned this month {earnedMonth}</p></Section>
      <Section title="Rewards available">{avail.length === 0 ? <p className="text-sm text-zinc-400">None yet — keep earning.</p> : avail.map((r) => <p key={r.id} className="border-t border-zinc-900 py-2 text-sm text-zinc-300 first:border-0">{r.name} · {r.pointsCost} points{r.terms ? ` · ${r.terms}` : ""}</p>)}</Section>
      <Section title="History">{led.length === 0 ? <p className="text-sm text-zinc-400">No activity.</p> : (
        <table className="w-full text-left text-xs text-zinc-400"><tbody>{led.map((t) => <tr key={t.id} className="border-t border-zinc-900"><td className="py-2">{when(t.createdAt)}</td><td>{t.type}</td><td>{t.sourceId}</td><td>{t.reason ?? ""}</td><td>{t.expiresAt ? `exp ${when(t.expiresAt)}` : ""}</td><td className={`text-right ${t.points < 0 ? "text-red-400" : "text-[var(--radium-green)]"}`}>{t.points > 0 ? "+" : ""}{t.points}</td></tr>)}</tbody></table>)}</Section>
      <Section title="Manual adjustment (reason required, logged)">
        <form action={adjustPointsAction} className="grid gap-3 sm:grid-cols-3"><input type="hidden" name="memberId" value={m.id} />
          <Field label="Points (+/-)"><input name="points" required inputMode="numeric" className={inputCls} /></Field><Field label="Reason"><input name="reason" required className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Adjust</button></div></form>
        <form action={setMemberStatusAction} className="mt-3"><input type="hidden" name="memberId" value={m.id} /><input type="hidden" name="status" value={m.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} /><button className={btnMuted}>{m.status === "ACTIVE" ? "Suspend account" : "Reinstate account"}</button></form>
      </Section>
    </div>
  );
}
