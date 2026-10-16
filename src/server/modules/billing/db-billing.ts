
import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  gte,
  ne,
  notInArray,
} from "drizzle-orm";

import { db } from "@/server/db/client";

import {
  bills,
  orders,
  orderItems,
  orderEvents,
  payments,
  refunds,
  restaurantTables,
} from "@/server/db/schema";

import type {
  Bill,
  Payment,
  Refund,
  BillPaymentSummary,
  PaymentStatus,
  BillInput,
  IssueBillResult,
  OrderStatus,
  RecordPaymentInput,
  RecordPaymentResult,
  RefundResult,
  DailyCollection,
  PaymentMethod,
} from "@/server/modules/demo-store/store";

import {
  BILL_LIMITS,
  METHODS_REQUIRING_REFERENCE,
  PAYMENT_METHODS,
  RESTAURANT_TIME_ZONE,
  isPaymentMethod,
} from "@/server/modules/demo-store/store";

const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{5,39}$/;

type Exec = Pick<typeof db, "select">;
type BillRow = typeof bills.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type RefundRow = typeof refunds.$inferSelect;

// ---- mappers (DB paise → existing rupee-shaped types) ---------------------

function toBill(b: BillRow): Bill {
  return {
    id: b.id,
    orderId: b.orderId,
    tableId: b.tableId,
    subtotalRupees: b.subtotalPaise / 100,
    gstRupees: b.gstPaise / 100,
    discountRupees: b.discountPaise / 100,
    serviceChargeRupees: b.serviceChargePaise / 100,
    totalRupees: b.totalPaise / 100,
    paymentMethod: b.paymentMethod,
    paidAt: b.paidAt ? b.paidAt.getTime() : null,
  };
}

function toPayment(p: PaymentRow, bill: { orderId: string; tableId: string }): Payment {
  return {
    id: p.id,
    billId: p.billId,
    orderId: bill.orderId,
    tableId: bill.tableId,
    method: p.method,
    amountRupees: p.amountPaise / 100,
    transactionId: p.transactionId,
    paidAt: p.createdAt.getTime(),
  };
}

function toRefund(r: RefundRow): Refund {
  return {
    id: r.id,
    paymentId: r.paymentId,
    billId: r.billId,
    amountRupees: r.amountPaise / 100,
    reason: r.reason,
    status: "completed",
    refundedAt: r.createdAt.getTime(),
  };
}

async function summaryFor(exec: Exec, bill: Bill): Promise<BillPaymentSummary> {
  const payRows = await exec.select().from(payments).where(eq(payments.billId, bill.id));
  const refRows = await exec.select().from(refunds).where(eq(refunds.billId, bill.id));

  const billPayments = payRows.map((p) => toPayment(p, bill));
  const billRefunds = refRows.map(toRefund);

  const paid = billPayments.reduce((s, p) => s + p.amountRupees, 0);
  const refunded = billRefunds.reduce((s, r) => s + r.amountRupees, 0);
  const remaining = Math.max(0, bill.totalRupees - paid);

  let status: PaymentStatus;
  if (bill.paidAt === null) status = paid > 0 ? "partial" : "unpaid";
  else status = paid > 0 && refunded >= paid ? "refunded" : "paid";

  return {
    billId: bill.id,
    totalRupees: bill.totalRupees,
    paidRupees: paid,
    refundedRupees: refunded,
    remainingRupees: remaining,
    status,
    payments: billPayments,
    refunds: billRefunds,
  };
}

// ---- reads ----------------------------------------------------------------

export async function listBillsDb(restaurantId: string): Promise<Bill[]> {
  const rows = await db
    .select()
    .from(bills)
    .where(eq(bills.restaurantId, restaurantId))
    .orderBy(desc(bills.createdAt));
  return rows.map(toBill);
}

export async function getBillDb(restaurantId: string, billId: string): Promise<Bill | null> {
  const [row] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)));
  return row ? toBill(row) : null;
}

