import { Reveal } from "./motion/reveal";
import { TablorDeviceImage } from "./tablor-device-image";

/*
 * Only what the client's reference image establishes: a countertop terminal
 * with a numeric keypad, dedicated order buttons, a built-in LCD order
 * display. Do not add functions here until the
 * client confirms them.
 */
const parts = [
  {
    title: "Numeric keypad",
    text: "Customers select items using the keypad.",
  },
  {
    title: "Order buttons",
    text: "Dedicated order buttons sit alongside the keypad.",
  },
  {
    title: "Order display",
    text: "A built-in LCD shows the current order.",
  },
] as const;

const steps = [
  "Select items using the keypad and order buttons.",
  "Check the order on the built-in display.",
  "The order is sent directly to the kitchen.",
] as const;

export function OpenDevice() {
  return (
    <section
      id="device"
      className="px-6 py-10 sm:py-12 lg:py-16"
      style={{ scrollMarginTop: "4.25rem" }}
    >
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
            The device
          </p>
          <h2
            className="mt-3 text-4xl leading-[1.08] tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            Pick on the keypad. See the order on the display.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mkt-text-secondary)]">
            A countertop ordering terminal with a numeric keypad, dedicated
            order buttons and a built-in LCD order display.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <Reveal
            delay={0.1}
            className="relative mx-auto w-full max-w-2xl rounded-2xl border border-[var(--mkt-lime-dim)]/40 bg-[#07080c] p-3 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] sm:p-5"
          >
            <TablorDeviceImage sizes="(min-width: 1024px) 50vw, 92vw" />
          </Reveal>

          <Reveal delay={0.15}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {parts.map((p) => (
                <li
                  key={p.title}
                  className="rounded-xl border border-[var(--mkt-border)] bg-[#15170F] p-4"
                >
                  <p className="text-sm font-medium text-[var(--mkt-text-primary)]">
                    {p.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
                    {p.text}
                  </p>
                </li>
              ))}
            </ul>

            <ol className="mt-6 space-y-3">
              {steps.map((s, i) => (
                <li key={s} className="flex items-start gap-3 text-sm text-[var(--mkt-text-secondary)]">
                  <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-lime-dim)]/50 text-xs text-[var(--mkt-lime)]">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}