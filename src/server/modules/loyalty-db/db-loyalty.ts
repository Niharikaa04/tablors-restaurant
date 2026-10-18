import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  bills,
  loyaltyBillLinks,
  loyaltyCustomers,
  loyaltyRedemptions,
  loyaltyRewards,
  loyaltySettings,
  loyaltyTransactions,
  payments,
  refunds,
} from "@/server/db/schema";

import {
  DEFAULT_SETTINGS,
  checkRedeemable,
  maskPhone,
  normalizePhone,
  pointsForBill,
  reversalPoints,
  rewardDiscountPaise,
  type LoyaltySettings,
  type RewardRule,
  type RewardType,
} from "./engine";

/**
 * Loyalty ledger on PostgreSQL. Points are NOT money: nothing here touches
 * bills' money movements or the Pots ledger except the redemption discount,
 * which lowers the amount the customer must pay.
 *
 * The ledger is append-only (balance = SUM(points)); every earn / redeem /
 * reversal carries a unique idempotency key, so replays cannot double-credit.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

const SYSTEM = "system";

// ---- settings ---------------------------------------------------------------

export async function getLoyaltySettingsDb(restaurantId: string): Promise<LoyaltySettings> {
  const [row] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.restaurantId, restaurantId));
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    enabled: row.enabled,
    earnSpendPaise: row.earnSpendPaise,
    earnPoints: row.earnPoints,
    excludeGst: row.excludeGst,
    excludeServiceCharge: row.excludeServiceCharge,
    discountBeforePoints: row.discountBeforePoints,
    minBillPaise: row.minBillPaise,
    maxPointsPerBill: row.maxPointsPerBill,
    expiryMonths: row.expiryMonths,
    minPointsToRedeem: row.minPointsToRedeem,
  };
}

export async function saveLoyaltySettingsDb(restaurantId: string, s: LoyaltySettings): Promise<void> {
  await db
    .insert(loyaltySettings)
    .values({ restaurantId, ...s })
    .onConflictDoUpdate({ target: loyaltySettings.restaurantId, set: { ...s, updatedAt: new Date() } });
}

// ---- customers & balances ----------------------------------------------------

export async function findOrCreateCustomerDb(restaurantId: string, rawPhone: unknown) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  await db
    .insert(loyaltyCustomers)
    .values({ id: randomUUID(), restaurantId, phone })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(loyaltyCustomers)
    .where(and(eq(loyaltyCustomers.restaurantId, restaurantId), eq(loyaltyCustomers.phone, phone)));
  return row ?? null;
}

export async function getBalanceDb(restaurantId: string, customerId: string, exec: DbOrTx = db) {
  const [bal] = await exec
    .select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)::int` })
    .from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.restaurantId, restaurantId), eq(loyaltyTransactions.customerId, customerId)));
  const [held] = await exec
    .select({ total: sql<number>`coalesce(sum(${loyaltyRedemptions.points}), 0)::int` })
    .from(loyaltyRedemptions)
    .where(
      and(
        eq(loyaltyRedemptions.restaurantId, restaurantId),
        eq(loyaltyRedemptions.customerId, customerId),
        eq(loyaltyRedemptions.status, "held")
      )
    );
  const balance = bal?.total ?? 0;
  const onHold = held?.total ?? 0;
  return { balance, onHold, available: Math.max(0, balance - onHold) };
}

export async function getLedgerDb(restaurantId: string, customerId: string, limit = 50) {
  return db
    .select()
    .from(loyaltyTransactions)
    .where(and(eq(loyaltyTransactions.restaurantId, restaurantId), eq(loyaltyTransactions.customerId, customerId)))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit);
}

// ---- rewards ----------------------------------------------------------------

export type RewardInput = {
  name: string;
  type: RewardType;
  pointsCost: number;
  valuePaise: number | null;
  percent: number | null;
  maxDiscountPaise: number | null;
  quantity: number | null;
  terms: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

export async function listRewardsDb(restaurantId: string, activeOnly = false) {
  const where = activeOnly
    ? and(eq(loyaltyRewards.restaurantId, restaurantId), eq(loyaltyRewards.active, true))
    : eq(loyaltyRewards.restaurantId, restaurantId);
  return db.select().from(loyaltyRewards).where(where).orderBy(loyaltyRewards.pointsCost);
}

export async function createRewardDb(restaurantId: string, input: RewardInput): Promise<void> {
  await db.insert(loyaltyRewards).values({ id: randomUUID(), restaurantId, ...input });
}

export async function updateRewardDb(restaurantId: string, id: string, input: RewardInput): Promise<void> {
  await db
    .update(loyaltyRewards)
    .set(input)
    .where(and(eq(loyaltyRewards.id, id), eq(loyaltyRewards.restaurantId, restaurantId)));
}

export async function setRewardActiveDb(restaurantId: string, id: string, active: boolean): Promise<void> {
  await db
    .update(loyaltyRewards)
    .set({ active })
    .where(and(eq(loyaltyRewards.id, id), eq(loyaltyRewards.restaurantId, restaurantId)));
}

async function rewardUsage(exec: DbOrTx, restaurantId: string, rewardId: string): Promise<number> {
  const [r] = await exec
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyRedemptions)
    .where(
      and(
        eq(loyaltyRedemptions.restaurantId, restaurantId),
        eq(loyaltyRedemptions.rewardId, rewardId),
        inArray(loyaltyRedemptions.status, ["held", "committed"])
      )
    );
  return r?.n ?? 0;
}

type RewardRow = typeof loyaltyRewards.$inferSelect;

function toRule(r: RewardRow, used: number): RewardRule {
  return {
    type: r.type as RewardType,
    pointsCost: r.pointsCost,
    valuePaise: r.valuePaise,
    percent: r.percent,
    maxDiscountPaise: r.maxDiscountPaise,
    active: r.active,
    validFrom: r.validFrom,
    validTo: r.validTo,
    quantity: r.quantity,
    used,
  };
}

// ---- customer-facing bill view -------------------------------------------------

export type BillLoyaltyView = {
  enabled: boolean;
  identified: boolean;
  phoneMasked: string | null;
  balance: number;
  available: number;
  pointsToEarn: number;
  rewards: {
    id: string;
    name: string;
    type: RewardType;
    pointsCost: number;
    description: string;
    terms: string | null;
    redeemable: boolean;
    reason: string | null;
    discountRupees: number;
  }[];
  applied: { rewardName: string; discountRupees: number; code: string; points: number } | null;
};

function describeReward(r: RewardRow): string {
  switch (r.type) {
    case "fixed_discount":
      return `₹${(r.valuePaise ?? 0) / 100} off your bill`;
    case "percent_discount":
      return `${r.percent ?? 0}% off${r.maxDiscountPaise ? ` (up to ₹${r.maxDiscountPaise / 100})` : ""}`;
    case "free_item":
      return "Free item, ask your server";
    case "coupon":
      return "One-time coupon";
    default:
      return "Special experience";
  }
}

async function loadBill(exec: DbOrTx, restaurantId: string, billId: string, tableId?: string) {
  const conds = [eq(bills.id, billId), eq(bills.restaurantId, restaurantId)];
  if (tableId) conds.push(eq(bills.tableId, tableId));
  const [row] = await exec.select().from(bills).where(and(...conds));
  return row ?? null;
}

export async function getBillLoyaltyViewDb(
  restaurantId: string,
  tableId: string,
  billId: string
): Promise<BillLoyaltyView> {
  const settings = await getLoyaltySettingsDb(restaurantId);
  const empty: BillLoyaltyView = {
    enabled: settings.enabled,
    identified: false,
    phoneMasked: null,
    balance: 0,
    available: 0,
    pointsToEarn: 0,
    rewards: [],
    applied: null,
  };
  if (!settings.enabled) return empty;

  const bill = await loadBill(db, restaurantId, billId, tableId);
  if (!bill) return empty;

  const [link] = await db.select().from(loyaltyBillLinks).where(eq(loyaltyBillLinks.billId, billId));
  if (!link) return empty;

  const [customer] = await db.select().from(loyaltyCustomers).where(eq(loyaltyCustomers.id, link.customerId));
  if (!customer) return empty;

  const { balance, available } = await getBalanceDb(restaurantId, customer.id);
  const [applied] = await db
    .select()
    .from(loyaltyRedemptions)
    .where(and(eq(loyaltyRedemptions.billId, billId), inArray(loyaltyRedemptions.status, ["held", "committed"])));
  let appliedView: BillLoyaltyView["applied"] = null;
  if (applied) {
    const [rw] = await db.select().from(loyaltyRewards).where(eq(loyaltyRewards.id, applied.rewardId));
    appliedView = {
      rewardName: rw?.name ?? "Reward",
      discountRupees: applied.discountPaise / 100,
      code: applied.code,
      points: applied.points,
    };
  }

  const now = new Date();
  const rewardRows = await listRewardsDb(restaurantId, true);
  const rewards: BillLoyaltyView["rewards"] = [];
  for (const r of rewardRows) {
    const rule = toRule(r, await rewardUsage(db, restaurantId, r.id));
    const check = checkRedeemable(rule, available, settings, now);
    rewards.push({
      id: r.id,
      name: r.name,
      type: r.type as RewardType,
      pointsCost: r.pointsCost,
      description: describeReward(r),
      terms: r.terms,
      redeemable: check.ok && !applied && !bill.paidAt,
      reason: check.ok ? (applied ? "A reward is already applied to this bill." : null) : check.reason,
      discountRupees: rewardDiscountPaise(rule, bill.totalPaise) / 100,
    });
  }

  return {
    enabled: true,
    identified: true,
    phoneMasked: maskPhone(customer.phone),
    balance,
    available,
    pointsToEarn: pointsForBill(bill, settings),
    rewards,
    applied: appliedView,
  };
}

// ---- identify / redeem / cancel ------------------------------------------------

export type LoyaltyActionResult = { ok: true } | { ok: false; message: string };

export async function identifyCustomerOnBillDb(
  restaurantId: string,
  tableId: string,
  billId: string,
  rawPhone: unknown
): Promise<LoyaltyActionResult> {
  const settings = await getLoyaltySettingsDb(restaurantId);
  if (!settings.enabled) return { ok: false, message: "The loyalty program is switched off." };

  const bill = await loadBill(db, restaurantId, billId, tableId);
  if (!bill) return { ok: false, message: "Bill not found." };
  if (bill.paidAt) return { ok: false, message: "This bill is already paid." };

  const customer = await findOrCreateCustomerDb(restaurantId, rawPhone);
  if (!customer) return { ok: false, message: "Enter a valid 10-digit mobile number." };
  if (customer.status !== "active") return { ok: false, message: "This loyalty account is unavailable." };

  const [existing] = await db.select().from(loyaltyBillLinks).where(eq(loyaltyBillLinks.billId, billId));
  if (existing && existing.customerId !== customer.id) {
    const [held] = await db
      .select()
      .from(loyaltyRedemptions)
      .where(and(eq(loyaltyRedemptions.billId, billId), eq(loyaltyRedemptions.status, "held")));
    if (held) return { ok: false, message: "Remove the applied reward before changing the number." };
  }

  await db
    .insert(loyaltyBillLinks)
    .values({ billId, restaurantId, customerId: customer.id })
    .onConflictDoUpdate({ target: loyaltyBillLinks.billId, set: { customerId: customer.id } });
  return { ok: true };
}

function redemptionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return "RD-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function holdRedemptionDb(
  restaurantId: string,
  tableId: string,
  billId: string,
  rewardId: string
): Promise<LoyaltyActionResult> {
  const settings = await getLoyaltySettingsDb(restaurantId);

  return db.transaction(async (tx): Promise<LoyaltyActionResult> => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId)))
      .for("update");
    if (!bill) return { ok: false, message: "Bill not found." };
    if (bill.paidAt) return { ok: false, message: "This bill is already paid." };

    const [anyPayment] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.billId, billId)).limit(1);
    if (anyPayment) return { ok: false, message: "Payment has already started on this bill." };

    const [link] = await tx.select().from(loyaltyBillLinks).where(eq(loyaltyBillLinks.billId, billId));
    if (!link) return { ok: false, message: "Enter your mobile number first." };

    const [customer] = await tx.select().from(loyaltyCustomers).where(eq(loyaltyCustomers.id, link.customerId));
    if (!customer || customer.status !== "active") return { ok: false, message: "This loyalty account is unavailable." };

    const [active] = await tx
      .select()
      .from(loyaltyRedemptions)
      .where(and(eq(loyaltyRedemptions.billId, billId), inArray(loyaltyRedemptions.status, ["held", "committed"])));
    if (active) return { ok: false, message: "A reward is already applied to this bill." };

    const [reward] = await tx
      .select()
      .from(loyaltyRewards)
      .where(and(eq(loyaltyRewards.id, rewardId), eq(loyaltyRewards.restaurantId, restaurantId)));
    if (!reward) return { ok: false, message: "Reward not found." };

    const rule = toRule(reward, await rewardUsage(tx, restaurantId, reward.id));
    const { available } = await getBalanceDb(restaurantId, customer.id, tx);
    const check = checkRedeemable(rule, available, settings, new Date());
    if (!check.ok) return { ok: false, message: check.reason };

    const discountPaise = rewardDiscountPaise(rule, bill.totalPaise);

    try {
      await tx.insert(loyaltyRedemptions).values({
        id: randomUUID(),
        restaurantId,
        customerId: customer.id,
        rewardId: reward.id,
        billId,
        points: reward.pointsCost,
        discountPaise,
        status: "held",
        code: redemptionCode(),
      });
    } catch {
      return { ok: false, message: "A reward is already applied to this bill." };
    }

    if (discountPaise > 0) {
      await tx
        .update(bills)
        .set({
          discountPaise: bill.discountPaise + discountPaise,
          totalPaise: bill.totalPaise - discountPaise,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));
    }
    return { ok: true };
  });
}

export async function releaseRedemptionDb(
  restaurantId: string,
  tableId: string,
  billId: string
): Promise<LoyaltyActionResult> {
  return db.transaction(async (tx): Promise<LoyaltyActionResult> => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId)))
      .for("update");
    if (!bill) return { ok: false, message: "Bill not found." };
    if (bill.paidAt) return { ok: false, message: "This bill is already paid." };

    const [held] = await tx
      .select()
      .from(loyaltyRedemptions)
      .where(and(eq(loyaltyRedemptions.billId, billId), eq(loyaltyRedemptions.status, "held")));
    if (!held) return { ok: true };

    await tx.update(loyaltyRedemptions).set({ status: "cancelled" }).where(eq(loyaltyRedemptions.id, held.id));
    if (held.discountPaise > 0) {
      await tx
        .update(bills)
        .set({
          discountPaise: Math.max(0, bill.discountPaise - held.discountPaise),
          totalPaise: bill.totalPaise + held.discountPaise,
          updatedAt: new Date(),
        })
        .where(eq(bills.id, billId));
    }
    return { ok: true };
  });
}

// ---- payment confirmed: commit redemption, earn points ---------------------------

export type SettleResult = { customerId: string; phoneMasked: string; earned: number; balance: number } | null;

/**
 * Called once a bill is fully paid. Idempotent: the redemption commit is a
 * status change guarded by its current state, and every ledger row has a
 * unique key, so webhook replays or double calls cannot credit twice.
 */
