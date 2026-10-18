import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/server/db/client";
import { appDocuments } from "@/server/db/schema";

/**
 * Per-restaurant JSON documents in PostgreSQL (table `app_documents`),
 * used by the smaller modules instead of process memory.
 */

export async function getDoc<T>(
  restaurantId: string,
  collection: string,
  id: string,
): Promise<T | null> {
  const [row] = await db
    .select({ data: appDocuments.data })
    .from(appDocuments)
    .where(
      and(
        eq(appDocuments.restaurantId, restaurantId),
        eq(appDocuments.collection, collection),
        eq(appDocuments.id, id),
      ),
    );
  return row ? (row.data as T) : null;
}

export async function putDoc<T>(
  restaurantId: string,
  collection: string,
  id: string,
  data: T,
): Promise<void> {
  await db
    .insert(appDocuments)
    .values({ restaurantId, collection, id, data: data as object })
    .onConflictDoUpdate({
      target: [appDocuments.restaurantId, appDocuments.collection, appDocuments.id],
      set: { data: data as object, updatedAt: new Date() },
    });
}

export async function listDocs<T>(
  restaurantId: string,
  collection: string,
): Promise<{ id: string; data: T; createdAt: Date }[]> {
  const rows = await db
    .select({
      id: appDocuments.id,
      data: appDocuments.data,
      createdAt: appDocuments.createdAt,
    })
    .from(appDocuments)
    .where(
      and(
        eq(appDocuments.restaurantId, restaurantId),
        eq(appDocuments.collection, collection),
      ),
    )
    .orderBy(asc(appDocuments.createdAt), asc(appDocuments.id));
  return rows.map((r) => ({ id: r.id, data: r.data as T, createdAt: r.createdAt }));
}

export async function deleteDoc(
  restaurantId: string,
  collection: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(appDocuments)
    .where(
      and(
        eq(appDocuments.restaurantId, restaurantId),
        eq(appDocuments.collection, collection),
        eq(appDocuments.id, id),
      ),
    )
    .returning({ id: appDocuments.id });
  return rows.length > 0;
}
