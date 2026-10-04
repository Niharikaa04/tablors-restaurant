import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";
import { CtaButton } from "./motion/cta-button";

// The exact same three system parts, in the exact same accent colors, as
// <ConnectedSystem /> above — a plan is sold as coverage of one system,
// not a bag of unrelated feature pills.
const systemParts = [
  { key: "device", label: "Table devices", color: "var(--mkt-lime)" },
  { key: "kitchen", label: "Kitchen display", color: "var(--color-radium-500)" },
  { key: "owner", label: "Owner dashboard", color: "var(--color-gold-500)" },
] as const;

const tiers = [
  {
    name: "Starter",
    description: "For a single location getting started with table ordering.",
    detail: "Up to 10 devices · menu & item codes · basic reports",
    coverage: { device: true, kitchen: false, owner: false },
  },
  {
    name: "Professional",
    description: "For a busy restaurant that needs the full floor covered.",
    detail: "Up to 40 devices · billing & GST · device monitoring",
    coverage: { device: true, kitchen: true, owner: false },
  },
  {
    name: "Enterprise",
    description: "For multi-location groups and hospitality chains.",
    detail: "Unlimited devices · multi-branch (roadmap) · priority support",
    coverage: { device: true, kitchen: true, owner: true },
  },
] satisfies {
  name: string;
  description: string;
  detail: string;
  coverage: Record<(typeof systemParts)[number]["key"], boolean>;
}[];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="snap-section px-6 py-14"
    >
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
            Plans
          </p>
          <h2
            className="mt-4 text-4xl leading-[1.05] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            Priced around your table count
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--mkt-text-secondary)]">
            Every plan starts with the device. Kitchen and owner-dashboard
            coverage scale with it — sized to your table count after a short
            demo, rather than a fixed feature list.
          </p>
        </Reveal>

        <StaggerGroup className="mt-12 border-t border-[var(--mkt-border)]" stagger={0.1}>
          {tiers.map((tier) => (
            <StaggerItem key={tier.name}>
              <div className="grid gap-4 border-b border-[var(--mkt-border)] py-8 sm:grid-cols-12 sm:items-center sm:gap-6">
                <div className="sm:col-span-3">
                  <h3
                    className="text-2xl text-[var(--mkt-text-primary)]"
                    style={{ fontFamily: "var(--mkt-serif)" }}
                  >
                    {tier.name}
                  </h3>
                </div>

                <div className="sm:col-span-4">
                  <p className="text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
                    {tier.description}
                  </p>
                  <p className="mt-1.5 text-xs text-[var(--mkt-text-muted)]">{tier.detail}</p>
                </div>

                {/* Coverage of the system — same dots, same colors, as
                    <ConnectedSystem /> above, instead of a free-text
                    feature list unrelated to the rest of the page. */}
                <div className="flex gap-4 sm:col-span-2">
                  {systemParts.map((part) => {
                    const on = tier.coverage[part.key];
                    return (
                      <span key={part.key} className="flex flex-col items-center gap-1.5" title={part.label}>
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: on ? part.color : "transparent",
                            border: `1px solid ${on ? part.color : "var(--mkt-border-strong)"}`,
                            boxShadow: on ? `0 0 10px 1px ${part.color}55` : "none",
                          }}
                        />
                        <span className="hidden text-[9px] uppercase tracking-wide text-[var(--mkt-text-muted)] sm:block">
                          {part.label.split(" ")[0]}
                        </span>
                      </span>
                    );
                  })}
                </div>

                <div className="sm:col-span-3 sm:text-right">
                  <CtaButton
                    href="#demo"
                    glow="none"
                    className="inline-block rounded-full border border-[var(--mkt-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--mkt-text-primary)]"
                  >
                    Talk to us
                  </CtaButton>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}