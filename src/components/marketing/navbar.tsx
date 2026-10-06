"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CtaButton } from "./motion/cta-button";

// Section links resolve to "#id" on the homepage and "/#id" everywhere else,
// so the same items work from any marketing page.
const sectionLinks = [
  { hash: "#hero", label: "Product" },
  { hash: "#device", label: "The device" },
  { hash: "#story", label: "Table ordering" },
  { hash: "#features", label: "Features" },
  { hash: "#pricing", label: "Pricing" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const sectionHref = (hash: string) =>
    pathname === "/" ? hash : `/${hash}`;

  const navLinks = [
    ...sectionLinks.map((link) => ({
      href: sectionHref(link.hash),
      label: link.label,
    })),
    {
      href: sectionHref("#contact"),
      label: "Contact",
    },
  ];

  const demoHref = sectionHref("#demo");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || menuOpen
          ? "border-b border-[var(--mkt-border)] bg-[var(--mkt-bg)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mkt-container flex min-h-16 items-center justify-between py-3">
        {/* Official Tablor's Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label="Tablor's home"
        >
          <Image
            src="/brand/tablor-logo.png"
            alt="Tablor's"
            width={120}
            height={48}
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <ul className="hidden items-center gap-6 text-sm text-[var(--mkt-text-secondary)] md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="transition-colors hover:text-[var(--mkt-text-primary)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Login */}
          <Link
            href="/login"
            className="hidden text-sm text-[var(--mkt-text-secondary)] transition-colors hover:text-[var(--mkt-text-primary)] sm:inline"
          >
            Login
          </Link>

          {/* Book Demo */}
          <Link
            href={demoHref}
            className="hidden rounded-full border border-[var(--mkt-border-strong)] px-4 py-2 text-sm text-[var(--mkt-text-primary)] transition-colors hover:border-[var(--mkt-lime)] sm:inline-block"
          >
            Book Demo
          </Link>

          {/* Get Started */}
          <CtaButton
            href="/order"
            glow="lime"
            className="rounded-full bg-[var(--mkt-lime)] px-4 py-2 text-sm font-medium text-[var(--mkt-lime-ink)]"
          >
            Get Started
          </CtaButton>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--mkt-border)] text-[var(--mkt-text-primary)] md:hidden"
          >
            <span className="sr-only">
              {menuOpen ? "Close menu" : "Open menu"}
            </span>

            {menuOpen ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 2L14 14M14 2L2 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 4H14M2 8H14M2 12H14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {menuOpen && (
        <ul
          id="mobile-nav"
          className="absolute inset-x-0 top-full flex max-h-[calc(100vh-4.25rem)] flex-col gap-1 overflow-y-auto border-t border-[var(--mkt-border)] bg-[var(--mkt-bg)] px-6 py-4 text-sm text-[var(--mkt-text-secondary)] md:hidden"
        >
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block py-2 transition-colors hover:text-[var(--mkt-text-primary)]"
              >
                {link.label}
              </Link>
            </li>
          ))}

          {/* Mobile Login */}
          <li>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block py-2 transition-colors hover:text-[var(--mkt-text-primary)]"
            >
              Login
            </Link>
          </li>

          {/* Mobile Book Demo */}
          <li>
            <Link
              href={demoHref}
              onClick={() => setMenuOpen(false)}
              className="block py-2 transition-colors hover:text-[var(--mkt-text-primary)]"
            >
              Book Demo
            </Link>
          </li>

          {/* Mobile Get Started */}
          <li>
            <Link
              href="/order"
              onClick={() => setMenuOpen(false)}
              className="mt-2 block rounded-full bg-[var(--mkt-lime)] px-4 py-2 text-center font-medium text-[var(--mkt-lime-ink)]"
            >
              Get Started
            </Link>
          </li>
        </ul>
      )}
    </header>
  );
}