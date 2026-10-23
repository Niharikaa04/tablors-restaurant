import Link from "next/link";
import { randomUUID } from "node:crypto";

import { LiveRefresh } from "@/components/live/live-refresh";
import { SubmitOnceButton } from "@/components/ui/submit-once-button";
import { requirePermission } from "@/server/modules/auth/session";
import {
  getLedgerDb,
  getLoyaltySettingsDb,
  getLoyaltyStatsDb,
  listCustomersDb,
  listRewardsDb,
} from "@/server/modules/loyalty-db/db-loyalty";
import { maskPhone } from "@/server/modules/loyalty-db/engine";
import { MemberMessenger } from "./member-messenger";
import {
  adjustPointsAction,
  createRewardAction,
  saveLoyaltySettingsAction,
  setCustomerStatusAction,
  toggleRewardAction,
  updateRewardAction,
} from "./points-actions";

export const dynamic = "force-dynamic";

const input =
  "h-10 w-full rounded-lg border border-zinc-700 bg-black px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#d7fe3b]";
const button =
  "h-10 rounded-lg bg-[#d7fe3b] px-5 text-sm font-semibold text-black transition hover:opacity-90";
const ghost = "h-9 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-zinc-500";
const card = "rounded-xl border border-zinc-800 bg-zinc-950 p-5";
const label = "block text-xs text-zinc-400";

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  "settings-saved": { ok: true, text: "Loyalty settings saved." },
  "invalid-settings": { ok: false, text: "Check the settings: rate, points and limits must be valid numbers." },
  "reward-created": { ok: true, text: "Reward created." },
  "reward-updated": { ok: true, text: "Reward updated." },
  "invalid-reward": { ok: false, text: "Check the reward: name, points cost, and the discount value or percent (1–100)." },
  adjusted: { ok: true, text: "Points adjusted and logged." },
  "adjust-failed": { ok: false, text: "Adjustment failed: use a whole number, a reason, and don't go below zero." },
  "owner-only": { ok: false, text: "Only the owner can adjust points manually." },
  "customer-updated": { ok: true, text: "Customer updated." },
  denied: { ok: false, text: "You don't have access to loyalty." },
};

const TYPE_LABEL: Record<string, string> = {
  fixed_discount: "Fixed discount (₹)",
  percent_discount: "Percentage discount",
  free_item: "Free item",
  coupon: "Coupon",
  experience: "Experience / perk",
};

const when = (d: Date) =>
  d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

const dateInput = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : "");

