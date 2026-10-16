import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";
import { TablorDeviceImage } from "./tablor-device-image";

/*
 * Only features visible in the client's reference image are listed.
 *
 * REMOVED (belonged to the old book device, not confirmed for the terminal):
 * 7" TFT / 800x480 display, 10-12 h runtime, 3-4 h charging, lithium battery,
 * PU leather cover, A4 297x210 mm size, "lightweight & portable", and the
 * Menu -> Select -> Confirm -> Bill flow.
 *
 * ADD ONLY WHEN CONFIRMED BY THE CLIENT: dimensions, LCD size/resolution,
 * power (mains/battery), connectivity, materials/finish, weight, handset
 * function, button functions.
 */
const highlights = [
  { value: "Keypad", label: "Numeric" },
  { value: "LCD", label: "Built-in order display" },
  { value: "Handset", label: "Telephone-style" },
];

const specs = [
  { label: "Form", value: "Countertop restaurant ordering terminal" },
  { label: "Model", value: "TBL-01" },
  { label: "Input", value: "Numeric keypad" },
  { label: "Order buttons", value: "Dedicated order buttons" },
  { label: "Display", value: "Built-in LCD order display" },
  { label: "Handset", value: "Telephone-style handset" },
  { label: "Power input", value: "DC 12V, 3A" },
  { label: "Made in", value: "India" },
];

export function Specifications() {
  return (
    <section
      id="specifications"
      className="border-t border-[var(--mkt-border)] px-6 py-16 sm:py-20 lg:py-24"
      style={{ scrollMarginTop: "4.25rem" }}
    >
      <div className="mkt-container grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_1fr] lg:items-center lg:gap-16">
        <Reveal className="mx-auto w-full max-w-xl lg:max-w-none">
          <TablorDeviceImage
            sizes="(min-width: 1024px) 45vw, 92vw"
            className="drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
          />
        </Reveal>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-gold)]">
            Product specifications
          </p>
          <h2
            className="mt-3 text-4xl leading-[1.08] tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            The terminal, at a glance
          </h2>
          <ul className="mt-8 grid grid-cols-3 gap-3 sm:gap-5">
            {highlights.map((h) => (
              <li
                key={h.label}
                className="rounded-xl border border-[var(--mkt-gold-soft)]/40 px-2 py-4 text-center sm:px-5 sm:py-5 sm:text-left"
              >
                <p
                  className="text-xl leading-none text-[var(--mkt-gold)] sm:text-3xl"
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
              <StaggerItem key={s.label} className="border-l pl-4">
                <div style={{ borderColor: "var(--mkt-gold-soft)" }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--mkt-text-muted)]">
                    {s.label}
                  </div>
                  <div className="mt-1 text-base text-[var(--mkt-text-primary)]">
                    {s.value}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}