export async function getBillByOrderIdDb(
  restaurantId: string,
  orderId: string
): Promise<Bill | null> {
  const [row] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.orderId, orderId), eq(bills.restaurantId, restaurantId)));
  return row ? toBill(row) : null;
}

export async function getBillPaymentSummaryDb(
  restaurantId: string,
  billId: string
): Promise<BillPaymentSummary | null> {
  const bill = await getBillDb(restaurantId, billId);
  return bill ? summaryFor(db, bill) : null;
}

export async function isOrderPaidDb(restaurantId: string, orderId: string): Promise<boolean> {
  const bill = await getBillByOrderIdDb(restaurantId, orderId);
  return Boolean(bill?.paymentMethod && bill?.paidAt);
}

// ---- issue bill -----------------------------------------------------------

export async function issueBillDb(
  restaurantId: string,
  orderId: string,
  input: BillInput,
  actorUserId?: string
): Promise<IssueBillResult> {
  return db.transaction(async (tx): Promise<IssueBillResult> => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
      .for("update");

    if (!order) return { ok: false, reason: "not-found" };

    const [existing] = await tx.select().from(bills).where(eq(bills.orderId, order.id));
    if (existing) return { ok: false, reason: "already-billed", bill: toBill(existing) };

    if (order.status !== "served") {
      return { ok: false, reason: "not-served", status: order.status as OrderStatus };
    }

    const [table] = await tx
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, order.tableId),
          eq(restaurantTables.restaurantId, restaurantId)
        )
      );
    if (!table) return { ok: false, reason: "table-mismatch" };

    const { gstPercent, serviceChargePercent, discountRupees } = input;

    if (
      !Number.isFinite(gstPercent) ||
      gstPercent < 0 ||
      gstPercent > BILL_LIMITS.gstMaxPercent
    ) {
      return { ok: false, reason: "invalid-gst" };
    }
    if (
      !Number.isFinite(serviceChargePercent) ||
      serviceChargePercent < 0 ||
      serviceChargePercent > BILL_LIMITS.serviceChargeMaxPercent
    ) {
      return { ok: false, reason: "invalid-service-charge" };
    }
    if (!Number.isInteger(discountRupees) || discountRupees < 0) {
      return { ok: false, reason: "invalid-discount" };
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const subtotal = items.reduce((s, l) => s + (l.qty * l.pricePaise) / 100, 0);
    if (subtotal <= 0) return { ok: false, reason: "empty-order" };

    const gst = Math.round((subtotal * gstPercent) / 100);
    const serviceCharge = Math.round((subtotal * serviceChargePercent) / 100);
    if (discountRupees > subtotal + gst + serviceCharge) {
      return { ok: false, reason: "discount-too-large" };
    }
    const total = Math.max(0, subtotal + gst + serviceCharge - discountRupees);

    const now = new Date();
    const [created] = await tx
      .insert(bills)
      .values({
        id: randomUUID(),
        restaurantId,
        orderId: order.id,
        tableId: order.tableId,
        subtotalPaise: Math.round(subtotal * 100),
        gstPaise: gst * 100,
        discountPaise: discountRupees * 100,
        serviceChargePaise: serviceCharge * 100,
        totalPaise: Math.round(total * 100),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx
      .update(orders)
      .set({ status: "billed", statusUpdatedAt: now, updatedAt: now })
      .where(eq(orders.id, order.id));

    await tx.insert(orderEvents).values({
      id: randomUUID(),
      restaurantId,
      orderId: order.id,
      fromStatus: "served",
      toStatus: "billed",
      actorUserId: actorUserId ?? null,
    });

    return { ok: true, bill: toBill(created) };
  });
}

// ---- record payment -------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