export async function settleLoyaltyForBillDb(restaurantId: string, billId: string): Promise<SettleResult> {
  const settings = await getLoyaltySettingsDb(restaurantId);

  return db.transaction(async (tx): Promise<SettleResult> => {
    const bill = await loadBill(tx, restaurantId, billId);
    if (!bill || !bill.paidAt) return null; // never award for unpaid bills

    const [link] = await tx.select().from(loyaltyBillLinks).where(eq(loyaltyBillLinks.billId, billId));
    if (!link) return null;
    const [customer] = await tx.select().from(loyaltyCustomers).where(eq(loyaltyCustomers.id, link.customerId));
    if (!customer || customer.status !== "active") return null;

    const [held] = await tx
      .select()
      .from(loyaltyRedemptions)
      .where(and(eq(loyaltyRedemptions.billId, billId), eq(loyaltyRedemptions.status, "held")))
      .for("update");
    if (held) {
      await tx
        .update(loyaltyRedemptions)
        .set({ status: "committed", committedAt: new Date() })
        .where(eq(loyaltyRedemptions.id, held.id));
      await tx
        .insert(loyaltyTransactions)
        .values({
          id: randomUUID(),
          restaurantId,
          customerId: customer.id,
          type: "REDEEM",
          points: -held.points,
          sourceId: held.id,
          idempotencyKey: `redeem:${held.id}`,
          reason: `Reward redeemed (${held.code})`,
          actor: SYSTEM,
        })
        .onConflictDoNothing();
    }

    const points = pointsForBill(bill, settings);
    let earned = 0;
    if (points > 0) {
      const expiresAt =
        settings.expiryMonths !== null
          ? new Date(new Date(bill.paidAt).setMonth(bill.paidAt.getMonth() + settings.expiryMonths))
          : null;
      const inserted = await tx
        .insert(loyaltyTransactions)
        .values({
          id: randomUUID(),
          restaurantId,
          customerId: customer.id,
          type: "EARN",
          points,
          sourceId: billId,
          idempotencyKey: `earn:${billId}`,
          reason: "Points earned on paid bill",
          actor: SYSTEM,
          expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: loyaltyTransactions.id });
      earned = inserted.length > 0 ? points : 0;
    }

    const { balance } = await getBalanceDb(restaurantId, customer.id, tx);
    return { customerId: customer.id, phoneMasked: maskPhone(customer.phone), earned, balance };
  });
}