function RewardFields({ r }: { r?: Awaited<ReturnType<typeof listRewardsDb>>[number] }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <label className={`${label} md:col-span-2`}>Reward name
        <input name="name" required defaultValue={r?.name} placeholder="₹50 off" className={input} />
      </label>
      <label className={label}>Type
        <select name="type" defaultValue={r?.type ?? "fixed_discount"} className={input}>
          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className={label}>Points cost
        <input name="pointsCost" type="number" min={1} required defaultValue={r?.pointsCost} className={input} />
      </label>
      <label className={label}>Discount ₹ (fixed)
        <input name="valueRupees" type="number" min={0} defaultValue={r?.valuePaise ? r.valuePaise / 100 : ""} className={input} />
      </label>
      <label className={label}>Percent (1–100)
        <input name="percent" type="number" min={0} max={100} defaultValue={r?.percent ?? ""} className={input} />
      </label>
      <label className={label}>Max discount ₹ (percent)
        <input name="maxDiscountRupees" type="number" min={0} defaultValue={r?.maxDiscountPaise ? r.maxDiscountPaise / 100 : ""} className={input} />
      </label>
      <label className={label}>Quantity (blank = unlimited)
        <input name="quantity" type="number" min={0} defaultValue={r?.quantity ?? ""} className={input} />
      </label>
      <label className={label}>Valid from
        <input name="validFrom" type="date" defaultValue={dateInput(r?.validFrom ?? null)} className={`${input} [color-scheme:dark]`} />
      </label>
      <label className={label}>Valid until
        <input name="validTo" type="date" defaultValue={dateInput(r?.validTo ?? null)} className={`${input} [color-scheme:dark]`} />
      </label>
      <label className={`${label} md:col-span-2`}>Terms (optional)
        <input name="terms" maxLength={300} defaultValue={r?.terms ?? ""} className={input} />
      </label>
    </div>
  );
}

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; customer?: string }>;
}) {
  const session = await requirePermission("loyalty");
  const { notice: code, customer: customerId } = await searchParams;
  const notice = code ? NOTICES[code] : null;
  const rid = session.restaurantId;

  const [settings, stats, rewards, customers] = await Promise.all([
    getLoyaltySettingsDb(rid),
    getLoyaltyStatsDb(rid),
    listRewardsDb(rid),
    listCustomersDb(rid),
  ]);
  const selected = customers.find((c) => c.id === customerId) ?? null;
  const ledger = selected ? await getLedgerDb(rid, selected.id, 50) : [];
  const isOwner = session.role === "owner";

  const statCards: [string, number][] = [
    ["Members", stats.members],
    ["Points issued", stats.issued],
    ["Points redeemed", stats.redeemed],
    ["Points reversed (refunds)", stats.reversed],
    ["Outstanding points", stats.outstanding],
  ];

  return (
    <div className="space-y-8">
      <LiveRefresh intervalMs={10000} />
      <div>
        <h1 className="text-3xl font-semibold text-white">Loyalty</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Customers are identified by mobile number. Points are earned automatically when a bill is paid; they are a separate ledger from money and Pots.{" "}
          <Link href="/owner/loyalty/legacy" className="underline">Older member offers</Link>
        </p>
      </div>

      {notice && (
        <p role="status" className={`rounded-lg border px-4 py-2 text-sm ${notice.ok ? "border-[#d7fe3b]/40 text-[#d7fe3b]" : "border-red-500/50 text-red-300"}`}>
          {notice.text}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-5">
        {statCards.map(([name, value]) => (
          <div key={name} className={card}>
            <p className="text-xs uppercase tracking-widest text-zinc-500">{name}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value.toLocaleString("en-IN")}</p>
          </div>
        ))}
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-white">Earning rules</h2>
        <form action={saveLoyaltySettingsAction} className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-zinc-200">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Loyalty program enabled
            <span className="text-xs text-zinc-500">(switching off keeps all history)</span>
          </label>
          <div className="grid gap-3 md:grid-cols-4">
            <label className={label}>Earn this many points…
              <input name="earnPoints" type="number" min={1} required defaultValue={settings.earnPoints} className={input} />
            </label>
            <label className={label}>…for every ₹ of eligible spend
              <input name="earnSpendRupees" type="number" min={1} step="any" required defaultValue={settings.earnSpendPaise / 100} className={input} />
            </label>
            <label className={label}>Minimum bill ₹
              <input name="minBillRupees" type="number" min={0} defaultValue={settings.minBillPaise / 100} className={input} />
            </label>
            <label className={label}>Max points per bill (blank = none)
              <input name="maxPointsPerBill" type="number" min={0} defaultValue={settings.maxPointsPerBill ?? ""} className={input} />
            </label>
            <label className={label}>Points expire after (months, blank = never)
              <input name="expiryMonths" type="number" min={0} defaultValue={settings.expiryMonths ?? ""} className={input} />
            </label>
            <label className={label}>Minimum points to redeem
              <input name="minPointsToRedeem" type="number" min={0} defaultValue={settings.minPointsToRedeem} className={input} />
            </label>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-200">
            <label className="flex items-center gap-2"><input type="checkbox" name="excludeGst" defaultChecked={settings.excludeGst} /> Exclude GST from points</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="excludeServiceCharge" defaultChecked={settings.excludeServiceCharge} /> Exclude service charge</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="discountBeforePoints" defaultChecked={settings.discountBeforePoints} /> Deduct discounts before calculating points</label>
          </div>
          <SubmitOnceButton className={button} pendingLabel="Saving…">Save settings</SubmitOnceButton>
        </form>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-white">Rewards</h2>
        <form action={createRewardAction} className="mt-4 space-y-3">
          <RewardFields />
          <SubmitOnceButton className={button} pendingLabel="Creating…">Create reward</SubmitOnceButton>
        </form>

        <div className="mt-6 space-y-3">
          {rewards.length === 0 && <p className="text-sm text-zinc-500">No rewards yet.</p>}
          {rewards.map((r) => (
            <details key={r.id} className="rounded-lg border border-zinc-800 p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm text-zinc-100">
                <span>
                  <span className="font-semibold">{r.name}</span>{" "}
                  <span className="text-zinc-400">· {TYPE_LABEL[r.type] ?? r.type} · {r.pointsCost} pts</span>
                </span>
                <span className={r.active ? "text-[#d7fe3b]" : "text-zinc-500"}>{r.active ? "Active" : "Inactive"}</span>
              </summary>
              <form action={updateRewardAction} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={r.id} />
                <RewardFields r={r} />
                <SubmitOnceButton className={ghost} pendingLabel="Saving…">Save changes</SubmitOnceButton>
              </form>
              <form action={toggleRewardAction} className="mt-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="active" value={String(!r.active)} />
                <SubmitOnceButton className={ghost} pendingLabel="Updating…">{r.active ? "Deactivate" : "Activate"}</SubmitOnceButton>
              </form>
            </details>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-semibold text-white">Members</h2>
        {customers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No members yet. They appear when a customer enters a mobile number on their bill.</p>
        ) : (
          <MemberMessenger
            members={customers.map((c) => ({
              id: c.id,
              maskedPhone: maskPhone(c.phone),
              balance: c.balance,
              status: c.status,
            }))}
          />
        )}

        {selected && (
          <div className="mt-6 space-y-4 border-t border-zinc-800 pt-5">
            <h3 className="text-base font-semibold text-white">
              {maskPhone(selected.phone)} · {selected.balance} points
            </h3>

            {isOwner && (
              <div className="flex flex-wrap items-end gap-4">
                <form action={adjustPointsAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="customerId" value={selected.id} />
                  <input type="hidden" name="requestId" value={randomUUID()} />
                  <label className={label}>Points (+ or −)
                    <input name="points" type="number" required className={`${input} w-32`} />
                  </label>
                  <label className={label}>Reason (required)
                    <input name="reason" required minLength={3} maxLength={200} className={`${input} w-72`} />
                  </label>
                  <SubmitOnceButton className={ghost} pendingLabel="Saving…">Adjust points</SubmitOnceButton>
                </form>
                <form action={setCustomerStatusAction}>
                  <input type="hidden" name="customerId" value={selected.id} />
                  <input type="hidden" name="status" value={selected.status === "active" ? "blocked" : "active"} />
                  <SubmitOnceButton className={ghost} pendingLabel="Updating…">{selected.status === "active" ? "Block account" : "Unblock account"}</SubmitOnceButton>
                </form>
              </div>
            )}

            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-widest text-zinc-500">
                <tr><th className="py-2">When</th><th>Type</th><th>Points</th><th>Details</th></tr>
              </thead>
              <tbody>
                {ledger.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-800 text-zinc-200">
                    <td className="py-2">{when(t.createdAt)}</td>
                    <td>{t.type}</td>
                    <td className={t.points < 0 ? "text-red-300" : "text-[#d7fe3b]"}>{t.points > 0 ? `+${t.points}` : t.points}</td>
                    <td className="text-zinc-400">{t.reason}{t.sourceId ? ` · ${t.sourceId.slice(0, 8)}` : ""}</td>
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
