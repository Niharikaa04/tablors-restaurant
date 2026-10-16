import {
  getBillPaymentSummary,
  getBills,
  getDevices,
  getOrders,
  getTables,
  type Bill,
  type Device,
  type Order,
  type OrderStatus,
  type RestaurantTable,
} from "./store";

/** How long a just-settled bill shows as "Paid" before the card returns to Available. */
export const PAID_FLASH_MS = 10_000;

/** Battery bar colours (display only; notification rules are separate). */
export const BATTERY_LOW_AT_OR_BELOW = 30;
export const BATTERY_CRITICAL_BELOW = 15;

export type BatteryTone = "ok" | "low" | "critical";

export function batteryTone(percent: number): BatteryTone {
  if (percent < BATTERY_CRITICAL_BELOW) return "critical";
  if (percent <= BATTERY_LOW_AT_OR_BELOW) return "low";
  return "ok";
}

export type TableDisplayState =
  | "available"
  | "reserved"
  | "seated"
  | "order-placed"
  | "preparing"
  | "ready"
  | "eating"
  | "bill-issued"
  | "part-paid"
  | "paid";

export const TABLE_STATE_LABEL: Record<TableDisplayState, string> = {
  available: "Available",
  reserved: "Reserved",
  seated: "Seated",
  "order-placed": "Order placed",
  preparing: "Preparing",
  ready: "Ready to serve",
  eating: "Eating",
  "bill-issued": "Bill issued",
  "part-paid": "Part paid",
  paid: "Paid",
};

export type TableItem = { key: string; name: string; qty: number };

export type TableActivity = {
  table: RestaurantTable;
  state: TableDisplayState;
  label: string;
  items: TableItem[];
  itemCount: number;
  /** Items total while ordering/eating; bill total (incl. tax) once billed. */
  totalRupees: number;
  bill: Bill | null;
  paidRupees: number;
  dueRupees: number;
  device: Device | null;
};

type ActiveStatus = Exclude<OrderStatus, "billed">;

const ORDER_STATE: Record<ActiveStatus, TableDisplayState> = {
  new: "order-placed",
  preparing: "preparing",
  ready: "ready",
  served: "eating",
};

/** The earliest stage wins, so the card shows what still needs attention. */
const ORDER_PRIORITY: ActiveStatus[] = ["new", "preparing", "ready", "served"];

function mergeItems(orders: Order[]): TableItem[] {
  const merged = new Map<string, TableItem>();

  for (const order of orders) {
    for (const line of order.lines) {
      const key = line.itemId ?? line.code;
      const existing = merged.get(key);

      if (existing) {
        existing.qty += line.qty;
      } else {
        merged.set(key, { key, name: line.name, qty: line.qty });
      }
    }
  }

  return Array.from(merged.values());
}

export function getTableActivities(now: number = Date.now()): TableActivity[] {
  const orders = getOrders();
  const bills = getBills();
  const devices = getDevices();

  return getTables().map((table) => {
    const activeOrders = orders.filter(
      (o) => o.tableId === table.id && o.status !== "billed"
    );

    const unsettled = bills.filter(
      (b) => b.tableId === table.id && b.paidAt === null
    );
    const openBill = unsettled.length > 0 ? unsettled[unsettled.length - 1] : null;

    const justPaid =
      bills
        .filter(
          (b) =>
            b.tableId === table.id &&
            b.paidAt !== null &&
            now - b.paidAt < PAID_FLASH_MS
        )
        .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))[0] ?? null;

    let state: TableDisplayState;
    let shownOrders: Order[];
    let shownBill: Bill | null = null;

    if (activeOrders.length > 0) {
      const status = ORDER_PRIORITY.find((s) =>
        activeOrders.some((o) => o.status === s)
      );
      state = ORDER_STATE[status ?? "new"];
      shownOrders = activeOrders;
    } else if (openBill) {
      shownBill = openBill;
      shownOrders = orders.filter((o) => o.id === openBill.orderId);
      state =
        getBillPaymentSummary(openBill).paidRupees > 0 ? "part-paid" : "bill-issued";
    } else if (justPaid) {
      shownBill = justPaid;
      shownOrders = orders.filter((o) => o.id === justPaid.orderId);
      state = "paid";
    } else {
      shownOrders = [];
      state =
        table.status === "occupied"
          ? "seated"
          : table.status === "reserved"
            ? "reserved"
            : "available";
    }

    const items = mergeItems(shownOrders);
    const itemsTotal = shownOrders.reduce(
      (sum, o) => sum + o.lines.reduce((s, l) => s + l.qty * l.priceRupees, 0),
      0
    );
    const summary = shownBill ? getBillPaymentSummary(shownBill) : null;

    return {
      table,
      state,
      label: TABLE_STATE_LABEL[state],
      items,
      itemCount: items.reduce((sum, i) => sum + i.qty, 0),
      totalRupees: shownBill ? shownBill.totalRupees : itemsTotal,
      bill: shownBill,
      paidRupees: summary?.paidRupees ?? 0,
      dueRupees: summary?.remainingRupees ?? 0,
      device: devices.find((d) => d.tableId === table.id) ?? null,
    };
  });
}