/** Takes points back, in proportion, after a refund. Safe to call repeatedly. */
export async function reverseLoyaltyForRefundDb(restaurantId: string, billId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const bill = await loadBill(tx, restaurantId, billId);
    if (!bill) return 0;

    const [earnTx] = await tx
      .select()
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.restaurantId, restaurantId), eq(loyaltyTransactions.idempotencyKey, `earn:${billId}`)));
    if (!earnTx) return 0;

    const [refunded] = await tx
      .select({ total: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::int` })
      .from(refunds)
      .where(eq(refunds.billId, billId));
    const [reversed] = await tx
      .select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)::int` })
      .from(loyaltyTransactions)
      .where(
        and(
          eq(loyaltyTransactions.restaurantId, restaurantId),
          eq(loyaltyTransactions.type, "REFUND_REVERSAL"),
          eq(loyaltyTransactions.sourceId, billId)
        )
      );

    const refundedPaise = refunded?.total ?? 0;
    let delta = reversalPoints({
      earned: earnTx.points,
      alreadyReversed: -(reversed?.total ?? 0),
      refundedPaise,
      paidPaise: bill.totalPaise,
    });
    if (delta <= 0) return 0;

    // Points never go negative: take back at most what the customer still has.
    const { balance } = await getBalanceDb(restaurantId, earnTx.customerId, tx);
    delta = Math.min(delta, Math.max(balance, 0));
    if (delta <= 0) return 0;

    const inserted = await tx
      .insert(loyaltyTransactions)
      .values({
        id: randomUUID(),
        restaurantId,
        customerId: earnTx.customerId,
        type: "REFUND_REVERSAL",
        points: -delta,
        sourceId: billId,
        idempotencyKey: `reverse:${billId}:${refundedPaise}`,
        reason: "Points reversed after a refund",
        actor: SYSTEM,
      })
      .onConflictDoNothing()
      .returning({ id: loyaltyTransactions.id });
    return inserted.length > 0 ? delta : 0;
  });
}

