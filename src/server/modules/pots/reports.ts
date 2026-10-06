import type { Paise } from "./money";
import { DEMO_BUSINESS_ID as B, type PotsRuntime } from "./runtime";
import { istDayBounds } from "./views";

/** Read-only report builders (Pots spec §18). Everything is derived from the ledger, payouts, payroll and audit log. */
const IST = 330 * 60 * 1000;
const dayOf = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);
const monthOf = (d: Date) => dayOf(d).slice(0, 7);
const potName = (rt: PotsRuntime, account: string) => account === "SETTLEMENT" ? "Settlement" : account === "UNALLOCATED" ? "Unallocated" : (rt.pots.find((p) => `POT:${p.id}` === account)?.name ?? account);

export function buildReports(rt: PotsRuntime) {
  const entries = rt.ledger.entries(B);
  const dailySales = new Map<string, Paise>(); const refundsByDay = new Map<string, Paise>();
  const allocByPayment = new Map<string, { at: Date; lines: Record<string, Paise> }>();
  const movement = new Map<string, { inflow: Paise; reversals: Paise; payouts: Paise; adjustments: Paise }>();
  for (const p of rt.pots) movement.set(p.id, { inflow: 0, reversals: 0, payouts: 0, adjustments: 0 });

  for (const e of entries) {
    const day = dayOf(e.createdAt);
    if (e.account === "SETTLEMENT" && e.sourceType === "PAYMENT_RECEIVED") dailySales.set(day, (dailySales.get(day) ?? 0) - e.amount);
    if (e.account === "SETTLEMENT" && e.sourceType === "REFUND_PAYOUT") refundsByDay.set(day, (refundsByDay.get(day) ?? 0) + e.amount);
    if (e.sourceType === "ALLOCATION" && e.account !== "SETTLEMENT") {
      const row = allocByPayment.get(e.sourceId) ?? { at: e.createdAt, lines: {} };
      row.lines[potName(rt, e.account)] = (row.lines[potName(rt, e.account)] ?? 0) + e.amount; allocByPayment.set(e.sourceId, row);
    }
    if (e.account.startsWith("POT:")) {
      const m = movement.get(e.account.slice(4)); if (!m) continue;
      if (e.sourceType === "ALLOCATION") m.inflow += e.amount;
      else if (e.sourceType === "ALLOCATION_REVERSAL") m.reversals += e.amount;
      else if (e.sourceType === "PAYOUT") m.payouts += e.amount;
      else m.adjustments += e.amount; // TRANSFER / ADJUSTMENT
    }
  }
  const payouts = rt.payouts.list(B);
  const byKind: Record<string, { count: number; success: Paise; failed: Paise; pending: Paise }> = {};
  for (const p of payouts) {
    const k = (byKind[p.kind] ??= { count: 0, success: 0, failed: 0, pending: 0 }); k.count++;
    if (p.status === "SUCCESS") k.success += p.amount; else if (p.status === "FAILED") k.failed += p.amount; else if (p.status !== "CANCELLED") k.pending += p.amount;
  }
  const gstId = rt.pots.find((p) => p.type === "GST")?.id; const scId = rt.pots.find((p) => p.type === "SERVICE_CHARGES")?.id;
  const taxByMonth = new Map<string, Paise>();
  if (gstId) for (const e of rt.ledger.potEntries(B, gstId)) taxByMonth.set(monthOf(e.createdAt), (taxByMonth.get(monthOf(e.createdAt)) ?? 0) + e.amount);
  const payroll = rt.payroll.list(B).map((r) => {
    const t = rt.payroll.total(r);
    return { id: r.id, period: r.period, status: r.status, original: t.original, final: t.final, adjustments: r.items.filter((x) => x.adjustments.length).map((x) => ({ name: x.name, from: x.originalPaise, to: x.finalPaise, reason: x.adjustments.at(-1)!.reason })) };
  });
  const [dFrom, dTo] = istDayBounds(new Date());
  const summary = rt.ledger.summary(B, dFrom, dTo, rt.potIds);
  return {
    simulated: true as const,
    dailySales: [...dailySales].sort().reverse().map(([day, amount]) => ({ day, amount, refunds: refundsByDay.get(day) ?? 0 })),
    potMovement: rt.pots.map((p) => ({ pot: p.name, balance: rt.ledger.potBalance(B, p.id), ...movement.get(p.id)! })),
    allocationByPayment: [...allocByPayment].map(([payment, v]) => ({ payment, at: v.at, lines: v.lines })).reverse(),
    payoutsByKind: byKind,
    supplierSpend: payouts.filter((p) => p.kind === "SUPPLIER" && p.status === "SUCCESS").map((p) => ({ id: p.id, to: p.maskedRef, invoice: p.invoiceRef ?? "—", amount: p.amount, at: p.createdAt })),
    profitWithdrawals: payouts.filter((p) => p.kind === "PROFIT" && p.status === "SUCCESS").map((p) => ({ id: p.id, amount: p.amount, fee: p.fee, at: p.createdAt })),
    taxReserveByMonth: [...taxByMonth].sort().reverse().map(([month, amount]) => ({ month, amount })),
    serviceCharges: scId ? { balance: rt.ledger.potBalance(B, scId), inflow: movement.get(scId)!.inflow } : null,
    refunds: [...refundsByDay].reduce((a, [, v]) => a + v, 0),
    payroll,
    providerFees: "Sandbox: no provider fees or settlement batches are simulated.",
    reconciliation: { ...rt.ledger.reconcile(B, rt.potIds), todaysSales: summary.salesInRange, exceptions: rt.payments.exceptions.filter((e) => e.businessId === B) },
    auditTrail: rt.audit.list(B).slice(-25).reverse(),
  };
}

