import Link from "next/link";

import { TablorLogo } from "@/components/brand/tablor-logo";
import { publicCompany, publicContact, publicSocials } from "@/lib/config";

import { socialPaths } from "./social-icons";

const product = [
  { href: "/#device", label: "The device" },
  { href: "/#story", label: "Table ordering" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
];

const support = [
  { href: "/#contact", label: "Contact" },
  { href: "/#demo", label: "Book a demo" },
  { href: "/login", label: "Login" },
  { href: "/order", label: "Get Started" },
];

const legal = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
];

const link =
  "transition-colors hover:text-[var(--mkt-text-primary)] focus-visible:text-[var(--mkt-text-primary)]";

const label =
  "text-[11px] uppercase tracking-[0.25em] text-[var(--mkt-text-muted)]";

function NavGroup({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className={label}>{title}</h3>

      <ul className="mt-4 space-y-3 text-sm text-[var(--mkt-text-secondary)]">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={link}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { phone, email, website } = publicContact;

  const siteHref = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : undefined;

  const socials = publicSocials.filter((social) => social.url);

  const hasAddress =
    Boolean(publicCompany.addressLine) ||
    Boolean(publicCompany.cityStatePin) ||
    Boolean(publicCompany.country);

  return (
    <footer
      id="contact"
      className="scroll-mt-[4.25rem] border-t border-[var(--mkt-border)] bg-[var(--mkt-bg)]"
    >
      <div className="mkt-container px-6 py-16 sm:py-20">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-5">
            <TablorLogo size="lg" href="/" />

            <p className="mt-7 max-w-lg text-sm leading-7 text-[var(--mkt-text-secondary)]">
              Tablor&apos;s table ordering system helps restaurants take
              orders more accurately, run service more efficiently and give
              guests a better dining experience.
            </p>

            {socials.length > 0 && (
              <div className="mt-8">
                <h3 className={label}>Follow us</h3>

                <ul className="mt-4 flex gap-3">
                  {socials.map((social) => (
                    <li key={social.key}>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--mkt-border)] text-[var(--mkt-text-secondary)] transition-all duration-300 hover:border-[var(--mkt-gold)] hover:text-[var(--mkt-gold)]"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path d={socialPaths[social.key]} />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Product */}
          <div className="lg:col-span-2">
            <NavGroup title="Product" items={product} />
          </div>

          {/* Support */}
          <div className="lg:col-span-2">
            <NavGroup title="Support" items={support} />
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3 className={label}>Contact</h3>

            <dl className="mt-5 space-y-5 text-sm">
              {phone && (
                <div>
                  <dt className="text-[var(--mkt-text-muted)]">Phone</dt>

                  <dd className="mt-1">
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      className={`text-[var(--mkt-text-primary)] ${link} hover:text-[var(--mkt-gold)]`}
                    >
                      {phone}
                    </a>
                  </dd>
                </div>
              )}

              {email && (
                <div>
                  <dt className="text-[var(--mkt-text-muted)]">Email</dt>

                  <dd className="mt-1 break-all">
                    <a
                      href={`mailto:${email}`}
                      className={`text-[var(--mkt-text-primary)] ${link} hover:text-[var(--mkt-gold)]`}
                    >
                      {email}
                    </a>
                  </dd>
                </div>
              )}

              {website && (
                <div>
                  <dt className="text-[var(--mkt-text-muted)]">Website</dt>

                  <dd className="mt-1 break-all">
                    <a
                      href={siteHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-[var(--mkt-text-primary)] ${link} hover:text-[var(--mkt-gold)]`}
                    >
                      {website}
                    </a>
                  </dd>
                </div>
              )}

              {hasAddress && (
                <div>
                  <dt className="text-[var(--mkt-text-muted)]">Address</dt>

                  <dd className="mt-1 leading-6 text-[var(--mkt-text-secondary)]">
                    <address className="not-italic">
                      {[
                        publicCompany.name,
                        publicCompany.addressLine,
                        publicCompany.cityStatePin,
                        publicCompany.country,
                      ]
                        .filter(Boolean)
                        .map((value) => (
                          <span key={value} className="block">
                            {value}
                          </span>
                        ))}
                    </address>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Bottom divider */}
        <div className="mt-16 border-t border-[var(--mkt-border)]" />

        {/* Copyright */}
        <div className="flex flex-col gap-5 pt-6 text-xs text-[var(--mkt-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Tablor&apos;s. All rights reserved.
          </p>

          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legal.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={link}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default Footer;