
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { db } from "@/server/db/client";
import {
  restaurants,
  areas,
  categories,
  restaurantTables,
  menuItems,
  devices,
  reservations,
  orders,
  orderItems,
  bills,
  payments,
} from "@/server/db/schema";
import {
  getMenu,
  getTables,
  getDevices,
  getOrders,
  getBills,
  getPayments,
} from "@/server/modules/demo-store/store";
import { listTodayReservations } from "@/server/modules/demo-store/reservations";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";

const restaurantId = DEMO_RESTAURANT_ID;

async function main() {
  const menu = getMenu();
  const tables = getTables();
  const devicesData = getDevices();
  const ordersData = getOrders();
  const billsData = getBills();
  const paymentsData = getPayments();
  const reservationsData = listTodayReservations(restaurantId);

  // Create the restaurant if it does not already exist.
  await db
    .insert(restaurants)
    .values({
      id: restaurantId,
      name: "Demo Restaurant",
      timezone: "Asia/Kolkata",
    })
    .onConflictDoNothing();

  // Seed areas.
  await db
    .insert(areas)
    .values([
      {
        id: "area_main",
        restaurantId,
        name: "Main Hall",
        sortOrder: 0,
      },
    ])
    .onConflictDoNothing();

  // Seed categories.
  const categoryRows = [
    ...new Set(menu.map((item) => item.category)),
  ].map((name, index) => ({
    id: `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    restaurantId,
    name,
    sortOrder: index,
  }));

  if (categoryRows.length > 0) {
    await db
      .insert(categories)
      .values(categoryRows)
      .onConflictDoNothing();
  }

  // Seed tables, including Table 05 with its existing ID (t05).
  if (tables.length > 0) {
    await db
      .insert(restaurantTables)
      .values(
        tables.map((table, index) => ({
          id: table.id,
          restaurantId,
          areaId: "area_main",
          label: table.label,
          number: index + 1,
          status: table.status,
          currentOrderId: table.currentOrderId,
          waiterCalled: table.waiterCalled,
          waiterCalledAt: table.waiterCalledAt
            ? new Date(table.waiterCalledAt)
            : null,
        })),
      )
      .onConflictDoNothing();
  }

  // Seed menu items.
  if (menu.length > 0) {
    await db
      .insert(menuItems)
      .values(
        menu.map((item) => ({
          id: item.id,
          restaurantId,
          categoryId: `cat_${item.category
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}`,
          code: item.code,
          name: item.name,
          description: item.description,
          category: item.category,
          pricePaise: Math.round(item.priceRupees * 100),
          veg: item.veg,
          available: item.available,
          prepMinutes: item.prepMinutes,
          isSpecial: item.isSpecial,
          discountPercent: item.discountPercent,
          imageMime: null,
          imageData: null,
          archivedAt: item.archivedAt
            ? new Date(item.archivedAt)
            : null,
        })),
      )
      .onConflictDoNothing();
  }

  // Seed devices only when there are devices to insert.
  if (devicesData.length > 0) {
    await db
      .insert(devices)
      .values(
        devicesData.map((device) => ({
          id: device.id,
          restaurantId,
          deviceUid: device.id,
          tableId: device.tableId,
          status: device.online
            ? ("online" as const)
            : ("offline" as const),
          batteryPercent: device.batteryPercent,
          lastSeenAt: new Date(
            Date.now() - device.lastSeenMinutesAgo * 60_000,
          ),
        })),
      )
      .onConflictDoNothing();
  }

  // Seed orders only when orders exist.
  if (ordersData.length > 0) {
    await db
      .insert(orders)
      .values(
        ordersData.map((order) => ({
          id: order.id,
          restaurantId,
          tableId: order.tableId,
          status: order.status,
          createdAt: new Date(order.createdAt),
          statusUpdatedAt: new Date(order.statusUpdatedAt),
          updatedAt: new Date(order.statusUpdatedAt),
        })),
      )
      .onConflictDoNothing();
  }

  // Seed order items only when items exist.
  const itemRows = ordersData.flatMap((order) =>
    order.lines.map((line, index) => ({
      id: `${order.id}_item_${index + 1}`,
      orderId: order.id,
      menuItemId: line.itemId ?? null,
      code: line.code,
      nameSnapshot: line.name,
      categorySnapshot: line.category ?? null,
      qty: line.qty,
      pricePaise: Math.round(line.priceRupees * 100),
      basePricePaise:
        line.basePriceRupees == null
          ? null
          : Math.round(line.basePriceRupees * 100),
      discountPercent: line.discountPercent ?? null,
      prepMinutes: line.prepMinutes ?? null,
    })),
  );

  if (itemRows.length > 0) {
    await db
      .insert(orderItems)
      .values(itemRows)
      .onConflictDoNothing();
  }

  // Seed bills only when bills exist.
  if (billsData.length > 0) {
    await db
      .insert(bills)
      .values(
        billsData.map((bill) => ({
          id: bill.id,
          restaurantId,
          orderId: bill.orderId,
          tableId: bill.tableId,
          subtotalPaise: Math.round(bill.subtotalRupees * 100),
          gstPaise: Math.round(bill.gstRupees * 100),
          discountPaise: Math.round(bill.discountRupees * 100),
          serviceChargePaise: Math.round(
            bill.serviceChargeRupees * 100,
          ),
          totalPaise: Math.round(bill.totalRupees * 100),
          paymentMethod: bill.paymentMethod,
          paidAt: bill.paidAt ? new Date(bill.paidAt) : null,
        })),
      )
      .onConflictDoNothing();
  }

  // Seed payments only when payments exist.
  const paymentRows = paymentsData.map((payment) => ({
    id: payment.id,
    restaurantId,
    billId: payment.billId,
    method: payment.method,
    amountPaise: Math.round(payment.amountRupees * 100),
    status: "paid" as const,
    transactionId: payment.transactionId,
    createdAt: new Date(payment.paidAt),
    updatedAt: new Date(payment.paidAt),
  }));

  if (paymentRows.length > 0) {
    await db
      .insert(payments)
      .values(paymentRows)
      .onConflictDoNothing();
  }

  // Seed reservations only when reservations exist.
  if (reservationsData.length > 0) {
    await db
      .insert(reservations)
      .values(
        reservationsData.map((reservation) => ({
          id: reservation.id,
          restaurantId,
          tableId: reservation.tableId,
          guestName: reservation.guestName,
          phone: reservation.phone,
          partySize: reservation.partySize,
          reservedFor: new Date(reservation.reservedFor),
          status: reservation.status,
          createdAt: new Date(reservation.createdAt),
          updatedAt: new Date(reservation.updatedAt),
        })),
      )
      .onConflictDoNothing();
  }

  console.log("Tablor demo data seed completed.");
}

main().catch((error) => {
  console.error("Tablor seed failed:", error);
  process.exitCode = 1;
});