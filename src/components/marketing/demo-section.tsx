import { DemoForm } from "./demo-form";
import { Reveal } from "./motion/reveal";

const points = [
  {
    title: "Live walkthrough",
    body: "See the menu, orders and kitchen flow in action.",
  },
  {
    title: "Tailored to your restaurant",
    body: "We'll show how Tablor fits your setup.",
  },
  {
    title: "No obligation",
    body: "Just a simple product walkthrough.",
  },
];

export function DemoSection() {
  return (
    // Intentionally NOT a snap-section: this section holds the demo
    // request form, and cinematic scroll-snap must never fight normal
    // form scrolling/focus behavior.
    <section
      id="demo"
      className="relative overflow-hidden bg-[var(--mkt-stage)] px-6 py-20 sm:py-24"
    >
      {/* Faint atmospheric depth: a barely-there warm glow behind the copy
          and a whisper of lime behind the panel. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_50%_at_18%_45%,rgba(201,162,74,0.07),transparent_70%),radial-gradient(45%_45%_at_85%_60%,rgba(190,255,60,0.03),transparent_70%)]"
      />

      <div className="mkt-container relative grid gap-12 md:grid-cols-5 md:items-center md:gap-10 lg:gap-20">
        <Reveal className="md:col-span-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
            Book a demo
          </p>
          <h2
            className="mt-5 text-4xl leading-[1.08] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            See it running on <br className="hidden sm:block" />a real table
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-[var(--mkt-text-secondary)]">
            Tell us a little about your restaurant, and we&apos;ll set up a
            short walkthrough — no obligation, no card details needed.
          </p>

          <ul className="mt-10 space-y-6">
            {points.map((point) => (
              <li key={point.title} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-lime)]/30"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-lime)]/80" />
                </span>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-text-primary)]">
                    {point.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
                    {point.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1} className="md:col-span-3">
          <div className="relative rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--mkt-stage),white_6%)] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8 lg:p-10">
            <DemoForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}