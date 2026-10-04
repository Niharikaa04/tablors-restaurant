import { BookDeviceIllustration } from "./book-device-illustration";
import { CtaButton } from "./motion/cta-button";
import { Reveal } from "./motion/reveal";

export function Contact() {
  return (
    <section
      id="contact"
      className="min-h-[70vh] border-t border-[var(--mkt-border)] bg-[var(--mkt-stage)] px-6 py-20 sm:py-24"
      style={{ scrollMarginTop: "4.25rem" }}
    >
      <div className="mkt-container grid items-center gap-12 md:grid-cols-[1fr_auto] md:gap-20">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-gold)]">
            Contact Tablor
          </p>

          <h1
            className="mt-4 max-w-2xl text-4xl leading-[1.08] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            Ready to upgrade your service?
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--mkt-text-secondary)]">
            See how Tablor&apos;s takes the order at the table, sends it to the
            kitchen and keeps billing accurate.
          </p>

          <div className="mt-8">
            <CtaButton
              href="/#demo"
              glow="lime"
              className="inline-block rounded-full bg-[var(--mkt-lime)] px-7 py-3.5 text-sm font-medium text-[var(--mkt-lime-ink)] transition-colors hover:bg-[#c4ec2a]"
            >
              Request a free demo
            </CtaButton>
          </div>
        </Reveal>

        <Reveal
          delay={0.1}
          className="hidden justify-self-center md:block"
        >
          <BookDeviceIllustration className="w-36 drop-shadow-[0_24px_40px_rgba(0,0,0,0.6)] lg:w-44" />
        </Reveal>
      </div>
    </section>
  );
}