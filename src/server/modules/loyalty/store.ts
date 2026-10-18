import "server-only";

import { randomUUID } from "node:crypto";

import { getDoc, listDocs, putDoc } from "@/server/modules/data/documents";
import { RESTAURANT_TIME_ZONE } from "@/server/modules/demo-store/store";

export type Member = {
  phone: string; // 10 digits, the member's ID
  consent: boolean; // agreed to receive offers
  visits: number;
  totalSpendRupees: number;
  points: number;
  firstVisitAt: string;
  lastVisitAt: string;
};

export type Offer = {
  id: string;
  title: string;
  kind: "fixed" | "percent";
  value: number;
  minBillRupees: number;
  startsOn: string; // yyyy-mm-dd
  endsOn: string;
  active: boolean;
};

export type OfferMessage = {
  id: string;
  phone: string;
  offerId: string;
  text: string;
  // No SMS/WhatsApp provider is connected, so nothing is ever really sent.
  status: "queued-demo";
  createdAt: string;
};

const MEMBERS = "loyalty_members";
const OFFERS = "loyalty_offers";
const MESSAGES = "loyalty_messages";
const RUPEES_PER_POINT = 100;

const nextId = (prefix: string) => `${prefix}_${randomUUID()}`;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 2)}••••${phone.slice(-4)}`;
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RESTAURANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function describeOffer(o: Offer): string {
  const what = o.kind === "fixed" ? `₹${o.value} off` : `${o.value}% off`;
  return o.minBillRupees > 0 ? `${what} on bills above ₹${o.minBillRupees}` : what;
}

export function isLive(o: Offer, today = todayISO()): boolean {
  return o.active && o.startsOn <= today && today <= o.endsOn;
}

/**
 * Call this when a customer enters their number and places an order.
 * One phone number = one member. `consent` is only changed when provided.
 */
export async function recordVisit(
  restaurantId: string,
  input: { phone: string; orderTotalRupees: number; consent?: boolean },
): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };

  const now = new Date().toISOString();
  const total = Math.max(0, Math.round(input.orderTotalRupees));
  const earned = Math.floor(total / RUPEES_PER_POINT);
  const existing = await getDoc<Member>(restaurantId, MEMBERS, phone);

  const member: Member = existing
    ? {
        ...existing,
        consent: input.consent ?? existing.consent,
        visits: existing.visits + 1,
        totalSpendRupees: existing.totalSpendRupees + total,
        points: existing.points + earned,
        lastVisitAt: now,
      }
    : {
        phone,
        consent: input.consent ?? false,
        visits: 1,
        totalSpendRupees: total,
        points: earned,
        firstVisitAt: now,
        lastVisitAt: now,
      };

  await putDoc(restaurantId, MEMBERS, phone, member);
  return { ok: true, member };
}

export async function getMember(restaurantId: string, phone: string): Promise<Member | null> {
  const p = normalizePhone(phone);
  return p ? getDoc<Member>(restaurantId, MEMBERS, p) : null;
}

export async function listMembers(restaurantId: string): Promise<Member[]> {
  return (await listDocs<Member>(restaurantId, MEMBERS))
    .map((d) => d.data)
    .sort((a, b) => b.lastVisitAt.localeCompare(a.lastVisitAt));
}

export async function listOffers(restaurantId: string): Promise<Offer[]> {
  return (await listDocs<Offer>(restaurantId, OFFERS)).map((d) => d.data).reverse();
}

export async function liveOffers(restaurantId: string): Promise<Offer[]> {
  const today = todayISO();
  return (await listDocs<Offer>(restaurantId, OFFERS))
    .map((d) => d.data)
    .filter((o) => isLive(o, today));
}

export async function createOffer(
  restaurantId: string,
  input: Omit<Offer, "id" | "active">,
): Promise<Offer> {
  const offer: Offer = { ...input, id: nextId("off"), active: true };
  await putDoc(restaurantId, OFFERS, offer.id, offer);
  return offer;
}

export async function setOfferActive(restaurantId: string, id: string, active: boolean) {
  const o = await getDoc<Offer>(restaurantId, OFFERS, id);
  if (o) await putDoc(restaurantId, OFFERS, id, { ...o, active });
}

/** Messages are only queued (never sent): there is no SMS provider configured. */
export async function queueOfferMessages(
  restaurantId: string,
  offerId: string,
  restaurantName: string,
): Promise<number> {
  const offer = await getDoc<Offer>(restaurantId, OFFERS, offerId);
  if (!offer) return 0;

  const members = (await listDocs<Member>(restaurantId, MEMBERS)).map((d) => d.data);
  const messages = (await listDocs<OfferMessage>(restaurantId, MESSAGES)).map((d) => d.data);
  let count = 0;

  for (const m of members) {
    if (!m.consent) continue;
    if (messages.some((x) => x.phone === m.phone && x.offerId === offerId)) continue;
    const msg: OfferMessage = {
      id: nextId("msg"),
      phone: m.phone,
      offerId,
      text: `${restaurantName}: ${offer.title}. ${describeOffer(offer)}. Valid until ${offer.endsOn}.`,
      status: "queued-demo",
      createdAt: new Date().toISOString(),
    };
    await putDoc(restaurantId, MESSAGES, msg.id, msg);
    count += 1;
  }
  return count;
}

export async function listMessages(restaurantId: string): Promise<OfferMessage[]> {
  return (await listDocs<OfferMessage>(restaurantId, MESSAGES)).map((d) => d.data).reverse();
}

export async function getRupeesPerPoint(_restaurantId: string): Promise<number> {
  return RUPEES_PER_POINT;
}