/** GST / Tax reserve workflow (Pots spec §10): reserve by period, source transactions, accountant export. Not a promise of direct tax payment. */
export function buildGstView(rt: PotsRuntime, month?: string) {
  const pot = rt.pots.find((p) => p.type === "GST");
  if (!pot) return null;
  const all = rt.ledger.potEntries(B, pot.id);
  const months = [...new Set(all.map((e) => monthOf(e.createdAt)))].sort().reverse();
  const sel = month && months.includes(month) ? month : months[0];
  const rows = all.filter((e) => monthOf(e.createdAt) === sel).map((e) => ({ id: e.id, at: e.createdAt, sourceType: e.sourceType, sourceId: e.sourceId, amount: e.amount, reason: e.reason ?? "" }));
  return {
    pot, balance: rt.ledger.potBalance(B, pot.id), available: rt.payouts.getAvailable(B, pot.id), month: sel, months,
    reservedInMonth: rows.reduce((a, r) => a + r.amount, 0), rows,
    taxPayouts: rt.payouts.list(B, "TAX"),
    /** No compliant tax-payment integration exists, so only an external-payment workflow is offered. */
    directPaymentAvailable: false as const,
  };
}
export function gstCsv(rt: PotsRuntime, month?: string): string {
  const v = buildGstView(rt, month); if (!v) return "";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return ["date_ist,source_type,source_id,amount_inr,reason", ...v.rows.map((r) => [r.at.toISOString(), r.sourceType, esc(r.sourceId), (r.amount / 100).toFixed(2), esc(r.reason)].join(","))].join("\n");
}

/** Payment Result screen (Pots spec §8.4). */
export function buildPaymentResult(rt: PotsRuntime, providerRef: string) {
  const p = rt.payments.getPayment(providerRef, B); if (!p) return null;
  return {
    providerRef: p.providerRef, billId: p.billId, amount: p.amount, status: p.status, simulated: true as const,
    allocationStatus: p.status !== "SUCCESS" ? "NOT_ALLOCATED" : p.allocation && p.allocation.lines.length ? (p.allocation.unallocated > 0 ? "PARTIAL" : "ALLOCATED") : "UNALLOCATED",
    lines: p.allocation?.lines.map((l) => ({ pot: rt.pots.find((x) => x.id === l.potId)?.name ?? l.potId, amount: l.amount, rule: `${l.ruleKey} v${l.ruleVersion}` })) ?? [],
    unallocated: p.allocation?.unallocated ?? 0, refunded: p.refunded,
  };
}
