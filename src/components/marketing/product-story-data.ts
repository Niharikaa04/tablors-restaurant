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
    body: "Menu pages above. A simple keypad below. The order builds live as guests choose.",
  },
  {
    id: "menu",
    kicker: "Real menu, real pages",
    title: "Browse by page, order by number.",
    body: "Every category has its own page and every dish a simple code. Guests pick by number and quantity.",
  },
  {
    id: "selection",
    kicker: "Selecting",
    title: "Items build up, live.",
    body: "The total is always in view. Nothing reaches the kitchen until the table confirms.",
  },
  {
    id: "order",
    kicker: "Order sent",
    title: "One tap, and it's on its way.",
    body: "One tap sends the confirmed order from the table to the kitchen instantly.",
  },
  {
    id: "kitchen",
    kicker: "Kitchen display",
    title: "Kitchen prepares and serves.",
    body: "Staff see the table, items and quantities instantly, then move each order from New → Preparing → Ready. No paper, no relayed orders.",
  },
  {
    id: "owner",
    kicker: "Owner dashboard",
    title: "Every order finds its way to one dashboard.",
    body: "One dashboard shows every table, order and bill. Change a price or mark a dish sold out once, and every table updates.",
  },
  {
    id: "billing",
    kicker: "Bill & pay",
    title: "Bill, pay, and it's done.",
    body: "Staff generate the bill once the order is served, and the table pays by cash, UPI or card. The device confirms payment on screen.",
  },
] as const;
