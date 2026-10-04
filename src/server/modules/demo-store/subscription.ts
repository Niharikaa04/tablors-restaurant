/**
 * DEMO subscription store (in-memory).
 * PLAN PRICES / DEVICE LIMITS BELOW ARE PLACEHOLDERS - move them to config/DB
 * once pricing is confirmed (see lib/config.ts rule: no hardcoded pricing).
 * Real payments need a gateway (Razorpay etc.); nothing here charges money.
 */

export type PlanId = "starter" | "professional" | "enterprise";

export const PLANS: Record<PlanId, { name: string; monthlyRupees: number; deviceLimit: number }> = {
  starter: { name: "Starter", monthlyRupees: 499, deviceLimit: 10 },
  professional: { name: "Professional", monthlyRupees: 999, deviceLimit: 30 },
  enterprise: { name: "Enterprise", monthlyRupees: 1999, deviceLimit: 100 },
};
export const PLAN_ORDER: PlanId[] = ["starter", "professional", "enterprise"];
export const EXTRA_DEVICE_RUPEES = 30; // placeholder per extra device / month

export interface PaymentRecord {
  id: string;
  invoiceNo: string;
  paidAt: string;
  description: string;
  amountRupees: number;
  status: "paid" | "failed";
}

export interface Subscription {
  restaurantId: string;
  plan: PlanId;
  renewalDate: string; // ISO
  extraDevices: number;
  payments: PaymentRecord[];
}

const g = globalThis as unknown as { __tablorsSubs?: Map<string, Subscription> };
const map = () => (g.__tablorsSubs ??= new Map());

function seed(restaurantId: string): Subscription {
  return {
    restaurantId,
    plan: "professional",
    renewalDate: new Date("2026-09-17T00:00:00+05:30").toISOString(),
    extraDevices: 0,
    payments: [
      { id: "pay_1", invoiceNo: "INV-2026-0008", paidAt: new Date("2026-08-17T10:00:00+05:30").toISOString(), description: "Professional plan - monthly", amountRupees: 999, status: "paid" },
      { id: "pay_2", invoiceNo: "INV-2026-0007", paidAt: new Date("2026-07-17T10:00:00+05:30").toISOString(), description: "Professional plan - monthly", amountRupees: 999, status: "paid" },
    ],
  };
}

export function getSubscription(restaurantId: string): Subscription {
  const m = map();
  if (!m.has(restaurantId)) m.set(restaurantId, seed(restaurantId));
  const s = m.get(restaurantId)!;
  return { ...s, payments: [...s.payments] };
}

export function deviceLimit(s: Subscription): number {
  return PLANS[s.plan].deviceLimit + s.extraDevices;
}
export function monthlyRupees(s: Subscription): number {
  return PLANS[s.plan].monthlyRupees + s.extraDevices * EXTRA_DEVICE_RUPEES;
}

function live(restaurantId: string): Subscription {
  getSubscription(restaurantId);
  return map().get(restaurantId)!;
}

function record(s: Subscription, description: string, amountRupees: number) {
  const n = s.payments.length + 8; // demo invoice counter
  s.payments.unshift({
    id: `pay_${crypto.randomUUID()}`,
    invoiceNo: `INV-2026-${String(n).padStart(4, "0")}`,
    paidAt: new Date().toISOString(),
    description,
    amountRupees,
    status: "paid",
  });
}

export function changePlan(restaurantId: string, plan: PlanId, devicesInUse: number): string | null {
  const s = live(restaurantId);
  if (s.plan === plan) return "You are already on that plan.";
  if (PLANS[plan].deviceLimit + s.extraDevices < devicesInUse) {
    return `You have ${devicesInUse} devices; that plan allows ${PLANS[plan].deviceLimit + s.extraDevices}. Remove devices first.`;
  }
  s.plan = plan;
  return null;
}

export function renew(restaurantId: string): void {
  const s = live(restaurantId);
  const base = Math.max(new Date(s.renewalDate).getTime(), Date.now());
  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  s.renewalDate = next.toISOString();
  record(s, `${PLANS[s.plan].name} plan - monthly renewal`, monthlyRupees(s));
}

export function addDevices(restaurantId: string, count: number): void {
  const s = live(restaurantId);
  s.extraDevices += count;
  record(s, `Add ${count} device${count > 1 ? "s" : ""}`, count * EXTRA_DEVICE_RUPEES);
}
