import { Reveal } from "./motion/reveal";

/**
 * The opened Tablor's device, transcribed from the product document:
 * two menu pages (Non Veg Items, pages 3–4, numeric item codes), a gold
 * numeric keypad with the labelled function buttons, quantity controls,
 * and the "Your Order" TFT LCD panel. Sample order and totals are the
 * ones printed in the document.
 */
const left = [
  [85, "Chicken Fry"], [86, "Chicken 65"], [87, "Egg Fry"], [88, "Fish Fry"],
  [89, "Chicken Curry"], [90, "Mutton Curry"], [91, "Prawn Curry"],
  [92, "Chicken Biryani"], [93, "Mutton Biryani"], [94, "Egg Biryani"],
  [95, "Fish Biryani"], [96, "Chicken Noodles"],
] as const;
const right = [
  [127, "Prawn 65"], [128, "Apollo Fish"], [129, "Chilli Fish"],
  [130, "Chicken Cutlet"], [131, "Egg Masala"], [132, "Omlette"],
  [133, "Egg Burji"], [134, "Boiled Egg (2 pcs)"], [135, "Chicken Roll"],
  [136, "Chicken Kathi Roll"], [137, "Egg Roll"], [138, "Mutton Roll"],
] as const;

const order = [
  ["055", "Veg Biryani", 1, "250/-"],
  ["125", "Butter Naan", 3, "125/-"],
  ["114", "Dal Tadka", 2, "400/-"],
  ["008", "Chicken 65", 1, "356/-"],
  ["082", "Chilli Chicken", 2, "586/-"],
] as const;

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];
const actions = ["Confirm Order", "Bill Gen", "Call Waiter", "QR Gen", "Clear All", "Feedback"];

function Page({ n, rows }: { n: number; rows: readonly (readonly [number, string])[] }) {
  return (
    <div className="flex-1 bg-[#f6f6f3] p-3 text-[#111] sm:p-4">
      <div className="flex items-center gap-2 border-b border-black/10 pb-2">
        <span className="rounded bg-[#d81f26] px-1.5 py-0.5 text-[10px] font-bold text-white">PAGE {n}</span>
        <span className="text-xs font-bold tracking-wide text-[#d81f26]">NON VEG ITEMS</span>
      </div>
      <ul className="mt-2 space-y-1">
        {rows.map(([code, name]) => (
          <li key={code} className="flex items-center gap-2 text-[11px] font-medium sm:text-xs">
            <span className="w-7 rounded-sm bg-black py-px text-center text-[10px] text-white">{code}</span>
            {name}
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-black/10 pt-1.5 text-center text-[10px] font-bold">◄ PAGE {n} / 4 ►</p>
    </div>
  );
}

export function OpenDevice() {
  return (
    <section id="device" className="px-6 py-16 sm:py-20 lg:py-24" style={{ scrollMarginTop: "4.25rem" }}>
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-gold)]">The device</p>
          <h2 className="mt-3 text-4xl leading-[1.08] tracking-tight sm:text-5xl" style={{ fontFamily: "var(--mkt-serif)" }}>
            A menu you can hold. An order you can see.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mkt-text-secondary)]">
             A book-shaped menu with a live order screen built in.
            
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-10 max-w-4xl rounded-2xl border border-[var(--mkt-gold-soft)]/40 bg-[#07080c] p-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] sm:p-3">
          <div className="flex overflow-hidden rounded-lg">
            <Page n={3} rows={left} />
            <div className="w-px bg-black/30" />
            <Page n={4} rows={right} />
          </div>

          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {/* keypad */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-[#0b0c10] p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {keys.map((k) => (
                  <span key={k} className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-b from-[#f0d47a] to-[#b8933a] text-sm font-bold text-black sm:h-9 sm:w-9">
                    {k}
                  </span>
                ))}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-1.5">
                {actions.map((a) => (
                  <span key={a} className="rounded-full bg-gradient-to-b from-[#f0d47a] to-[#b8933a] px-2 py-1.5 text-center text-[9px] font-bold uppercase text-black sm:text-[10px]">
                    {a}
                  </span>
                ))}
                <span className="col-span-2 flex items-center justify-center gap-2 rounded-md border border-[var(--mkt-gold-soft)]/50 py-1 text-[10px] text-[var(--mkt-text-secondary)]">
                  <b className="text-[var(--mkt-gold)]">＋</b> QTY <b className="text-[var(--mkt-gold)]">－</b>
                </span>
              </div>
            </div>

            {/* LCD */}
            <div className="rounded-lg bg-black p-3 text-[11px] text-white sm:text-xs">
              <div className="flex justify-between">
                <b className="text-[#1e9bff]">YOUR ORDER</b>
                <span>TABLE NO: 05</span>
              </div>
              <table className="mt-1.5 w-full border-t border-[#1e9bff]/60">
                <thead>
                  <tr className="text-left text-[10px] text-white/70">
                    <th className="py-1 font-medium">Sno</th><th className="font-medium">Code</th>
                    <th className="font-medium">Item</th><th className="font-medium">Qty</th>
                    <th className="text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.map(([code, name, qty, price], i) => (
                    <tr key={code}>
                      <td className="py-0.5">{i + 1}.</td><td>{code}</td><td>{name}</td><td>{qty}</td>
                      <td className="text-right">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-1.5 flex items-end justify-between border-t border-[#1e9bff]/60 pt-1.5">
                <b className="text-[#1e9bff]">TOTAL ITEMS : 9</b>
                <b className="text-sm">TOTAL : ₹ 1717/-</b>
              </div>
            </div>
          </div>
        </Reveal>
        <p className="mt-3 text-center text-xs text-[var(--mkt-text-muted)]">
          Sample menu pages and order shown as printed in the Tablor&apos;s product document.
        </p>
      </div>
    </section>
  );
}