// ---- owner: adjustments, customers, stats ------------------------------------------

export async function adjustPointsDb(
  restaurantId: string,
  customerId: string,
  points: number,
  reason: string,
  actor: string,
  requestId: string
): Promise<LoyaltyActionResult> {
  const cleanReason = reason.trim();
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 100000) {
    return { ok: false, message: "Enter a whole number of points (not zero)." };
  }
  if (cleanReason.length < 3 || cleanReason.length > 200) {
    return { ok: false, message: "A reason of 3 to 200 characters is required." };
  }

  return db.transaction(async (tx): Promise<LoyaltyActionResult> => {
    const [customer] = await tx
      .select()
      .from(loyaltyCustomers)
      .where(and(eq(loyaltyCustomers.id, customerId), eq(loyaltyCustomers.restaurantId, restaurantId)))
      .for("update");
    if (!customer) return { ok: false, message: "Customer not found." };

    const { balance } = await getBalanceDb(restaurantId, customerId, tx);
    if (balance + points < 0) return { ok: false, message: "That would make the balance negative." };

    await tx
      .insert(loyaltyTransactions)
      .values({
        id: randomUUID(),
        restaurantId,
        customerId,
        type: "ADJUST",
        points,
        sourceId: null,
        idempotencyKey: `adjust:${requestId}`,
        reason: cleanReason,
        actor,
      })
      .onConflictDoNothing();
    return { ok: true };
  });
}

