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
  printer: { enabled: boolean; paperWidthMm: 58 | 80; autoPrintOnPayment: boolean };
  kitchen: { autoAcceptOrders: boolean; defaultPrepMinutes: number; soundAlerts: boolean };
  payment: { cash: boolean; upi: boolean; card: boolean; upiId: string };
}

const defaults = (): RestaurantSettings => ({
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
  printer: { enabled: true, paperWidthMm: 80, autoPrintOnPayment: false },
  kitchen: { autoAcceptOrders: false, defaultPrepMinutes: 15, soundAlerts: true },
  payment: { cash: true, upi: true, card: true, upiId: "" },
});

const g = globalThis as unknown as { __tablorsSettings?: Map<string, RestaurantSettings> };
const map = () => (g.__tablorsSettings ??= new Map());

export function getSettings(restaurantId: string): RestaurantSettings {
  const m = map();
  if (!m.has(restaurantId)) m.set(restaurantId, defaults());
  return structuredClone(m.get(restaurantId)!);
}

export function saveSettings(restaurantId: string, next: RestaurantSettings): void {
  map().set(restaurantId, structuredClone(next));
}
