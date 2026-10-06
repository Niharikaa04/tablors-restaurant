"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDemoRole } from "@/server/modules/auth/session";
import {
  acknowledgeWaiterCall,
  callWaiterForTable,
  createDemoOrder,
  getBillByOrderId,
  getMenuItemByCode,
  getMenuItemById,
  getTableById,
  transitionOrder,
  type MenuItem,
  type OrderLine,
  type OrderStatus,
} from "@/server/modules/demo-store/store";
import { getEffectivePrice } from "@/lib/menu-shared";
import { notify } from "@/server/modules/notifications/store";

export type AdvanceFailureCode =
  | "forbidden"
  | "invalid"
  | "missing"
  | "stale"
  | "served"
  | "billed";

export type AdvanceOrderResult =
  | { ok: true }
  | { ok: false; error: string; code: AdvanceFailureCode };

const STAFF_ROLES: ReadonlyArray<string> = ["owner", "kitchen", "admin"];

const ORDER_STATUSES: ReadonlyArray<string> = [
  "new",
  "preparing",
  "ready",
  "served",
  "billed",
];

const ADVANCE_ERRORS: Record<AdvanceFailureCode, string> = {
  forbidden: "Not authorized to update order status.",
  invalid: "Invalid order update request.",
  missing: "Order not found.",
  stale:
    "This order was already updated by someone else. Showing its latest status.",
  served:
    "This order is already served. Billing is a separate step — use Billing.",
  billed: "This order has already been billed.",
};

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value);
}

function fail(code: AdvanceFailureCode): AdvanceOrderResult {
  return { ok: false, code, error: ADVANCE_ERRORS[code] };
}

function revalidateOrderSurfaces(): void {
  revalidatePath("/owner/orders");
  revalidatePath("/owner/tables");
  revalidatePath("/owner/billing");
  revalidatePath("/owner");
  revalidatePath("/kitchen");
}

/**
 * Moves an order one step through the kitchen flow
 * (new → preparing → ready → served). It can never reach "billed":
 * billing is a separate operation (generateBill).
 *
 * Staff-only. Called from owner <form> buttons and directly from the
 * kitchen display, so the role check lives here on the server.
 *
 * `expectedStatus` (optional) is the status the caller saw on screen.
 * If the order has moved on since, nothing changes and a "stale"
 * failure is returned, so a double click can't skip a step.
 */
export async function advanceOrder(
  orderId: string,
  expectedStatus?: OrderStatus
): Promise<AdvanceOrderResult> {
  const role = await getDemoRole();

  if (role === null || !STAFF_ROLES.includes(role)) {
    return fail("forbidden");
  }

  if (typeof orderId !== "string" || orderId.trim() === "") {
    return fail("invalid");
  }

  if (expectedStatus !== undefined && !isOrderStatus(expectedStatus)) {
    return fail("invalid");
  }

  const result = transitionOrder(orderId.trim(), expectedStatus);

  // Revalidate on failures too, so a stale screen picks up the latest state.
  revalidateOrderSurfaces();

  if (result.ok) {
    return { ok: true };
  }

  if (result.reason === "not-found") {
    return fail("missing");
  }

  if (result.reason === "already-served") {
    return fail("served");
  }

  if (result.reason === "already-billed") {
    return fail("billed");
  }

  return fail("stale");
}

/**
 * <form action> wrapper for the Owner Live Orders page. Reads the hidden
 * orderId / expectedStatus fields and, on failure, redirects back with a
 * notice code so the failure is visible instead of silent.
 */
export async function advanceOrderFromForm(formData: FormData): Promise<void> {
  const orderId = formData.get("orderId");
  const expected = formData.get("expectedStatus");

  if (expected !== null && !isOrderStatus(expected)) {
    redirect("/owner/orders?notice=invalid");
  }

  const result = await advanceOrder(
    typeof orderId === "string" ? orderId : "",
    expected ?? undefined
  );

  if (!result.ok) {
    redirect(`/owner/orders?notice=${result.code}`);
  }
}

