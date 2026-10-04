/**
 * DEMO DATA STORE — Phase "V1 demo" only.
 *
 * This is an in-memory stand-in for the real Postgres schema (Phase 2).
 * It exists so the owner/kitchen/admin screens can be demoed end-to-end
 * before the database, auth, and RBAC are built. It is NOT production
 * data: it resets whenever the server restarts and holds no real
 * restaurant, guest, or payment information.
 *
 * When Phase 2 lands, every function below gets a matching Drizzle
 * implementation with the same signature, and callers (server actions,
 * route handlers) do not need to change.
 */

export type MenuItem = {
  /** Stable internal identity. Never changes, even when the owner edits
   * the item code — order lines reference this so history survives edits. */
  id: string;
  /** Owner-assigned, unique among active items. Used for keypad ordering. */
  code: string;
  name: string;
  description: string;
  category: string;
  /** Base (list) price. Never overwritten by a discount. */
  priceRupees: number;
  veg: boolean;
  available: boolean;
  prepMinutes: number;
  /** Served by /api/menu-image/[id]; null when the item has no image. */
  imageUrl: string | null;
  isSpecial: boolean;
  /** 0 = no discount. Effective price = getEffectivePrice(item). */
  discountPercent: number;
  /** Set when an item that appears in past orders is "deleted". Archived
   * items are hidden from every menu surface and cannot be ordered, but
   * remain here so historical orders keep resolving. */
  archivedAt: number | null;
};

export type TableStatus = "available" | "occupied" | "reserved";

export type RestaurantTable = {
  id: string;
  label: string;
  status: TableStatus;
  currentOrderId: string | null;
  // Call Waiter (customer device button). Table-scoped rather than
  // order-scoped, since a guest can call the waiter before any order
  // exists yet. Owner acknowledges to clear it.
  waiterCalled: boolean;
  waiterCalledAt: number | null;
};

export type OrderStatus = "new" | "preparing" | "ready" | "served" | "billed";

export type OrderLine = {
  code: string;
  name: string;
  qty: number;
  /** Price actually charged per unit (already net of any discount).
   * Snapshot taken when the order was placed — never re-derived. */
  priceRupees: number;
  // ---- Snapshot of the menu item at order time (all optional so older
  // lines stay valid). Menu edits never touch these. ----
  /** Stable MenuItem.id — survives code edits. */
  itemId?: string;
  category?: string;
  prepMinutes?: number;
  basePriceRupees?: number;
  discountPercent?: number;
};

export type Order = {
  id: string;
  tableId: string;
  lines: OrderLine[];
  status: OrderStatus;
  createdAt: number;
  // When `status` last changed. Seeded equal to createdAt; every real
  // transition (advanceOrderStatus, generateBill) updates it. Lets the
  // UI show real "time in current status" (e.g. "Ready 2 min ago")
  // instead of reusing createdAt, which only ever means order age.
  statusUpdatedAt: number;
};

export type Device = {
  id: string;
  tableId: string;
  online: boolean;
  batteryPercent: number;
  lastSeenMinutesAgo: number;
};

export type Bill = {
  id: string;
  orderId: string;
  tableId: string;
  subtotalRupees: number;
  gstRupees: number;
  discountRupees: number;
  serviceChargeRupees: number;
  totalRupees: number;
  paymentMethod: "cash" | "upi" | "card" | null;
  paidAt: number | null;
};

export type DemoLead = {
  id: string;
  restaurantName: string;
  ownerName: string;
  phone: string;
  email: string;
  city: string;
  tableCount: number;
  restaurantType: string;
  receivedAt: number;
};

// ---- Seed data -----------------------------------------------------

type SeedMenuItem = Pick<
  MenuItem,
  "code" | "name" | "category" | "priceRupees" | "veg" | "available" | "prepMinutes"
>;

