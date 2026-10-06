import { BookDeviceIllustration } from "./book-device-illustration";
import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";

// Values copied verbatim from the Tablor's product document. Do not add
// or round figures here; anything not in the document does not belong.
const highlights = [
  { value: "7″", label: "TFT LCD display" },
  { value: "10–12", label: "Hours working time" },
  { value: "A4", label: "297 × 210 mm book" },
];
const specs = [
  { label: "Display", value: "7 inch TFT LCD Screen" },
  { label: "Resolution", value: "800 × 480 Pixels" },
  { label: "Battery", value: "Rechargeable Lithium Battery (Long Lasting)" },
  { label: "Charging time", value: "3 – 4 Hours" },
  { label: "Material", value: "Premium PU Leather Hard Book Cover" },
  { label: "Weight", value: "Lightweight & Portable" },
  { label: "Controls", value: "Numeric keypad + quantity controls" },
  { label: "Order flow", value: "Menu → Select → Confirm → Bill" },
];

export function Specifications() {
  return (
    <section id="specifications" className="border-t border-[var(--mkt-border)] px-6 py-16 sm:py-20 lg:py-24" style={{ scrollMarginTop: "4.25rem" }}>
      <div className="mkt-container grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-center lg:gap-16">
        <Reveal className="mx-auto w-56 sm:w-72 lg:w-full">
          <BookDeviceIllustration className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]" />
          <p className="mt-2 text-center text-xs uppercase tracking-[0.25em] text-[var(--mkt-gold)]">A4 · 297 × 210 mm</p>
        </Reveal>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-gold)]">Product specifications</p>
          <h2 className="mt-3 text-4xl leading-[1.08] tracking-tight sm:text-5xl" style={{ fontFamily: "var(--mkt-serif)" }}>
            The real device, in numbers
          </h2>
          <ul className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
            {highlights.map((h) => (
              <li
                key={h.label}
                className="rounded-xl border border-[var(--mkt-gold-soft)]/40 px-2 py-4 text-center sm:px-5 sm:py-5 sm:text-left"
              >
                <p
                  className="text-2xl leading-none text-[var(--mkt-gold)] sm:text-5xl"
                  style={{ fontFamily: "var(--mkt-serif)" }}
                >
                  {h.value}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[var(--mkt-text-muted)] sm:text-[11px] sm:tracking-[0.18em]">
                  {h.label}
                </p>
              </li>
            ))}
          </ul>
          <StaggerGroup className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {specs.map((s) => (
              <StaggerItem key={s.label} className="border-l pl-4" >
                <div style={{ borderColor: "var(--mkt-gold-soft)" }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--mkt-text-muted)]">{s.label}</div>
                  <div className="mt-1 text-base text-[var(--mkt-text-primary)]">{s.value}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