export type PlaceOrderInput = {
  tableId: string;
  /** `itemId` (stable id) is preferred when the client has it, so a cart
   * survives the owner editing an item's code; `code` alone still works
   * for keypad / direct requests. Price is NEVER accepted from the client. */
  lines: { code: string; qty: number; itemId?: string }[];
};

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const MAX_LINE_QTY = 99;

export async function placeCustomerOrder(
  input: PlaceOrderInput
): Promise<PlaceOrderResult> {
  const table = getTableById(input.tableId);

  if (!table) {
    return { ok: false, error: "Table not found." };
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

  // Everything below runs against the LIVE canonical menu at the moment
  // of checkout, so a cart built before the owner changed availability or
  // price is revalidated here — the browser's copy is never trusted.
  const problems: string[] = [];
  const merged = new Map<string, { item: MenuItem; qty: number }>();

  for (const line of input.lines) {
    if (!Number.isInteger(line?.qty) || line.qty < 1 || line.qty > MAX_LINE_QTY) {
      problems.push(`Quantity must be a whole number from 1 to ${MAX_LINE_QTY}.`);
      continue;
    }

    const item =
      typeof line.itemId === "string" && line.itemId
        ? getMenuItemById(line.itemId)
        : getMenuItemByCode(String(line.code));

    if (!item) {
      problems.push(`Item ${line.code} is no longer on the menu — please remove it.`);
      continue;
    }

    if (!item.available) {
      problems.push(`${item.name} just became unavailable — please remove it.`);
      continue;
    }

    const existing = merged.get(item.id);
    if (existing) existing.qty += line.qty;
    else merged.set(item.id, { item, qty: line.qty });
  }

  if (problems.length > 0) {
    // Reject the whole order rather than silently dropping items.
    return { ok: false, error: Array.from(new Set(problems)).join(" ") };
  }

  const orderLines: OrderLine[] = [];
  for (const { item, qty } of merged.values()) {
    if (qty > MAX_LINE_QTY) {
      return { ok: false, error: `${item.name}: quantity can't exceed ${MAX_LINE_QTY}.` };
    }
    // Snapshot of the item as it is RIGHT NOW. Later menu edits never
    // reach these fields.
    orderLines.push({
      code: item.code,
      name: item.name,
      qty,
      priceRupees: getEffectivePrice(item),
      itemId: item.id,
      category: item.category,
      prepMinutes: item.prepMinutes,
      basePriceRupees: item.priceRupees,
      discountPercent: item.discountPercent,
    });
  }

  if (orderLines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }

const order = createDemoOrder(input.tableId, orderLines);

// Create a real-time notification for the kitchen and owner.
notify({
  type: "ORDER_NEW",
  title: "New order received",
  message: `New order received from Table ${input.tableId}.`,
  tableId: input.tableId,
  orderId: order.id,
  dedupeKey: `order-new:${order.id}`,
});

revalidatePath("/owner/orders");
revalidatePath("/owner/tables");
revalidatePath("/kitchen");
revalidatePath("/owner/notifications");

return {
  ok: true,
  orderId: order.id,
};
}

export type CallWaiterResult = { ok: true } | { ok: false; error: string };

export async function callWaiter(tableId: string): Promise<CallWaiterResult> {
  const table = getTableById(tableId);
  if (!table) {
    return { ok: false, error: "Table not found." };
  }

  callWaiterForTable(tableId);
  revalidatePath("/owner/orders");

  return { ok: true };
}

export async function acknowledgeWaiter(tableId: string): Promise<void> {
  const role = await getDemoRole();

  // Clearing a waiter call is a staff action.
  if (role === null || !STAFF_ROLES.includes(role)) {
    return;
  }

  acknowledgeWaiterCall(tableId);
  revalidatePath("/owner/orders");
}

export type OrderPaymentStatus = {
  paid: boolean;
};

export async function checkOrderPaymentStatus(
  orderId: string
): Promise<OrderPaymentStatus> {
  const bill = getBillByOrderId(orderId);

  return {
    paid: Boolean(bill?.paymentMethod && bill?.paidAt),
  };
}