const menuSeed: SeedMenuItem[] = [
  // ---- Starters -------------------------------------------------
  { code: "001", name: "Veg Spring Roll", category: "Starters", priceRupees: 180, veg: true, available: true, prepMinutes: 12 },
  { code: "002", name: "Paneer Tikka", category: "Starters", priceRupees: 260, veg: true, available: true, prepMinutes: 15 },
  { code: "003", name: "Chicken Tikka", category: "Starters", priceRupees: 280, veg: false, available: true, prepMinutes: 18 },
  { code: "004", name: "Chilli Paneer", category: "Starters", priceRupees: 240, veg: true, available: true, prepMinutes: 14 },
  { code: "006", name: "Fish Fingers", category: "Starters", priceRupees: 300, veg: false, available: true, prepMinutes: 15 },
  { code: "009", name: "Chicken Lollipop", category: "Starters", priceRupees: 260, veg: false, available: true, prepMinutes: 16 },

  // ---- Soups ------------------------------------------------------
  { code: "020", name: "Tomato Soup", category: "Soups", priceRupees: 120, veg: true, available: true, prepMinutes: 10 },
  { code: "021", name: "Sweet Corn Soup", category: "Soups", priceRupees: 130, veg: true, available: true, prepMinutes: 10 },
  { code: "022", name: "Hot & Sour Soup", category: "Soups", priceRupees: 140, veg: true, available: true, prepMinutes: 12 },
  { code: "023", name: "Chicken Clear Soup", category: "Soups", priceRupees: 150, veg: false, available: true, prepMinutes: 12 },
  { code: "024", name: "Mutton Soup", category: "Soups", priceRupees: 180, veg: false, available: true, prepMinutes: 15 },

  // ---- Veg Main Course ---------------------------------------------
  { code: "040", name: "Paneer Butter Masala", category: "Veg Main Course", priceRupees: 280, veg: true, available: true, prepMinutes: 18 },
  { code: "041", name: "Kadai Paneer", category: "Veg Main Course", priceRupees: 270, veg: true, available: true, prepMinutes: 18 },
  { code: "042", name: "Palak Paneer", category: "Veg Main Course", priceRupees: 260, veg: true, available: true, prepMinutes: 16 },
  { code: "043", name: "Malai Kofta", category: "Veg Main Course", priceRupees: 290, veg: true, available: false, prepMinutes: 20 },
  { code: "046", name: "Dal Makhani", category: "Veg Main Course", priceRupees: 220, veg: true, available: true, prepMinutes: 20 },
  { code: "114", name: "Dal Tadka", category: "Veg Main Course", priceRupees: 200, veg: true, available: true, prepMinutes: 12 },

  // ---- Chicken ------------------------------------------------------
  { code: "008", name: "Chicken 65", category: "Chicken", priceRupees: 320, veg: false, available: true, prepMinutes: 16 },
  { code: "082", name: "Chilli Chicken", category: "Chicken", priceRupees: 300, veg: false, available: false, prepMinutes: 15 },
  { code: "099", name: "Pepper Chicken", category: "Chicken", priceRupees: 280, veg: false, available: true, prepMinutes: 15 },
  { code: "060", name: "Butter Chicken", category: "Chicken", priceRupees: 340, veg: false, available: true, prepMinutes: 20 },
  { code: "061", name: "Chicken Curry", category: "Chicken", priceRupees: 300, veg: false, available: true, prepMinutes: 18 },
  { code: "064", name: "Chicken Tikka Masala", category: "Chicken", priceRupees: 350, veg: false, available: true, prepMinutes: 20 },

  // ---- Mutton ------------------------------------------------------
  { code: "080", name: "Mutton Curry", category: "Mutton", priceRupees: 380, veg: false, available: true, prepMinutes: 25 },
  { code: "081", name: "Mutton Rogan Josh", category: "Mutton", priceRupees: 420, veg: false, available: true, prepMinutes: 30 },
  { code: "083", name: "Kadai Mutton", category: "Mutton", priceRupees: 400, veg: false, available: true, prepMinutes: 28 },
  { code: "084", name: "Mutton Fry", category: "Mutton", priceRupees: 390, veg: false, available: true, prepMinutes: 25 },

  // ---- Seafood -----------------------------------------------------
  { code: "095", name: "Fish Curry", category: "Seafood", priceRupees: 340, veg: false, available: true, prepMinutes: 20 },
  { code: "096", name: "Fish Fry", category: "Seafood", priceRupees: 320, veg: false, available: true, prepMinutes: 18 },
  { code: "097", name: "Prawn Masala", category: "Seafood", priceRupees: 380, veg: false, available: true, prepMinutes: 20 },
  { code: "098", name: "Apollo Fish", category: "Seafood", priceRupees: 350, veg: false, available: false, prepMinutes: 20 },
  { code: "101", name: "Prawn Fry", category: "Seafood", priceRupees: 360, veg: false, available: true, prepMinutes: 18 },

  // ---- Biryanis & Rice ------------------------------------------------
  { code: "055", name: "Veg Biryani", category: "Biryanis & Rice", priceRupees: 250, veg: true, available: true, prepMinutes: 18 },
  { code: "111", name: "Chicken Biryani", category: "Biryanis & Rice", priceRupees: 320, veg: false, available: true, prepMinutes: 25 },
  { code: "112", name: "Mutton Biryani", category: "Biryanis & Rice", priceRupees: 400, veg: false, available: true, prepMinutes: 30 },
  { code: "116", name: "Jeera Rice", category: "Biryanis & Rice", priceRupees: 150, veg: true, available: true, prepMinutes: 12 },
  { code: "117", name: "Ghee Rice", category: "Biryanis & Rice", priceRupees: 160, veg: true, available: true, prepMinutes: 12 },
  { code: "118", name: "Curd Rice", category: "Biryanis & Rice", priceRupees: 140, veg: true, available: true, prepMinutes: 10 },

  // ---- Breads --------------------------------------------------------
  { code: "125", name: "Butter Naan", category: "Breads", priceRupees: 45, veg: true, available: true, prepMinutes: 6 },
  { code: "126", name: "Plain Naan", category: "Breads", priceRupees: 35, veg: true, available: true, prepMinutes: 6 },
  { code: "127", name: "Garlic Naan", category: "Breads", priceRupees: 55, veg: true, available: true, prepMinutes: 7 },
  { code: "128", name: "Tandoori Roti", category: "Breads", priceRupees: 30, veg: true, available: true, prepMinutes: 6 },
  { code: "129", name: "Laccha Paratha", category: "Breads", priceRupees: 50, veg: true, available: true, prepMinutes: 8 },
  { code: "130", name: "Kulcha", category: "Breads", priceRupees: 45, veg: true, available: true, prepMinutes: 7 },

  // ---- Chinese ---------------------------------------------------
  { code: "141", name: "Veg Fried Rice", category: "Chinese", priceRupees: 200, veg: true, available: true, prepMinutes: 12 },
  { code: "142", name: "Chicken Fried Rice", category: "Chinese", priceRupees: 240, veg: false, available: true, prepMinutes: 15 },
  { code: "143", name: "Veg Hakka Noodles", category: "Chinese", priceRupees: 200, veg: true, available: true, prepMinutes: 12 },
  { code: "144", name: "Chicken Hakka Noodles", category: "Chinese", priceRupees: 240, veg: false, available: true, prepMinutes: 15 },
  { code: "145", name: "Chicken Manchurian", category: "Chinese", priceRupees: 280, veg: false, available: true, prepMinutes: 16 },
  { code: "147", name: "Chilli Fish", category: "Chinese", priceRupees: 320, veg: false, available: false, prepMinutes: 18 },

  // ---- Desserts --------------------------------------------------
  { code: "160", name: "Gulab Jamun", category: "Desserts", priceRupees: 90, veg: true, available: true, prepMinutes: 5 },
  { code: "161", name: "Rasmalai", category: "Desserts", priceRupees: 110, veg: true, available: false, prepMinutes: 5 },
  { code: "162", name: "Ice Cream", category: "Desserts", priceRupees: 80, veg: true, available: true, prepMinutes: 3 },
  { code: "163", name: "Gajar Halwa", category: "Desserts", priceRupees: 120, veg: true, available: true, prepMinutes: 8 },
  { code: "164", name: "Kheer", category: "Desserts", priceRupees: 100, veg: true, available: true, prepMinutes: 10 },

  // ---- Beverages ---------------------------------------------------
  { code: "175", name: "Masala Chai", category: "Beverages", priceRupees: 40, veg: true, available: true, prepMinutes: 5 },
  { code: "176", name: "Filter Coffee", category: "Beverages", priceRupees: 45, veg: true, available: true, prepMinutes: 5 },
  { code: "177", name: "Fresh Lime Soda", category: "Beverages", priceRupees: 60, veg: true, available: true, prepMinutes: 4 },
  { code: "178", name: "Mango Lassi", category: "Beverages", priceRupees: 90, veg: true, available: true, prepMinutes: 5 },
  { code: "179", name: "Buttermilk", category: "Beverages", priceRupees: 50, veg: true, available: true, prepMinutes: 3 },
];

