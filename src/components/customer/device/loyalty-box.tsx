"use client";

import { useState } from "react";

import type { CustomerBillState } from "@/server/modules/customer/actions";

export type LoyaltyHandlers = {
  identify: (phone: string) => Promise<{ ok: boolean; message?: string }>;
  redeem: (rewardId: string) => Promise<{ ok: boolean; message?: string }>;
  remove: () => Promise<{ ok: boolean; message?: string }>;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Loyalty section of the customer bill: enter a mobile number, see points and
 * rewards, apply one reward. Points are only deducted once the bill is paid
 * (server side); applying a reward just holds the points.
 */
export function LoyaltyBox({
  bill,
  handlers,
}: {
  bill: CustomerBillState;
  handlers: LoyaltyHandlers;
}) {
  const loyalty = bill.loyalty;
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!loyalty.enabled || bill.status === "paid") return null;

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      if (!res.ok) setMessage(res.message ?? "Something went wrong.");
    } catch {
      setMessage("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const border = { borderColor: "var(--device-shell-border)", background: "var(--device-lcd-bg)" };
  const muted = { color: "var(--device-lcd-muted)" };

  return (
    <div className="mt-4 rounded-xl border p-4 text-xs" style={border}>
      <p className="text-sm font-bold" style={{ color: "var(--device-gold)" }}>
        Loyalty points
      </p>

      {!loyalty.identified ? (
        <div className="mt-2">
          <label htmlFor="loyalty-phone" style={muted}>
            Enter your mobile number to earn and use points
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="loyalty-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={14}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--device-shell-border)", color: "var(--device-lcd-text)" }}
            />
            <button
              type="button"
              disabled={busy || phone.trim() === ""}
              onClick={() => void run(() => handlers.identify(phone))}
              className="rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-50"
              style={{ background: "var(--device-gold)", color: "#171a10" }}
            >
              {busy ? "Checking…" : "Continue"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <span style={muted}>Member {loyalty.phoneMasked}</span>
            <span className="text-sm font-bold">{loyalty.balance} pts</span>
          </div>
          {loyalty.pointsToEarn > 0 && (
            <p style={muted}>You&apos;ll earn {loyalty.pointsToEarn} points when this bill is paid.</p>
          )}

          {loyalty.applied && (
            <div className="rounded-md border p-3" style={{ borderColor: "var(--device-gold)" }}>
              <p className="font-semibold">
                {loyalty.applied.rewardName} applied
                {loyalty.applied.discountRupees > 0 ? `: −${inr(loyalty.applied.discountRupees)}` : ""}
              </p>
              <p style={muted}>Code {loyalty.applied.code} · {loyalty.applied.points} points used on payment</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => handlers.remove())}
                className="mt-2 text-xs underline disabled:opacity-50"
              >
                Remove reward
              </button>
            </div>
          )}

          {loyalty.rewards.length === 0 ? (
            <p style={muted}>No rewards are available yet.</p>
          ) : (
            <ul className="space-y-2">
              {loyalty.rewards.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border p-3" style={{ borderColor: "var(--device-shell-border)" }}>
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block" style={muted}>
                      {r.description} · {r.pointsCost} pts
                    </span>
                    {!r.redeemable && r.reason && (
                      <span className="block" style={muted}>{r.reason}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={busy || !r.redeemable}
                    onClick={() => void run(() => handlers.redeem(r.id))}
                    className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                    style={{ borderColor: "var(--device-gold)", color: "var(--device-gold)" }}
                  >
                    Redeem
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && (
        <p role="alert" className="mt-2" style={{ color: "var(--device-lcd-muted)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
