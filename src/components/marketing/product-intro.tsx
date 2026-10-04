import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";

const highlights = [
  {
    title: "One device per table",
    body: "A book-shaped ordering device sits on every table. Guests browse the menu by page and order by item number — no app to install, no waiter to flag down.",
  },
  {
    title: "One dashboard for the owner",
    body: "Every order, table, and bill flows into a single owner dashboard. Change a price or mark a dish sold out, and every table updates at once.",
  },
  {
    title: "One screen for the kitchen",
    body: "Orders land on the kitchen display the moment they're confirmed — no paper tickets, no relayed orders, no guesswork about what's next.",
  },
];

export function ProductIntro() {
  return (
    <section
      id="product"
      className="snap-section border-t border-[var(--color-border)] px-6 py-24"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <h2
            className="text-3xl text-[var(--color-text-primary)] sm:text-4xl"
            style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
          >
            A table ordering system built for how restaurants actually run
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[var(--color-text-secondary)]">
            Tablor&apos;s connects the table, the kitchen, and the owner&apos;s
            dashboard into one system, so an order placed at Table 5 shows up
            in the kitchen in seconds — and in your reports by end of day.
          </p>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-10 md:grid-cols-3">
          {highlights.map((item) => (
            <StaggerItem key={item.title}>
              <h3 className="text-lg text-[var(--color-text-primary)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {item.body}
              </p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