/** The single canonical menu. Owner, Kitchen, Customer and the table
 * device all read this array (via getMenu()). Includes archived items;
 * every public read filters them out. */
const menu: MenuItem[] = menuSeed.map((m, i) => ({
  ...m,
  id: `m${i + 1}`,
  description: "",
  imageUrl: null,
  isSpecial: false,
  discountPercent: 0,
  archivedAt: null,
}));
let menuIdCounter = menu.length;

/** In-memory image bytes, keyed by MenuItem.id. Demo storage only —
 * resets with the server, exactly like the rest of this store. */
const menuImages = new Map<string, { mime: string; bytes: Uint8Array; version: number }>();

const tables: RestaurantTable[] = [
  { id: "t01", label: "Table 01", status: "available", currentOrderId: null, waiterCalled: false, waiterCalledAt: null },
  { id: "t02", label: "Table 02", status: "occupied", currentOrderId: "o1", waiterCalled: false, waiterCalledAt: null },
  { id: "t03", label: "Table 03", status: "reserved", currentOrderId: null, waiterCalled: false, waiterCalledAt: null },
  { id: "t04", label: "Table 04", status: "available", currentOrderId: null, waiterCalled: false, waiterCalledAt: null },
  { id: "t05", label: "Table 05", status: "occupied", currentOrderId: "o2", waiterCalled: false, waiterCalledAt: null },
  { id: "t06", label: "Table 06", status: "available", currentOrderId: null, waiterCalled: false, waiterCalledAt: null },
];

const orders: Order[] = [
  {
    id: "o1",
    tableId: "t02",
    status: "preparing",
    createdAt: Date.now() - 6 * 60 * 1000,
    statusUpdatedAt: Date.now() - 6 * 60 * 1000,
    lines: [
      { code: "099", name: "Pepper Chicken", qty: 2, priceRupees: 280 },
      { code: "125", name: "Butter Naan", qty: 3, priceRupees: 45 },
    ],
  },
  {
    id: "o2",
    tableId: "t05",
    status: "new",
    createdAt: Date.now() - 1 * 60 * 1000,
    statusUpdatedAt: Date.now() - 1 * 60 * 1000,
    lines: [
      { code: "055", name: "Veg Biryani", qty: 1, priceRupees: 250 },
      { code: "114", name: "Dal Tadka", qty: 2, priceRupees: 200 },
      { code: "008", name: "Chicken 65", qty: 1, priceRupees: 320 },
    ],
  },
];

// Backfill the order-time snapshot on the seeded lines, exactly as
// placeCustomerOrder does for live orders.
for (const order of orders) {
  for (const line of order.lines) {
    const item = menu.find((m) => m.code === line.code);
    if (!item) continue;
    line.itemId = item.id;
    line.category = item.category;
    line.prepMinutes = item.prepMinutes;
    line.basePriceRupees = line.priceRupees;
    line.discountPercent = 0;
  }
}

const devices: Device[] = [
  { id: "d01", tableId: "t01", online: true, batteryPercent: 82, lastSeenMinutesAgo: 1 },
  { id: "d02", tableId: "t02", online: true, batteryPercent: 64, lastSeenMinutesAgo: 1 },
  { id: "d03", tableId: "t03", online: false, batteryPercent: 12, lastSeenMinutesAgo: 47 },
  { id: "d04", tableId: "t04", online: true, batteryPercent: 91, lastSeenMinutesAgo: 2 },
  { id: "d05", tableId: "t05", online: true, batteryPercent: 55, lastSeenMinutesAgo: 1 },
  { id: "d06", tableId: "t06", online: false, batteryPercent: 0, lastSeenMinutesAgo: 190 },
];

const bills: Bill[] = [];
const leads: DemoLead[] = [];

let orderCounter = orders.length;
let billCounter = 0;
let leadCounter = 0;

// ---- Reads -----------------------------------------------------------

/**
 * Returns every restaurant table.
 *
 * This is the canonical table list used by the owner, kitchen,
 * billing, orders, devices, and dashboard table-status views.
 */
export function getTables(): RestaurantTable[] {
  return tables;
}

/** Active (non-archived) menu — the one list every surface renders. */
export function getMenu() {
  return menu.filter((m) => m.archivedAt === null);
}

export function getMenuItemById(id: string): MenuItem | null {
  return menu.find((m) => m.id === id && m.archivedAt === null) ?? null;
}

/** Active item that currently owns `code` (archived items never own one). */
export function getMenuItemByCode(code: string): MenuItem | null {
  return menu.find((m) => m.code === code && m.archivedAt === null) ?? null;
}

/** Resolve the menu item an order line was placed against — by stable id
 * when the line has one, falling back to code only for legacy lines. */
export function getMenuItemForLine(line: OrderLine): MenuItem | null {
  if (line.itemId) return menu.find((m) => m.id === line.itemId) ?? null;
  return getMenuItemByCode(line.code);
}

/** How many order lines reference each menu item (by stable id). */
export function getMenuItemUsage(): Record<string, number> {
  const usage: Record<string, number> = {};
  for (const order of orders) {
    for (const line of order.lines) {
      const id = line.itemId ?? getMenuItemByCode(line.code)?.id;
      if (id) usage[id] = (usage[id] ?? 0) + 1;
    }
  }
  return usage;
}

export function getMenuImage(id: string) {
  const item = menu.find((m) => m.id === id && m.archivedAt === null);
  if (!item) return null;
  return menuImages.get(id) ?? null;
}

export type CreateTableResult =
  | {
      ok: true;
      table: RestaurantTable;
    }
  | {
      ok: false;
      reason: "invalid-label" | "duplicate-label";
    };

