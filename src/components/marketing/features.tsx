import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";

// Every item below appears in the Tablor's product document.
const features = [
  { title: "Your Menu, Right Here", body: "Look through the dishes and see what you'd like to eat." },
  { title: "Order Your Way", body: "Pick your dishes, choose how many you want, and place your order." },
  { title: "Your Bill, Updated", body: "Add or remove items and see your bill change.." },
  { title: "Scan & Pay", body: "Scan the QR code and pay using your UPI app." },
  { title: "No Help Needed", body: "Everything is simple to follow, from choosing dishes to placing your order." },
];

// "Why choose Tablor's?" — as listed in the product document.
const benefits = [
  "Enhances customer experience",
  "Reduces waiting time",
  "Increases order accuracy",
  "Improves staff efficiency",
  "Boosts your business growth",
  "Eco-friendly & cost effective",
];

export function Features() {
  return (
    <section
      id="features"
      className="snap-section px-6 py-16 sm:py-20 lg:py-24"
    >
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
            Product features
          </p>
          <h2
            className="mt-4 text-4xl leading-[1.05] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            What it does for your restaurant
          </h2>
        </Reveal>

        <StaggerGroup className="mt-10 grid grid-cols-1 gap-x-10 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem
              key={feature.title}
              className="mkt-index-row py-4"
            >
              <h3 className="text-base text-[var(--mkt-text-primary)]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
                {feature.body}
              </p>
            </StaggerItem>
          ))}
        </StaggerGroup>


        <Reveal delay={0.1} className="mt-10 border-t border-[var(--mkt-border)] pt-8">
          <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--mkt-gold)]">Why choose Tablor&apos;s</h3>
          <ul className="mt-4 grid gap-x-10 gap-y-2 text-sm text-[var(--mkt-text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--mkt-lime)]" />
                {b}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}