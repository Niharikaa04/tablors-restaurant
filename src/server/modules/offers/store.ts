import "server-only";

import { randomUUID } from "node:crypto";

import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import {
  deleteDoc,
  getDoc,
  listDocs,
  putDoc,
} from "@/server/modules/data/documents";

export type OfferType =
  | "fixed_price"
  | "percentage"
  | "buy_x_get_y";

export type OfferTargetType =
  | "item"
  | "category"
  | "order";

export type Offer = {
  id: string;
  name: string;
  description: string;

  type: OfferType;

  /**
   * fixed_price:
   *   target item/category price becomes fixedPriceRupees.
   *
   * percentage:
   *   percentagePercent is applied to eligible subtotal.
   *
   * buy_x_get_y:
   *   Buy buyQuantity, get freeQuantity.
   */
  fixedPriceRupees: number | null;
  percentagePercent: number | null;

  buyQuantity: number | null;
  freeQuantity: number | null;

  targetType: OfferTargetType;

  /**
   * For targetType = item:
   * menu item id.
   */
  targetItemId: string | null;

  /**
   * For targetType = category:
   * exact canonical menu category.
   */
  targetCategory: string | null;

  /**
   * For targetType = order:
   * entire order.
   */
  minimumOrderRupees: number | null;

  startsAt: number;
  endsAt: number;

  active: boolean;

  createdAt: number;
  updatedAt: number;
};

const COLLECTION = "offers";
const RID = DEMO_RESTAURANT_ID;

export async function getOffers(): Promise<Offer[]> {
  return (await listDocs<Offer>(RID, COLLECTION)).map((d) => d.data);
}

export async function getOfferById(id: string): Promise<Offer | null> {
  return getDoc<Offer>(RID, COLLECTION, id);
}

function isLive(offer: Offer, now: number): boolean {
  return offer.active && offer.startsAt <= now && offer.endsAt > now;
}

export async function getActiveOffers(now = Date.now()): Promise<Offer[]> {
  return (await getOffers()).filter((offer) => isLive(offer, now));
}

export type CreateOfferInput = Omit<Offer, "id" | "createdAt" | "updatedAt">;

export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  const now = Date.now();
  const offer: Offer = {
    ...input,
    id: `offer-${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
  await putDoc(RID, COLLECTION, offer.id, offer);
  return offer;
}

export type UpdateOfferInput = Partial<CreateOfferInput>;

export async function updateOffer(
  id: string,
  input: UpdateOfferInput,
): Promise<Offer | null> {
  const offer = await getOfferById(id);
  if (!offer) return null;
  const updated: Offer = { ...offer, ...input, updatedAt: Date.now() };
  await putDoc(RID, COLLECTION, id, updated);
  return updated;
}

export async function deleteOffer(id: string): Promise<boolean> {
  return deleteDoc(RID, COLLECTION, id);
}

export async function setOfferActive(
  id: string,
  active: boolean,
): Promise<Offer | null> {
  return updateOffer(id, { active });
}

export async function getActiveOfferCount(): Promise<number> {
  return (await getActiveOffers()).length;
}