export function createRestaurantTable(
  label: string
): CreateTableResult {
  const normalizedLabel = label.trim();

  if (!normalizedLabel) {
    return {
      ok: false,
      reason: "invalid-label",
    };
  }

  const duplicate = tables.some(
    (table) =>
      table.label.toLowerCase() ===
      normalizedLabel.toLowerCase()
  );

  if (duplicate) {
    return {
      ok: false,
      reason: "duplicate-label",
    };
  }

  const nextNumber =
    tables.reduce((max, table) => {
      const match = table.id.match(/^t(\d+)$/);

      if (!match) {
        return max;
      }

      return Math.max(
        max,
        Number(match[1])
      );
    }, 0) + 1;

  const id = `t${String(nextNumber).padStart(2, "0")}`;

  const table: RestaurantTable = {
    id,
    label: normalizedLabel,
    status: "available",
    currentOrderId: null,
    waiterCalled: false,
    waiterCalledAt: null,
  };

  tables.push(table);

  return {
    ok: true,
    table,
  };
}

export type RemoveTableResult =
  | { ok: true; label: string }
  | { ok: false; reason: "not-found" | "has-active-order" };

/**
 * Removes a table from the floor. Blocked while the table has an
 * active (non-billed) order. Also removes the table's device so no
 * orphaned device is left behind. Historical orders are not touched.
 */
export function removeRestaurantTable(tableId: string): RemoveTableResult {
  const index = tables.findIndex((t) => t.id === tableId);

  if (index === -1) {
    return { ok: false, reason: "not-found" };
  }

  const table = tables[index];

  const hasActiveOrder =
    table.currentOrderId !== null ||
    orders.some((o) => o.tableId === tableId && o.status !== "billed");

  if (hasActiveOrder) {
    return { ok: false, reason: "has-active-order" };
  }

  tables.splice(index, 1);

  for (let i = devices.length - 1; i >= 0; i--) {
    if (devices[i].tableId === tableId) {
      devices.splice(i, 1);
    }
  }

  return { ok: true, label: table.label };
}

/**
 * Look up a single table by id for customer-facing table identification
 * (Feature 2). Returns null when the id doesn't match a seeded table —
 * callers must treat that as "invalid table", not create one.
 */
export function getTableById(tableId: string): RestaurantTable | null {
  return tables.find((t) => t.id === tableId) ?? null;
}

export type SetTableStatusResult =
  | {
      ok: true;
      table: RestaurantTable;
    }
  | {
      ok: false;
      reason: "not-found" | "has-active-order";
    };

/**
 * Changes the operational status of a restaurant table.
 *
 * A table cannot be manually marked available while it still has:
 * - an active non-billed order, or
 * - an unpaid bill.
 *
 * This protects the existing table/order/billing state from becoming
 * inconsistent.
 */
export function setTableStatus(
  tableId: string,
  status: "occupied" | "available"
): SetTableStatusResult {
  const table = tables.find((t) => t.id === tableId);

  if (!table) {
    return {
      ok: false,
      reason: "not-found",
    };
  }

  if (status === "available") {
    const hasActiveOrder =
      table.currentOrderId !== null ||
      orders.some(
        (order) =>
          order.tableId === tableId &&
          order.status !== "billed"
      );

    const hasUnpaidBill = bills.some(
      (bill) =>
        bill.tableId === tableId &&
        bill.paidAt === null
    );

    if (hasActiveOrder || hasUnpaidBill) {
      return {
        ok: false,
        reason: "has-active-order",
      };
    }

    table.currentOrderId = null;
  }

  table.status = status;

  return {
    ok: true,
    table,
  };
}

export function getOrders() {
  return orders;
}

export function getOrder(orderId: string) {
  return orders.find((o) => o.id === orderId) ?? null;
}

export function getDevices() {
  return devices;
}

export function getBills() {
  return bills;
}

export function getBillByOrderId(orderId: string): Bill | null {
  return bills.find((b) => b.orderId === orderId) ?? null;
}

export function getLeads() {
  return leads;
}

export function getTodayOverview() {
  const activeOrders = orders.filter((o) => o.status !== "billed");
  return {
    ordersToday: orders.length + bills.length,
    salesTodayRupees: bills.reduce((sum, b) => sum + b.totalRupees, 0),
    occupiedTables: tables.filter((t) => t.status === "occupied").length,
    totalTables: tables.length,
    newOrders: activeOrders.filter((o) => o.status === "new").length,
    preparingOrders: activeOrders.filter((o) => o.status === "preparing").length,
    readyOrders: activeOrders.filter((o) => o.status === "ready").length,
    devicesOnline: devices.filter((d) => d.online).length,
    devicesTotal: devices.length,
  };
}

// ---- Derived analytics (read-only) --------------------------------------
// Everything below is computed from the arrays above — no invented
// figures, no simulated history. When a metric genuinely doesn't exist
// yet (e.g. day-over-day comparisons), we don't fabricate one; callers
// should show the current value alone instead.

export type ItemSalesSummary = {
  code: string;
  name: string;
  category: string;
  qtySold: number;
  revenueRupees: number;
};

/**
 * Aggregates every order line, across every order regardless of status,
 * into per-item totals. Same aggregation the Reports page already does
 * (see src/app/owner/reports/page.tsx) — kept here too so the Overview
 * can show a compact "Top selling items" view without duplicating the
 * loop in the component.
 */
export function getTopSellingItems(limit = 5): ItemSalesSummary[] {
  const totals = new Map<string, ItemSalesSummary>();
  for (const order of orders) {
    for (const line of order.lines) {
      const lineRevenue = line.qty * line.priceRupees;
      // Group by stable item identity so an item whose code was edited
      // still counts as one item.
      const key = line.itemId ?? line.code;
      const existing = totals.get(key);
      if (existing) {
        existing.qtySold += line.qty;
        existing.revenueRupees += lineRevenue;
      } else {
        const menuItem = getMenuItemForLine(line);
        totals.set(key, {
          // Show the item's current code when it still exists (so the
          // /owner/menu#code anchor works); otherwise the order-time code.
          code: menuItem && menuItem.archivedAt === null ? menuItem.code : line.code,
          name: line.name,
          category: line.category ?? menuItem?.category ?? "Other",
          qtySold: line.qty,
          revenueRupees: lineRevenue,
        });
      }
    }
  }
  return Array.from(totals.values())
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, limit);
}

