/**
 * Shared story data, deliberately in its own plain module with no
 * "use client" / server directive.
 *
 * `product-story.tsx` is a client component (it uses scroll-linked
 * motion values). `connected-system.tsx` is a server component. Next's
 * react-server compiler turns every export of a "use client" file into a
 * client-reference stub when a server component imports it — so
 * `connected-system.tsx` was reading a reference object instead of the
 * real `sampleLines` array/`sampleTotal` number, which is what produced
 * `TypeError: d.sampleLines.slice is not a function` during prerender.
 *
 * Keeping this data in a plain, directive-free module means both sides
 * of the client/server boundary get the actual values.
 */

export const SAMPLE_GST_PERCENT = 5;

export const sampleLines = [
  { code: "055", name: "Veg Biryani", qty: 1, price: 250 },
  { code: "125", name: "Butter Naan", qty: 3, price: 45 },
  { code: "114", name: "Dal Tadka", qty: 2, price: 200 },
  { code: "008", name: "Chicken 65", qty: 1, price: 320 },
  { code: "099", name: "Pepper Chicken", qty: 2, price: 280 },
];

export const sampleItems = sampleLines.reduce((sum, l) => sum + l.qty, 0);
export const sampleSubtotal = sampleLines.reduce((sum, l) => sum + l.qty * l.price, 0);
export const sampleGst = Math.round((sampleSubtotal * SAMPLE_GST_PERCENT) / 100);
export const sampleTotal = sampleSubtotal + sampleGst;

export const beats = [
  {
    id: "device",
    kicker: "The device",
    title: "A menu that opens like a book.",
    body: "Menu pages above. A simple keypad below. Every selection builds the order in real time..",
  },
  {
    id: "menu",
    kicker: "Real menu, real pages",
    title: "Browse by page, order by number.",
    body: "Each category has its own menu page. Every dish has a simple item code, so guests can select what they want with just a number and quantity.",
  },
  {
    id: "selection",
    kicker: "Selecting",
    title: "Items build up, live.",
    body: "The order builds live on screen, with the total always in view. Nothing reaches the kitchen until the table confirms.",
  },
  {
    id: "order",
    kicker: "Order sent",
    title: "One tap, and it's on its way.",
    body: "One tap sends the confirmed order straight from the table to the kitchen - instantly.",
  },
  {
    id: "kitchen",
    kicker: "Kitchen display",
    title: "Kitchen prepares and serves.",
    body: "Confirmed at the table. Live in the kitchen. Staff see the table, items, and quantities instantly, then move the order from New → Preparing → Ready. No paper. No relayed orders.",
  },
  {
    id: "owner",
    kicker: "Owner dashboard",
    title: "Every order finds its way to one dashboard.",
    body: "One dashboard keeps every table, order, and bill in sync. Change a price or mark a dish sold out once - every table updates instantly.",
  },
  {
    id: "billing",
    kicker: "Bill & pay",
    title: "Bill, pay, and it's done.",
    body: "Once the order is served, staff generate the bill and the table pays by cash, UPI, or card. The device confirms the payment right on screen.",
  },
] as const;
