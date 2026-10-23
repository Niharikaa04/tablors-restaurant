import "server-only";

import { cache } from "react";

import { listAllOrders, listActiveOrders } from "@/server/modules/orders/db-orders";
import { listBillsDb } from "@/server/modules/billing/db-billing";
import { getTablesDb } from "@/server/modules/data/tables-db";
import { getDevicesDb } from "@/server/modules/data/devices-db";
import { getMenuDb, getMenuIncludingArchivedDb } from "@/server/modules/data/menu-db";

/**
 * Request-scoped (per page render) de-duplication of the read queries the
 * dashboard panels share.
 *
 * Before this, every panel on the Overview page loaded all orders, bills,
 * tables and devices on its own, dozens of identical round trips to a remote
 * database, each one waiting on the last. With React `cache()` the first
 * caller starts the query and every other panel in the same render reuses the
 * same promise. Nothing is cached across requests, so data is still live.
 *
 * Use these ONLY from page/component renders. Server actions that read after
 * they write must keep calling the uncached functions.
 */
export const listAllOrdersCached = cache(listAllOrders);
export const listActiveOrdersCached = cache(listActiveOrders);
export const listBillsCached = cache(listBillsDb);
export const getTablesCached = cache(getTablesDb);
export const getDevicesCached = cache(getDevicesDb);
export const getMenuCached = cache(getMenuDb);
export const getMenuIncludingArchivedCached = cache(getMenuIncludingArchivedDb);