export type CategoryOrders = {
  category: string;
  orders: number;
  qty: number;
  revenueRupees: number;
};

/**
 * Aggregates every order line into per-menu-category totals, using
 * Tablor's actual menu categories (Starters, Chinese, Biryanis & Rice,
 * etc.) — never an invented taxonomy. "orders" counts distinct orders
 * that included at least one item from the category, so the total
 * across categories can exceed the order count when an order spans
 * more than one category (a real, correct property of a share chart,
 * not a bug).
 */
export function getOrdersByCategory(): CategoryOrders[] {
  const totals = new Map<string, CategoryOrders>();
  for (const order of orders) {
    const categoriesInOrder = new Set<string>();
    for (const line of order.lines) {
      const category = line.category ?? getMenuItemForLine(line)?.category ?? "Other";
      categoriesInOrder.add(category);
      const existing = totals.get(category);
      if (existing) {
        existing.qty += line.qty;
        existing.revenueRupees += line.qty * line.priceRupees;
      } else {
        totals.set(category, {
          category,
          orders: 0,
          qty: line.qty,
          revenueRupees: line.qty * line.priceRupees,
        });
      }
    }
    for (const category of categoriesInOrder) {
      const entry = totals.get(category);
      if (entry) entry.orders += 1;
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.orders - a.orders);
}

export type HourlyOrders = {
  hour: number; // 0-23
  hourLabel: string; // e.g. "2 PM"
  orders: number;
  grossValueRupees: number;
};

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour} ${period}`;
}

/**
 * A rolling window ending at the current hour, one bucket per hour, so
 * the Sales chart has real context instead of two isolated bars. Hours
 * with no orders correctly show 0 — that's a true value, not a
 * fabricated one.
 */
export function getOrdersByHourWindow(hoursBack = 11): HourlyOrders[] {
  const currentHour = new Date().getHours();
  const buckets: HourlyOrders[] = [];
  for (let i = hoursBack; i >= 0; i--) {
    const hour = (currentHour - i + 24) % 24;
    buckets.push({ hour, hourLabel: formatHourLabel(hour), orders: 0, grossValueRupees: 0 });
  }
  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours();
    const bucket = buckets.find((b) => b.hour === hour);
    if (bucket) {
      bucket.orders += 1;
      bucket.grossValueRupees += order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);
    }
  }
  return buckets;
}

export type SlowOrder = {
  order: Order;
  expectedMinutes: number;
  elapsedMinutes: number;
};

/**
 * Active (new/preparing) orders that have already run past the prep
 * time of the slowest item on their ticket. Uses each menu item's real
 * prepMinutes — a comparison against existing data, not a guess.
 */
export function getSlowActiveOrders(): SlowOrder[] {
  const now = Date.now();
  const result: SlowOrder[] = [];
  for (const order of orders) {
    if (order.status !== "new" && order.status !== "preparing") continue;
    const expectedMinutes = order.lines.reduce((max, line) => {
      const prep = line.prepMinutes ?? getMenuItemForLine(line)?.prepMinutes;
      return prep !== undefined ? Math.max(max, prep) : max;
    }, 0);
    const elapsedMinutes = (now - order.createdAt) / 60000;
    if (expectedMinutes > 0 && elapsedMinutes > expectedMinutes) {
      result.push({ order, expectedMinutes, elapsedMinutes });
    }
  }
  return result;
}

// ---- Writes ------------------------------------------------------------

export function setItemAvailability(code: string, available: boolean) {
  const item = getMenuItemByCode(code);
  if (item) item.available = available;
  return item ?? null;
}

// ---- Menu management writes ------------------------------------------
// These re-check uniqueness against the live store, so even two racing
// requests can never produce a duplicate code (single-threaded mutation).

export type MenuWriteData = Pick<
  MenuItem,
  | "code"
  | "name"
  | "description"
  | "category"
  | "priceRupees"
  | "veg"
  | "available"
  | "prepMinutes"
  | "isSpecial"
  | "discountPercent"
>;

export type MenuWriteResult =
  | { ok: true; item: MenuItem }
  | { ok: false; reason: "duplicate-code"; ownerName: string }
  | { ok: false; reason: "not-found" };

export function createMenuItem(data: MenuWriteData): MenuWriteResult {
  const owner = getMenuItemByCode(data.code);
  if (owner) return { ok: false, reason: "duplicate-code", ownerName: owner.name };

  menuIdCounter += 1;
  const item: MenuItem = {
    ...data,
    id: `m${menuIdCounter}`,
    imageUrl: null,
    archivedAt: null,
  };
  menu.push(item);
  return { ok: true, item };
}

export function updateMenuItem(id: string, data: MenuWriteData): MenuWriteResult {
  const item = getMenuItemById(id);
  if (!item) return { ok: false, reason: "not-found" };

  const owner = getMenuItemByCode(data.code);
  if (owner && owner.id !== id) {
    return { ok: false, reason: "duplicate-code", ownerName: owner.name };
  }

  // Mutate in place so existing references stay valid. Order lines hold
  // their own snapshot, so nothing historical changes.
  Object.assign(item, data);
  return { ok: true, item };
}

export function setMenuItemImage(id: string, mime: string, bytes: Uint8Array): MenuItem | null {
  const item = getMenuItemById(id);
  if (!item) return null;
  const version = Date.now();
  menuImages.set(id, { mime, bytes, version });
  item.imageUrl = `/api/menu-image/${id}?v=${version}`;
  return item;
}

export function clearMenuItemImage(id: string): MenuItem | null {
  const item = getMenuItemById(id);
  if (!item) return null;
  menuImages.delete(id);
  item.imageUrl = null;
  return item;
}

export type DeleteMenuItemResult =
  | { ok: true; mode: "deleted" | "archived"; name: string }
  | { ok: false; reason: "not-found" };

/**
 * Removes an item from the menu. If any historical order line references
 * it, it is ARCHIVED (hidden + un-orderable, code freed for reuse) rather
 * than removed, so past orders keep resolving. Unreferenced items are
 * hard-deleted. Order lines themselves are never touched.
 */
export function deleteMenuItem(id: string): DeleteMenuItemResult {
  const item = getMenuItemById(id);
  if (!item) return { ok: false, reason: "not-found" };

  const referenced = orders.some((o) =>
    o.lines.some((l) => (l.itemId ? l.itemId === id : l.code === item.code))
  );

  if (referenced) {
    item.archivedAt = Date.now();
    item.available = false;
    item.isSpecial = false;
    menuImages.delete(id);
    item.imageUrl = null;
    return { ok: true, mode: "archived", name: item.name };
  }

  menuImages.delete(id);
  menu.splice(menu.indexOf(item), 1);
  return { ok: true, mode: "deleted", name: item.name };
}

/**
 * Kitchen lifecycle: new → preparing → ready → served.
 *
 * "billed" is deliberately NOT part of this flow. Only generateBill()
 * may move an order to "billed", so generic status advancement can
 * never skip billing.
 */
const KITCHEN_FLOW: OrderStatus[] = ["new", "preparing", "ready", "served"];

export type TransitionOrderResult =
  | { ok: true; order: Order; from: OrderStatus; to: OrderStatus }
  | { ok: false; reason: "not-found" }
  | {
      ok: false;
      reason: "already-served" | "already-billed" | "status-changed";
      order: Order;
    };

/**
 * Moves an order exactly one step forward through the kitchen flow.
 *
 * `expectedFrom` is optional stale-click protection: when given, the
 * move only happens if the order is still in that status. This stops
 * two people pressing the same button from skipping a step.
 * The order's table is never touched here.
 */
export function transitionOrder(
  orderId: string,
  expectedFrom?: OrderStatus
): TransitionOrderResult {
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return { ok: false, reason: "not-found" };
  }

  if (order.status === "billed") {
    return { ok: false, reason: "already-billed", order };
  }

  if (expectedFrom !== undefined && order.status !== expectedFrom) {
    return { ok: false, reason: "status-changed", order };
  }

  const index = KITCHEN_FLOW.indexOf(order.status);

  if (index === -1 || index === KITCHEN_FLOW.length - 1) {
    return { ok: false, reason: "already-served", order };
  }

  const from = order.status;
  const to = KITCHEN_FLOW[index + 1];

  order.status = to;
  order.statusUpdatedAt = Date.now();

  return { ok: true, order, from, to };
}

/**
 * Legacy wrapper kept so existing callers keep their signature.
 * Returns null for an unknown order, otherwise the order (unchanged
 * when it cannot advance). It can no longer move served → billed.
 */
export function advanceOrderStatus(orderId: string) {
  const result = transitionOrder(orderId);

  if (result.ok) {
    return result.order;
  }

  if (result.reason === "not-found") {
    return null;
  }

  return result.order;
}

export function generateBill(
  orderId: string,
  options: { gstPercent: number; discountRupees: number; serviceChargePercent: number }
): Bill | null {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;

  const subtotal = order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);
  const gst = Math.round((subtotal * options.gstPercent) / 100);
  const serviceCharge = Math.round((subtotal * options.serviceChargePercent) / 100);
  const total = subtotal + gst + serviceCharge - options.discountRupees;

  billCounter += 1;
  const bill: Bill = {
    id: `b${billCounter}`,
    orderId: order.id,
    tableId: order.tableId,
    subtotalRupees: subtotal,
    gstRupees: gst,
    discountRupees: options.discountRupees,
    serviceChargeRupees: serviceCharge,
    totalRupees: Math.max(0, total),
    paymentMethod: null,
    paidAt: null,
  };
  bills.push(bill);
  order.status = "billed";
  order.statusUpdatedAt = Date.now();
  return bill;
}

// ---- Billing ------------------------------------------------------------

/** Default GST percentage pre-filled on the billing form. */
export const DEFAULT_GST_PERCENT = 5;

/** Upper bounds accepted for percentages. Enforced server-side. */
export const BILL_LIMITS = {
  gstMaxPercent: 28,
  serviceChargeMaxPercent: 20,
} as const;

export const PAYMENT_METHODS = ["cash", "upi", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

export type BillInput = {
  gstPercent: number;
  discountRupees: number;
  serviceChargePercent: number;
};

export type IssueBillResult =
  | { ok: true; bill: Bill }
  | {
      ok: false;
      reason:
        | "not-found"
        | "table-mismatch"
        | "empty-order"
        | "invalid-gst"
        | "invalid-service-charge"
        | "invalid-discount"
        | "discount-too-large";
    }
  | { ok: false; reason: "not-served"; status: OrderStatus }
  | { ok: false; reason: "already-billed"; bill: Bill };

/**
 * Validated bill creation. Every figure is computed here from the
 * order's own line snapshot — the caller only supplies the three
 * owner-chosen inputs, and those are range-checked.
 *
 * Guarantees: the order exists, has no bill yet, is SERVED, belongs to
 * an existing table, and the discount can never push the total below 0.
 * On success it delegates to generateBill(), so the order moves to
 * "billed" exactly as before. The table is NOT released here — that
 * happens when payment is recorded.
 */
export function issueBill(orderId: string, input: BillInput): IssueBillResult {
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return { ok: false, reason: "not-found" };
  }

  const existing = bills.find((b) => b.orderId === order.id);

  if (existing) {
    return { ok: false, reason: "already-billed", bill: existing };
  }

  if (order.status !== "served") {
    return { ok: false, reason: "not-served", status: order.status };
  }

  if (!tables.some((t) => t.id === order.tableId)) {
    return { ok: false, reason: "table-mismatch" };
  }

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

  const subtotal = order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);

  if (subtotal <= 0) {
    return { ok: false, reason: "empty-order" };
  }

  const gst = Math.round((subtotal * gstPercent) / 100);
  const serviceCharge = Math.round((subtotal * serviceChargePercent) / 100);

  if (discountRupees > subtotal + gst + serviceCharge) {
    return { ok: false, reason: "discount-too-large" };
  }

  const bill = generateBill(order.id, {
    gstPercent,
    discountRupees,
    serviceChargePercent,
  });

  if (!bill) {
    return { ok: false, reason: "not-found" };
  }

  return { ok: true, bill };
}
// ---- Payments -----------------------------------------------------------
// Append-only records. Bill.paidAt / Bill.paymentMethod are set ONLY when a
// bill is fully settled; amounts paid, remaining and status are derived
// from these lists, so there is no second payment state to drift.

export type Payment = {
  id: string;
  billId: string;
  orderId: string;
  tableId: string;
  method: PaymentMethod;
  amountRupees: number;
  transactionId: string | null;
  paidAt: number;
};

export type Refund = {
  id: string;
  paymentId: string;
  billId: string;
  amountRupees: number;
  reason: string;
  status: "completed";
  refundedAt: number;
};

const payments: Payment[] = [];
const refunds: Refund[] = [];
let paymentCounter = 0;
let refundCounter = 0;

/** Methods that must carry a transaction / reference ID. */
export const METHODS_REQUIRING_REFERENCE: readonly PaymentMethod[] = ["upi", "card"];

const TRANSACTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{5,39}$/;

export const RESTAURANT_TIME_ZONE = "Asia/Kolkata";

export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type BillPaymentSummary = {
  billId: string;
  totalRupees: number;
  paidRupees: number;
  refundedRupees: number;
  remainingRupees: number;
  status: PaymentStatus;
  payments: Payment[];
  refunds: Refund[];
};

export function getPayments(): Payment[] {
  return payments;
}

export function getRefunds(): Refund[] {
  return refunds;
}

/** Everything derived from the canonical Bill + payment/refund records. */
export function getBillPaymentSummary(bill: Bill): BillPaymentSummary {
  const billPayments = payments.filter((p) => p.billId === bill.id);
  const billRefunds = refunds.filter((r) => r.billId === bill.id);

  const paid = billPayments.reduce((sum, p) => sum + p.amountRupees, 0);
  const refunded = billRefunds.reduce((sum, r) => sum + r.amountRupees, 0);
  const remaining = Math.max(0, bill.totalRupees - paid);

  let status: PaymentStatus;

  if (bill.paidAt === null) {
    status = paid > 0 ? "partial" : "unpaid";
  } else {
    status = paid > 0 && refunded >= paid ? "refunded" : "paid";
  }

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

/** The method that took the most money; ties go to the latest payment. */
function dominantMethod(billId: string): PaymentMethod {
  const totals = { cash: 0, upi: 0, card: 0 };
  let last: PaymentMethod = "cash";

  for (const p of payments) {
    if (p.billId !== billId) {
      continue;
    }

    totals[p.method] += p.amountRupees;
    last = p.method;
  }

  let winner: PaymentMethod = last;

  for (const method of PAYMENT_METHODS) {
    if (totals[method] > totals[winner]) {
      winner = method;
    }
  }

  return winner;
}

/**
 * Releases the table only when nothing else is active on it (another
 * unbilled order, or another bill that is not fully settled).
 */
function releaseTableIfIdle(bill: Bill): void {
  const table = tables.find((t) => t.id === bill.tableId);

  if (!table) {
    return;
  }

  const activeOrders = orders.filter(
    (o) => o.tableId === table.id && o.status !== "billed"
  );
  const otherUnsettled = bills.some(
    (b) => b.tableId === table.id && b.id !== bill.id && b.paidAt === null
  );

  if (activeOrders.length === 0 && !otherUnsettled) {
    table.status = "available";
    table.currentOrderId = null;
  } else if (activeOrders.length > 0) {
    table.currentOrderId = activeOrders[activeOrders.length - 1].id;
  }
}

export type RecordPaymentInput = {
  method: unknown;
  amountRupees: unknown;
  transactionId?: unknown;
};

export type RecordPaymentResult =
  | {
      ok: true;
      bill: Bill;
      payment: Payment;
      settled: boolean;
      summary: BillPaymentSummary;
    }
  | {
      ok: false;
      reason:
        | "not-found"
        | "invalid-method"
        | "invalid-amount"
        | "missing-reference"
        | "invalid-reference"
        | "duplicate-reference"
        | "table-mismatch";
    }
  | { ok: false; reason: "already-paid"; bill: Bill }
  | { ok: false; reason: "overpayment"; remainingRupees: number };

/**
 * Records one payment against a bill. Whole rupees only. The amount can
 * never exceed the remaining balance, a fully settled bill is never paid
 * again, and the bill is marked paid (and the table released) only when
 * the balance reaches 0.
 */
export function recordBillPayment(
  billId: string,
  input: RecordPaymentInput
): RecordPaymentResult {
  const bill = bills.find((b) => b.id === billId);

  if (!bill) {
    return { ok: false, reason: "not-found" };
  }

  if (bill.paidAt !== null || bill.paymentMethod !== null) {
    return { ok: false, reason: "already-paid", bill };
  }

  const method = input.method;

  if (!isPaymentMethod(method)) {
    return { ok: false, reason: "invalid-method" };
  }

  const order = orders.find((o) => o.id === bill.orderId);
  const table = tables.find((t) => t.id === bill.tableId);

  if (!order || !table || order.tableId !== bill.tableId) {
    return { ok: false, reason: "table-mismatch" };
  }

  const amount = input.amountRupees;

  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return { ok: false, reason: "invalid-amount" };
  }

  const before = getBillPaymentSummary(bill);

  if (bill.totalRupees === 0) {
    // A fully discounted bill is closed with a ₹0 payment — the only
    // situation in which a zero amount is accepted.
    if (amount !== 0) {
      return { ok: false, reason: "invalid-amount" };
    }
  } else {
    if (amount < 1) {
      return { ok: false, reason: "invalid-amount" };
    }

    if (amount > before.remainingRupees) {
      return {
        ok: false,
        reason: "overpayment",
        remainingRupees: before.remainingRupees,
      };
    }
  }

  const rawReference = input.transactionId;

  if (
    rawReference !== undefined &&
    rawReference !== null &&
    typeof rawReference !== "string"
  ) {
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

    const lower = reference.toLowerCase();

    if (
      payments.some(
        (p) => p.transactionId !== null && p.transactionId.toLowerCase() === lower
      )
    ) {
      return { ok: false, reason: "duplicate-reference" };
    }
  }

  paymentCounter += 1;

  const payment: Payment = {
    id: `p${paymentCounter}`,
    billId: bill.id,
    orderId: bill.orderId,
    tableId: bill.tableId,
    method,
    amountRupees: amount,
    transactionId: reference,
    paidAt: Date.now(),
  };

  payments.push(payment);

  const after = getBillPaymentSummary(bill);
  const settled = after.paidRupees >= bill.totalRupees;

  if (settled) {
    bill.paymentMethod = dominantMethod(bill.id);
    bill.paidAt = payment.paidAt;
    releaseTableIfIdle(bill);
  }

  return {
    ok: true,
    bill,
    payment,
    settled,
    summary: getBillPaymentSummary(bill),
  };
}

export type RefundResult =
  | { ok: true; refund: Refund; summary: BillPaymentSummary }
  | { ok: false; reason: "not-found" | "invalid-amount" | "invalid-reason" }
  | { ok: false; reason: "exceeds-paid"; refundableRupees: number };

/**
 * Records a refund against ONE existing payment. The payment itself is
 * never edited or removed; the refund is a separate record. A refund can
 * never exceed what that payment still holds.
 */
export function refundPayment(
  paymentId: string,
  amountRupees: unknown,
  reason: unknown
): RefundResult {
  const payment = payments.find((p) => p.id === paymentId);
  const bill = payment ? bills.find((b) => b.id === payment.billId) : undefined;

  if (!payment || !bill) {
    return { ok: false, reason: "not-found" };
  }

  if (typeof amountRupees !== "number" || !Number.isInteger(amountRupees) || amountRupees < 1) {
    return { ok: false, reason: "invalid-amount" };
  }

  const cleanReason = typeof reason === "string" ? reason.trim() : "";

  if (cleanReason.length < 3 || cleanReason.length > 200) {
    return { ok: false, reason: "invalid-reason" };
  }

  const alreadyRefunded = refunds
    .filter((r) => r.paymentId === payment.id)
    .reduce((sum, r) => sum + r.amountRupees, 0);
  const refundable = payment.amountRupees - alreadyRefunded;

  if (amountRupees > refundable) {
    return { ok: false, reason: "exceeds-paid", refundableRupees: refundable };
  }

  refundCounter += 1;

  const refund: Refund = {
    id: `r${refundCounter}`,
    paymentId: payment.id,
    billId: bill.id,
    amountRupees,
    reason: cleanReason,
    status: "completed",
    refundedAt: Date.now(),
  };

  refunds.push(refund);

  return { ok: true, refund, summary: getBillPaymentSummary(bill) };
}

export type DailyCollection = {
  /** YYYY-MM-DD in the restaurant's time zone. */
  dateKey: string;
  /** Money actually received today, by method (partial payments count only what was paid). */
  byMethod: { cash: number; upi: number; card: number };
  grossRupees: number;
  /** Refunds recorded today. */
  refundedRupees: number;
  netRupees: number;
  paymentCount: number;
};

function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", {
    timeZone: RESTAURANT_TIME_ZONE,
  });
}

/**
 * Today's collection from recorded payments only. Unpaid bills add
 * nothing, and no history is invented: days with no records are 0.
 */
export function getDailyCollection(now: number = Date.now()): DailyCollection {
  const today = dayKey(now);
  const byMethod = { cash: 0, upi: 0, card: 0 };
  let paymentCount = 0;

  for (const p of payments) {
    if (p.amountRupees > 0 && dayKey(p.paidAt) === today) {
      byMethod[p.method] += p.amountRupees;
      paymentCount += 1;
    }
  }

  let refundedRupees = 0;

  for (const r of refunds) {
    if (dayKey(r.refundedAt) === today) {
      refundedRupees += r.amountRupees;
    }
  }

  const grossRupees = byMethod.cash + byMethod.upi + byMethod.card;

  return {
    dateKey: today,
    byMethod,
    grossRupees,
    refundedRupees,
    netRupees: grossRupees - refundedRupees,
    paymentCount,
  };
}

/**
 * Legacy wrapper kept so existing callers keep their signature.
 *
 * Uses the bill's full remaining balance as the payment amount.
 * Returns the bill, or null when the bill does not exist, the method
 * is invalid, or the payment cannot be recorded.
 *
 * New payment flows should use recordBillPayment() directly.
 */
export function recordPayment(
  billId: string,
  method: Bill["paymentMethod"]
) {
  if (method === null) {
    return null;
  }

  const bill = bills.find((b) => b.id === billId);

  if (!bill) {
    return null;
  }

  const summary = getBillPaymentSummary(bill);

  const result = recordBillPayment(billId, {
    method,
    amountRupees: summary.remainingRupees,
  });

  if (result.ok) {
    return result.bill;
  }

  if (result.reason === "already-paid") {
    return result.bill;
  }

  return null;
}
/**
 * Call Waiter (customer device button). Minimal by design: just flips a
 * flag + timestamp on the table so the owner's Live Orders page can show
 * an indicator. No notification/queue system.
 */
export function callWaiterForTable(tableId: string) {
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;
  table.waiterCalled = true;
  table.waiterCalledAt = Date.now();
  return table;
}

/** Owner acknowledges a waiter call, clearing the indicator. */
export function acknowledgeWaiterCall(tableId: string) {
  const table = tables.find((t) => t.id === tableId);
  if (!table) return null;
  table.waiterCalled = false;
  table.waiterCalledAt = null;
  return table;
}

export function createDemoOrder(tableId: string, lines: OrderLine[]) {
  orderCounter += 1;
  const now = Date.now();
  const order: Order = {
    id: `o${orderCounter}`,
    tableId,
    lines,
    status: "new",
    createdAt: now,
    statusUpdatedAt: now,
  };
  orders.push(order);
  const table = tables.find((t) => t.id === tableId);
  if (table) {
    table.status = "occupied";
    table.currentOrderId = order.id;
  }
  return order;
}

export function recordLead(lead: Omit<DemoLead, "id" | "receivedAt">) {
  leadCounter += 1;
  const entry: DemoLead = { ...lead, id: `l${leadCounter}`, receivedAt: Date.now() };
  leads.push(entry);
  return entry;
}