export async function recordBillPaymentDb(
  restaurantId: string,
  billId: string,
  input: RecordPaymentInput
): Promise<RecordPaymentResult> {
  try {
    return await db.transaction(async (tx): Promise<RecordPaymentResult> => {
      const [row] = await tx
        .select()
        .from(bills)
        .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId)))
        .for("update");

      if (!row) return { ok: false, reason: "not-found" };

      const bill = toBill(row);

      if (bill.paidAt !== null || bill.paymentMethod !== null) {
        return { ok: false, reason: "already-paid", bill };
      }

      const method = input.method;
      if (!isPaymentMethod(method)) return { ok: false, reason: "invalid-method" };

      const [order] = await tx.select().from(orders).where(eq(orders.id, bill.orderId));
      const [table] = await tx
        .select()
        .from(restaurantTables)
        .where(eq(restaurantTables.id, bill.tableId));
      if (!order || !table || order.tableId !== bill.tableId) {
        return { ok: false, reason: "table-mismatch" };
      }

      const amount = input.amountRupees;
      if (typeof amount !== "number" || !Number.isInteger(amount)) {
        return { ok: false, reason: "invalid-amount" };
      }

      const before = await summaryFor(tx, bill);

      if (bill.totalRupees === 0) {
        if (amount !== 0) return { ok: false, reason: "invalid-amount" };
      } else {
        if (amount < 1) return { ok: false, reason: "invalid-amount" };
        if (amount > before.remainingRupees) {
          return { ok: false, reason: "overpayment", remainingRupees: before.remainingRupees };
        }
      }

      const rawReference = input.transactionId;
      if (rawReference !== undefined && rawReference !== null && typeof rawReference !== "string") {
        return { ok: false, reason: "invalid-reference" };
      }
      const trimmed = typeof rawReference === "string" ? rawReference.trim() : "";
      const reference = trimmed === "" ? null : trimmed;

      if (reference === null) {
        if (amount > 0 && METHODS_REQUIRING_REFERENCE.includes(method)) {
          return { ok: false, reason: "missing-reference" };
        }
      } else {
        if (!TRANSACTION_ID_PATTERN.test(reference)) {
          return { ok: false, reason: "invalid-reference" };
        }
        const allRefs = await tx
          .select({ t: payments.transactionId })
          .from(payments)
          .where(eq(payments.restaurantId, restaurantId));
        const lower = reference.toLowerCase();
        if (allRefs.some((r) => r.t !== null && r.t.toLowerCase() === lower)) {
          return { ok: false, reason: "duplicate-reference" };
        }
      }

      const now = new Date();
      await tx.insert(payments).values({
        id: randomUUID(),
        restaurantId,
        billId: bill.id,
        method,
        amountPaise: amount * 100,
        status: "paid",
        transactionId: reference,
        createdAt: now,
        updatedAt: now,
      });

      const after = await summaryFor(tx, bill);
      const settled = after.paidRupees >= bill.totalRupees;
      let finalBill = bill;

      if (settled) {
        const totals: Record<PaymentMethod, number> = { cash: 0, qr: 0 };
        let last: PaymentMethod = method;
        for (const p of after.payments) {
          totals[p.method] += p.amountRupees;
          last = p.method;
        }
        let winner: PaymentMethod = last;
        for (const m of PAYMENT_METHODS) if (totals[m] > totals[winner]) winner = m;

        const [updated] = await tx
          .update(bills)
          .set({ paymentMethod: winner, paidAt: now, updatedAt: now })
          .where(eq(bills.id, bill.id))
          .returning();
        finalBill = toBill(updated);

        // Release the table only when nothing else is active on it.
        const active = await tx
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.tableId, bill.tableId),
              notInArray(orders.status, ["billed", "cancelled"])
            )
          )
          .orderBy(desc(orders.createdAt));
        const otherUnsettled = await tx
          .select({ id: bills.id })
          .from(bills)
          .where(and(eq(bills.tableId, bill.tableId), ne(bills.id, bill.id)));
        const unsettled = await Promise.all(
          otherUnsettled.map(async (b) => {
            const [r] = await tx.select({ p: bills.paidAt }).from(bills).where(eq(bills.id, b.id));
            return r?.p === null;
          })
        );

        if (active.length === 0 && !unsettled.some(Boolean)) {
          await tx
            .update(restaurantTables)
            .set({ status: "available", currentOrderId: null, updatedAt: now })
            .where(eq(restaurantTables.id, bill.tableId));
        } else if (active.length > 0) {
          await tx
            .update(restaurantTables)
            .set({ currentOrderId: active[0].id, updatedAt: now })
            .where(eq(restaurantTables.id, bill.tableId));
        }
      }

      const summary = await summaryFor(tx, finalBill);
      const payment = summary.payments[summary.payments.length - 1];
      return { ok: true, bill: finalBill, payment, settled, summary };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "duplicate-reference" };
    throw err;
  }
}

