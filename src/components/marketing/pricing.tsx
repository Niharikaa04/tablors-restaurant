
const systemParts = [
  {
    key: "ordering",
    label: "Smart table ordering",
    color: "#A3E635",
  },
  {
    key: "kitchen",
    label: "Kitchen order management",
    color: "#67E8F9",
  },
  {
    key: "billing",
    label: "Billing & payments",
    color: "#C4B5FD",
  },
  {
    key: "dashboard",
    label: "Owner dashboard",
    color: "#F0ABFC",
  },
] as const;

type Tier = {
  name: string;
  tagline: string;
  description: string;
  detail: string;
  coverage: Record<string, boolean>;
};

const tiers: Tier[] = [
  {
    name: "Starter",
    tagline: "For small restaurants",
    description:
      "A simple starting point for restaurants that want faster table ordering and a smoother guest experience.",
    detail: "Essential ordering and billing tools",
    coverage: {
      ordering: true,
      kitchen: true,
      billing: true,
      dashboard: true,
    },
  },
  {
    name: "Growth",
    tagline: "For growing businesses",
    description:
      "Connect table ordering, kitchen operations, billing, and business visibility in one system.",
    detail: "Built for growing restaurant operations",
    coverage: {
      ordering: true,
      kitchen: true,
      billing: true,
      dashboard: true,
    },
  },
  {
    name: "Enterprise",
    tagline: "For larger operations",
    description:
      "A complete table-ordering and restaurant operations solution designed for multiple locations and complex workflows.",
    detail: "Built for larger and multi-location operations",
    coverage: {
      ordering: true,
      kitchen: true,
      billing: true,
      dashboard: true,
    },
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="w-full px-6 py-20 sm:py-28 lg:px-8"
      aria-labelledby="pricing-heading"
    >
      <div className="mkt-container">
        <div className="max-w-3xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--mkt-lime)]">
            Pricing
          </p>

          <h2
            id="pricing-heading"
            className="mt-4 text-4xl leading-[1.05] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            Choose the system that fits your restaurant.
          </h2>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--mkt-text-secondary)] sm:text-lg">
            Start with the essentials and expand as your business grows.
            Every Tablor&apos;s setup is designed to make ordering faster,
            reduce errors, and keep your restaurant connected.
          </p>
        </div>

        <div className="mt-12 border-t border-[var(--mkt-border)] sm:mt-16">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="grid gap-8 border-b border-[var(--mkt-border)] py-10 sm:grid-cols-12 sm:items-center sm:gap-8 lg:py-12"
            >
              <div className="sm:col-span-3">
                <h3
                  className="text-2xl text-[var(--mkt-text-primary)] sm:text-3xl"
                  style={{ fontFamily: "var(--mkt-serif)" }}
                >
                  {tier.name}
                </h3>

                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--mkt-lime)]">
                  {tier.tagline}
                </p>
              </div>

              <div className="sm:col-span-3">
                <p className="text-sm leading-relaxed text-[var(--mkt-text-secondary)] sm:text-[15px]">
                  {tier.description}
                </p>

                <p className="mt-2 text-xs text-[var(--mkt-text-muted)]">
                  {tier.detail}
                </p>
              </div>

              <ul
                className="grid gap-2.5 sm:col-span-3"
                aria-label={`${tier.name} features`}
              >
                {systemParts.map((part) => {
                  const included = Boolean(tier.coverage[part.key]);

                  return (
                    <li
                      key={part.key}
                      className={`flex items-center gap-3 text-sm ${
                        included
                          ? "text-[var(--mkt-text-primary)]"
                          : "text-[var(--mkt-text-muted)] opacity-50"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: included
                            ? part.color
                            : "transparent",
                          border: `1px solid ${
                            included
                              ? part.color
                              : "var(--mkt-border-strong)"
                          }`,
                          boxShadow: included
                            ? `0 0 10px 1px ${part.color}55`
                            : "none",
                        }}
                      />

                      <span>{part.label}</span>

                      <span className="sr-only">
                        {included ? " — included" : " — not included"}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="sm:col-span-3 sm:text-right">
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center rounded-full border border-[var(--mkt-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--mkt-text-primary)] transition-all duration-300 hover:border-[var(--mkt-lime)] hover:text-[var(--mkt-lime)]"
                >
                  Talk to us
                </a>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <p className="text-xs leading-relaxed text-[var(--mkt-text-muted)]">
            Looking for a setup tailored to your restaurant, hotel, café,
            theatre, lounge, or banquet operation? Talk to our team and we&apos;ll
            help you choose the right Tablor&apos;s setup.
          </p>
        </div>
      </div>
    </section>
  );
}