export async function setCustomerStatusDb(restaurantId: string, customerId: string, status: "active" | "blocked") {
  await db
    .update(loyaltyCustomers)
    .set({ status })
    .where(and(eq(loyaltyCustomers.id, customerId), eq(loyaltyCustomers.restaurantId, restaurantId)));
}

export async function listCustomersDb(restaurantId: string, limit = 100) {
  const rows = await db
    .select({
      id: loyaltyCustomers.id,
      phone: loyaltyCustomers.phone,
      status: loyaltyCustomers.status,
      createdAt: loyaltyCustomers.createdAt,
      balance: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)::int`,
    })
    .from(loyaltyCustomers)
    .leftJoin(loyaltyTransactions, eq(loyaltyTransactions.customerId, loyaltyCustomers.id))
    .where(eq(loyaltyCustomers.restaurantId, restaurantId))
    .groupBy(loyaltyCustomers.id)
    .orderBy(desc(loyaltyCustomers.createdAt))
    .limit(limit);
  return rows;
}

export async function getLoyaltyStatsDb(restaurantId: string) {
  const [members] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyCustomers)
    .where(eq(loyaltyCustomers.restaurantId, restaurantId));
  const sums = await db
    .select({
      type: loyaltyTransactions.type,
      total: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)::int`,
    })
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.restaurantId, restaurantId))
    .groupBy(loyaltyTransactions.type);
  const by = Object.fromEntries(sums.map((r) => [r.type, r.total])) as Record<string, number>;
  const outstanding = sums.reduce((s, r) => s + r.total, 0);
  return {
    members: members?.n ?? 0,
    issued: by.EARN ?? 0,
    redeemed: Math.abs(by.REDEEM ?? 0),
    reversed: Math.abs(by.REFUND_REVERSAL ?? 0),
    expired: Math.abs(by.EXPIRE ?? 0),
    adjusted: by.ADJUST ?? 0,
    outstanding,
  };
}
