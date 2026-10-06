"use client";

import { useState, useTransition } from "react";
import { addDevicesAction, changePlanAction, renewAction, type SubscriptionActionResult } from "./actions";

interface Props {
  planId: string;
  planName: string;
  renewalLabel: string;
  monthlyRupees: number;
  devicesUsed: number;
  deviceLimit: number;
  plans: { id: string; name: string; monthlyRupees: number; deviceLimit: number }[];
  payments: { id: string; invoiceNo: string; dateLabel: string; description: string; amountRupees: number; status: string }[];
}

const card = "rounded-xl border border-zinc-800 bg-zinc-950 p-5";
const btn = "rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-200 transition-colors hover:border-[#d7fe3b] hover:text-[#d7fe3b] disabled:opacity-40";

export function SubscriptionManager(p: Props) {
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [addCount, setAddCount] = useState("5");
  const [showAdd, setShowAdd] = useState(false);

  const idx = p.plans.findIndex((x) => x.id === p.planId);
  const pct = Math.min(100, Math.round((p.devicesUsed / Math.max(p.deviceLimit, 1)) * 100));

  function run(fn: () => Promise<SubscriptionActionResult>, ok?: () => void) {
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setNotice(r.error);
      else ok?.();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Subscription</h1>
        <p className="mt-1 text-sm text-zinc-400">Your plan, billing and device allowance.</p>
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{notice}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}><p className="text-xs text-zinc-500">Plan</p><p className="mt-2 text-xl font-semibold text-[#d7fe3b]">{p.planName}</p></div>
        <div className={card}><p className="text-xs text-zinc-500">Renewal</p><p className="mt-2 text-xl font-semibold text-zinc-100">{p.renewalLabel}</p></div>
        <div className={card}><p className="text-xs text-zinc-500">Monthly</p><p className="mt-2 text-xl font-semibold text-zinc-100">₹{p.monthlyRupees.toLocaleString("en-IN")}</p></div>
        <div className={card}>
          <p className="text-xs text-zinc-500">Devices</p>
          <p className="mt-2 text-xl font-semibold text-zinc-100">{p.devicesUsed}/{p.deviceLimit}</p>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-900"><div className="h-full rounded-full bg-[#d7fe3b]" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => setShowPlans((s) => !s)}>Upgrade / Downgrade</button>
        <button className={btn} disabled={pending} onClick={() => run(() => renewAction())}>Renew</button>
        <button className={btn} onClick={() => setShowAdd((s) => !s)}>Add devices</button>
      </div>

      {showPlans && (
        <div className="grid gap-3 sm:grid-cols-3">
          {p.plans.map((pl, i) => {
            const current = pl.id === p.planId;
            return (
              <div key={pl.id} className={`${card} ${current ? "border-[#d7fe3b]/50" : ""}`}>
                <p className="font-semibold text-zinc-100">{pl.name}</p>
                <p className="mt-1 text-2xl text-zinc-50">₹{pl.monthlyRupees.toLocaleString("en-IN")}<span className="text-xs text-zinc-500"> /month</span></p>
                <p className="mt-1 text-xs text-zinc-400">Up to {pl.deviceLimit} devices</p>
                <button
                  className={`${btn} mt-4 w-full`}
                  disabled={current || pending}
                  onClick={() => run(() => changePlanAction(pl.id), () => setShowPlans(false))}
                >
                  {current ? "Current plan" : i > idx ? "Upgrade" : "Downgrade"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <div className={`${card} flex flex-wrap items-end gap-3`}>
          <label className="text-xs text-zinc-400">
            Extra devices
            <input type="number" min={1} max={100} value={addCount} onChange={(e) => setAddCount(e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 focus:border-[#d7fe3b] focus:outline-none" />
          </label>
          <button className={btn} disabled={pending} onClick={() => run(() => addDevicesAction(addCount), () => setShowAdd(false))}>Confirm</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <h2 className="px-4 pt-4 text-sm font-semibold text-zinc-100">Payment history</h2>
        <table className="mt-2 w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
            <tr><th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {p.payments.map((x) => (
              <tr key={x.id}>
                <td className="px-4 py-3 text-zinc-100">{x.invoiceNo}</td>
                <td className="px-4 py-3 text-zinc-300">{x.dateLabel}</td>
                <td className="px-4 py-3 text-zinc-300">{x.description}</td>
                <td className="px-4 py-3 text-zinc-100">₹{x.amountRupees.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 capitalize text-zinc-300">{x.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
