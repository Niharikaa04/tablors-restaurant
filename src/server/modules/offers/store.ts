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

const offers: Offer[] = [];

let offerCounter = 0;

function nextOfferId(): string {
  offerCounter += 1;
  return `offer-${offerCounter}`;
}

export function getOffers(): Offer[] {
  return offers;
}

export function getOfferById(id: string): Offer | null {
  return offers.find((offer) => offer.id === id) ?? null;
}

export function getActiveOffers(now = Date.now()): Offer[] {
  return offers.filter(
    (offer) =>
      offer.active &&
      offer.startsAt <= now &&
      offer.endsAt > now
  );
}

export type CreateOfferInput = Omit<
  Offer,
  "id" | "createdAt" | "updatedAt"
>;

export function createOffer(input: CreateOfferInput): Offer {
  const now = Date.now();

  const offer: Offer = {
    ...input,
    id: nextOfferId(),
    createdAt: now,
    updatedAt: now,
  };

  offers.push(offer);

  return offer;
}

export type UpdateOfferInput = Partial<CreateOfferInput>;

export function updateOffer(
  id: string,
  input: UpdateOfferInput
): Offer | null {
  const offer = getOfferById(id);

  if (!offer) {
    return null;
  }

  Object.assign(offer, input, {
    updatedAt: Date.now(),
  });

  return offer;
}

export function deleteOffer(id: string): boolean {
  const index = offers.findIndex((offer) => offer.id === id);

  if (index === -1) {
    return false;
  }

  offers.splice(index, 1);

  return true;
}

export function setOfferActive(
  id: string,
  active: boolean
): Offer | null {
  const offer = getOfferById(id);

  if (!offer) {
    return null;
  }

  offer.active = active;
  offer.updatedAt = Date.now();

  return offer;
}
export function getActiveOfferCount(): number {
  const now = Date.now();

  return offers.filter(
    (offer) =>
      offer.active &&
      offer.startsAt <= now &&
      offer.endsAt > now
  ).length;
}