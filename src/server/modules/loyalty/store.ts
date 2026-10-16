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

type Db = {
  members: Map<string, Member>;
  offers: Offer[];
  messages: OfferMessage[];
  rupeesPerPoint: number;
};

const g = globalThis as unknown as { __tablorLoyalty?: Map<string, Db> };
const all = (g.__tablorLoyalty ??= new Map<string, Db>());

function db(restaurantId: string): Db {
  let d = all.get(restaurantId);
  if (!d) {
    d = { members: new Map(), offers: [], messages: [], rupeesPerPoint: 100 };
    all.set(restaurantId, d);
  }
  return d;
}

let seq = 0;
const nextId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Indian mobile: last 10 digits, starting 6-9. Returns null if invalid. */
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
export function recordVisit(
  restaurantId: string,
  input: { phone: string; orderTotalRupees: number; consent?: boolean },
): { ok: true; member: Member } | { ok: false; error: string } {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid 10-digit mobile number." };

  const d = db(restaurantId);
  const now = new Date().toISOString();
  const total = Math.max(0, Math.round(input.orderTotalRupees));
  const earned = Math.floor(total / d.rupeesPerPoint);

  const existing = d.members.get(phone);
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
  d.members.set(phone, member);
  return { ok: true, member };
}

export function getMember(restaurantId: string, phone: string): Member | null {
  const p = normalizePhone(phone);
  return p ? (db(restaurantId).members.get(p) ?? null) : null;
}

export function listMembers(restaurantId: string): Member[] {
  return [...db(restaurantId).members.values()].sort((a, b) =>
    b.lastVisitAt.localeCompare(a.lastVisitAt),
  );
}

export function listOffers(restaurantId: string): Offer[] {
  return [...db(restaurantId).offers].reverse();
}

/** Offers a returning customer can use today (for the customer screen). */
export function liveOffers(restaurantId: string): Offer[] {
  const today = todayISO();
  return db(restaurantId).offers.filter((o) => isLive(o, today));
}

export function createOffer(
  restaurantId: string,
  input: Omit<Offer, "id" | "active">,
): Offer {
  const offer: Offer = { ...input, id: nextId("off"), active: true };
  db(restaurantId).offers.push(offer);
  return offer;
}

export function setOfferActive(restaurantId: string, id: string, active: boolean) {
  const o = db(restaurantId).offers.find((x) => x.id === id);
  if (o) o.active = active;
}

/** Queues one message per consenting member (never twice for the same offer). */
export function queueOfferMessages(
  restaurantId: string,
  offerId: string,
  restaurantName: string,
): number {
  const d = db(restaurantId);
  const offer = d.offers.find((o) => o.id === offerId);
  if (!offer) return 0;

  let count = 0;
  for (const m of d.members.values()) {
    if (!m.consent) continue;
    if (d.messages.some((x) => x.phone === m.phone && x.offerId === offerId)) continue;
    d.messages.push({
      id: nextId("msg"),
      phone: m.phone,
      offerId,
      text: `${restaurantName}: ${offer.title}. ${describeOffer(offer)}. Valid until ${offer.endsOn}.`,
      status: "queued-demo",
      createdAt: new Date().toISOString(),
    });
    count += 1;
  }
  return count;
}

export function listMessages(restaurantId: string): OfferMessage[] {
  return [...db(restaurantId).messages].reverse();
}

export function getRupeesPerPoint(restaurantId: string): number {
  return db(restaurantId).rupeesPerPoint;
}