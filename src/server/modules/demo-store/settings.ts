import "server-only";

import { getDoc, putDoc } from "@/server/modules/data/documents";


/** DEMO restaurant settings store (in-memory). Keyed by restaurantId. */

export interface RestaurantSettings {
  name: string;
  logoDataUrl: string | null;
  address: string;
  gstNumber: string;
  phone: string;
  email: string;
  openingTime: string; // HH:mm
  closingTime: string;
  gstRatePercent: number;
  serviceChargePercent: number;
  pricesIncludeTax: boolean;
  currency: "INR" | "USD" | "EUR" | "GBP" | "AED";
  language: "en" | "hi" | "te";
  printer: {
    enabled: boolean;
    paperWidthMm: 58 | 80;
    autoPrintOnPayment: boolean;
  };
  kitchen: {
    autoAcceptOrders: boolean;
    defaultPrepMinutes: number;
    soundAlerts: boolean;
  };
  payment: {
    cash: boolean;
    qr: boolean;
  };
}

export const defaults = (): RestaurantSettings => ({
  name: "Demo Restaurant",
  logoDataUrl: null,
  address: "",
  gstNumber: "",
  phone: "",
  email: "",
  openingTime: "10:00",
  closingTime: "23:00",
  gstRatePercent: 5,
  serviceChargePercent: 0,
  pricesIncludeTax: false,
  currency: "INR",
  language: "en",
  printer: {
    enabled: true,
    paperWidthMm: 80,
    autoPrintOnPayment: false,
  },
  kitchen: {
    autoAcceptOrders: false,
    defaultPrepMinutes: 15,
    soundAlerts: true,
  },
  payment: {
    cash: true,
    qr: true,
  },
});

const COLLECTION = "settings";
const ID = "restaurant";

/** Saved settings merged over defaults, so newly added fields always exist. */
export async function getSettings(
  restaurantId: string,
): Promise<RestaurantSettings> {
  const stored = await getDoc<Partial<RestaurantSettings>>(restaurantId, COLLECTION, ID);
  const base = defaults();
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    printer: { ...base.printer, ...stored.printer },
    kitchen: { ...base.kitchen, ...stored.kitchen },
    payment: { ...base.payment, ...stored.payment },
  };
}

export async function saveSettings(
  restaurantId: string,
  next: RestaurantSettings,
): Promise<void> {
  await putDoc(restaurantId, COLLECTION, ID, next);
}
