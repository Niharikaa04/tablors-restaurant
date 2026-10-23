import Link from "next/link";
import { DEMO_BUSINESS_ID as B } from "@/server/modules/pots/runtime";
import { currentLoyaltyRule, getLoyaltyRuntime, loyaltySummary } from "@/server/modules/financial-pots/loyalty-runtime";
import { createRewardAction, enrolMemberAction, saveLoyaltySettingsAction } from "@/server/modules/pots/money-actions";
import { formatINR } from "@/server/modules/pots/money";
import { Back, Header, Notice, Field, Section, inputCls, btnCls } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams; const lr = getLoyaltyRuntime(); const rule = currentLoyaltyRule(lr, B); const s = loyaltySummary(lr, B);
  const members = [...lr.members.values()].filter((m) => m.businessId === B);
  const rewards = lr.catalog.list(B);
  const chk = (b?: boolean) => b ? { defaultChecked: true } : {};
  return (
    <div className="space-y-6">
      <Back /><Header title="Loyalty points" sub="Points are not money: they live in a separate ledger and never change Pot balances. The earning rate is your setting — nothing is pre-set." />
      <Notice code={notice} />
      <Section title="Overview">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">{([["Members", s.totalMembers], ["Points issued", s.issued], ["Redeemed", s.redeemed], ["Outstanding", s.outstanding]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-zinc-500">{k}</dt><dd className="text-zinc-100">{v}</dd></div>)}</dl>
        <p className="mt-2 text-xs text-zinc-500">Expired {s.expired} · new this month {s.newThisMonth} · active this month {s.activeThisMonth}</p>
      </Section>
      <Section title={`Earning rules ${rule ? `(version ${rule.version})` : "(not configured)"}`}>
        <form action={saveLoyaltySettingsAction} className="grid gap-3 sm:grid-cols-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" name="enabled" {...chk(rule?.enabled ?? true)} /> Program enabled</label>
          <Field label="Points"><input name="pointsPerBlock" required defaultValue={rule?.pointsPerBlock} className={inputCls} inputMode="numeric" /></Field>
          <Field label="per ₹ of eligible spend"><input name="blockRupees" required defaultValue={rule ? String(rule.blockPaise / 100) : ""} className={inputCls} inputMode="decimal" /></Field>
          <Field label="Min bill (₹)"><input name="minBill" defaultValue={rule?.minBillPaise ? String(rule.minBillPaise / 100) : ""} className={inputCls} /></Field>
          <Field label="Max points / bill"><input name="maxPerBill" defaultValue={rule?.maxPointsPerBill} className={inputCls} /></Field>
          <Field label="Max points / day / customer"><input name="maxPerDay" defaultValue={rule?.maxPointsPerDay} className={inputCls} /></Field>
          <Field label="Max points / month / customer"><input name="maxPerMonth" defaultValue={rule?.maxPointsPerMonth} className={inputCls} /></Field>
          <Field label="Points expire after (days)"><input name="expiryDays" defaultValue={rule?.expiryDays} className={inputCls} /></Field>
          <Field label="Excluded categories (comma separated)"><input name="excludedCategories" defaultValue={rule?.excludedCategories.join(", ")} className={inputCls} /></Field>
          <Field label="Refund policy"><select name="refundPolicy" defaultValue={rule?.refundPolicy ?? "PROPORTIONAL"} className={inputCls}><option value="PROPORTIONAL">Reverse proportionally</option><option value="FULL_ONLY">Only on full refund</option></select></Field>
          <div className="space-y-1 text-sm text-zinc-300 sm:col-span-2">
            <label className="block"><input type="checkbox" name="deductDiscounts" {...chk(rule?.deductDiscounts ?? true)} /> Deduct discounts first</label>
            <label className="block"><input type="checkbox" name="excludeGst" {...chk(rule?.excludeGst ?? true)} /> Exclude GST</label>
            <label className="block"><input type="checkbox" name="excludeService" {...chk(rule?.excludeServiceCharge ?? true)} /> Exclude service charge</label>
            <label className="block"><input type="checkbox" name="excludeDelivery" {...chk(rule?.excludeDelivery ?? true)} /> Exclude delivery</label>
            <label className="block"><input type="checkbox" name="excludeTips" {...chk(rule?.excludeTips ?? true)} /> Exclude tips</label>
          </div>
          <div className="sm:col-span-4"><button className={btnCls}>Save as new version</button></div>
        </form>
      </Section>
      <Section title="Rewards catalogue">
        {rewards.length === 0 ? <p className="text-sm text-zinc-400">No rewards yet.</p> : rewards.map((r) => <p key={r.id} className="border-t border-zinc-900 py-2 text-sm text-zinc-300 first:border-0">{r.name} · {r.type.replace("_", " ").toLowerCase()} · {r.pointsCost} points{r.quantity != null ? ` · ${r.quantity} left` : ""}</p>)}
        <form action={createRewardAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Name"><input name="name" required className={inputCls} /></Field>
          <Field label="Type"><select name="type" className={inputCls}><option value="DISCOUNT">Fixed discount</option><option value="PERCENT_DISCOUNT">Percentage discount</option><option value="FREE_ITEM">Free item</option><option value="FREE_UPGRADE">Free upgrade</option><option value="EXPERIENCE">Exclusive experience</option><option value="COUPON">One-time coupon</option></select></Field>
          <Field label="Points cost"><input name="pointsCost" required inputMode="numeric" className={inputCls} /></Field>
          <Field label="Discount ₹ (or max ₹ for %)"><input name="value" className={inputCls} /></Field>
          <Field label="Percent (for % reward)"><input name="percent" className={inputCls} /></Field>
          <Field label="Quantity (blank = unlimited)"><input name="quantity" className={inputCls} /></Field>
          <Field label="Terms"><input name="terms" className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Add reward</button></div>
        </form>
      </Section>
      <Section title="Members">
        {members.map((m) => <Link key={m.id} href={`/owner/pots/loyalty/${m.id}`} className="flex justify-between border-t border-zinc-900 py-2 text-sm text-zinc-300 first:border-0 hover:text-zinc-100"><span>{m.name} · {m.maskedPhone}</span><span>{lr.ledger.balance(B, m.id)} pts{m.status === "SUSPENDED" ? " · suspended" : ""}</span></Link>)}
        <form action={enrolMemberAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Name"><input name="name" required className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" required inputMode="tel" className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnCls}>Enrol member</button></div>
        </form>
        <p className="mt-2 text-xs text-zinc-500">Minimum bill preview example: {rule?.minBillPaise ? formatINR(rule.minBillPaise) : "none"}.</p>
      </Section>
    </div>
  );
}