// ---- refunds --------------------------------------------------------------

export async function refundPaymentDb(
  restaurantId: string,
  paymentId: string,
  amountRupees: unknown,
  reason: unknown
): Promise<RefundResult> {
  return db.transaction(async (tx): Promise<RefundResult> => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, paymentId), eq(payments.restaurantId, restaurantId)))
      .for("update");

    const [billRow] = payment
      ? await tx.select().from(bills).where(eq(bills.id, payment.billId))
      : [];

    if (!payment || !billRow) return { ok: false, reason: "not-found" };

    if (typeof amountRupees !== "number" || !Number.isInteger(amountRupees) || amountRupees < 1) {
      return { ok: false, reason: "invalid-amount" };
    }

    const cleanReason = typeof reason === "string" ? reason.trim() : "";
    if (cleanReason.length < 3 || cleanReason.length > 200) {
      return { ok: false, reason: "invalid-reason" };
    }

    const prior = await tx.select().from(refunds).where(eq(refunds.paymentId, payment.id));
    const alreadyRefundedPaise = prior.reduce((s, r) => s + r.amountPaise, 0);
    const refundablePaise = payment.amountPaise - alreadyRefundedPaise;

    if (amountRupees * 100 > refundablePaise) {
      return { ok: false, reason: "exceeds-paid", refundableRupees: refundablePaise / 100 };
    }

    const [created] = await tx
      .insert(refunds)
      .values({
        id: randomUUID(),
        restaurantId,
        paymentId: payment.id,
        billId: billRow.id,
        amountPaise: amountRupees * 100,
        reason: cleanReason,
      })
      .returning();

    return {
      ok: true,
      refund: toRefund(created),
      summary: await summaryFor(tx, toBill(billRow)),
    };
  });
}

// ---- daily collection -----------------------------------------------------

function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: RESTAURANT_TIME_ZONE });
}

export async function getDailyCollectionDb(
  restaurantId: string,
  now: number = Date.now()
): Promise<DailyCollection> {
  const since = new Date(now - 48 * 60 * 60 * 1000);
  const today = dayKey(now);

  const payRows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.restaurantId, restaurantId), gte(payments.createdAt, since)));
  const refRows = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.restaurantId, restaurantId), gte(refunds.createdAt, since)));

  const byMethod: Record<PaymentMethod, number> = { cash: 0, qr: 0 };
  let paymentCount = 0;
  for (const p of payRows) {
    if (p.amountPaise > 0 && dayKey(p.createdAt.getTime()) === today) {
      byMethod[p.method] += p.amountPaise / 100;
      paymentCount += 1;
    }
  }

  let refundedRupees = 0;
  for (const r of refRows) {
    if (dayKey(r.createdAt.getTime()) === today) refundedRupees += r.amountPaise / 100;
  }

  const grossRupees = byMethod.cash + byMethod.qr;
  return {
    dateKey: today,
    byMethod,
    grossRupees,
    refundedRupees,
    netRupees: grossRupees - refundedRupees,
    paymentCount,
  };
}