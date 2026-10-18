"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const FRONT_SRC = "/images/tablor-ordering-device-front.webp";
const BACK_SRC = "/images/tablor-ordering-device-back.webp";
/** width / height of the front image. Set from the real file. */
const ASPECT = 2;

type Focus = { x: number; y: number; scale: number };
type Step = {
  title: string;
  text: string;
  image: "front" | "back";
  /** Where to zoom, in % of the image. PLACEHOLDER guesses: tune per step. */
  focus?: Focus;
};

/*
 * Only things visible on the supplied photos (keypad, QTY keys, button
 * labels, LCD columns, handset, cable, TABLE 05 label) or already stated in
 * the site copy (order goes to the kitchen; owner sees tables, orders, bills).
 */
const STEPS: Step[] = [
  {
    title: "Meet the TBL-01",
    text: "A countertop ordering terminal that sits on every table, so guests can order without waiting.",
    image: "front",
  },
  {
    title: "Choose with the keypad",
    text: "Type an item code on the numeric keypad and set the quantity with the QTY keys.",
    image: "front",
    focus: { x: 24, y: 58, scale: 1.9 },
  },
  {
    title: "See the order on the screen",
    text: "The built-in display lists each item with its code, quantity and price, plus the total.",
    image: "front",
    focus: { x: 70, y: 52, scale: 2 },
  },
  {
    title: "Confirm to send",
    text: "Press Confirm Order and the order goes straight to the kitchen.",
    image: "front",
    focus: { x: 42, y: 46, scale: 2 },
  },
  {
    title: "Ask for help or the bill",
    text: "Dedicated buttons let guests call a waiter, generate the bill, clear the order or leave feedback.",
    image: "front",
    focus: { x: 47, y: 56, scale: 1.8 },
  },
  {
    title: "Handset and cable",
    text: "A black handset with a coiled cable is built into the terminal.",
    image: "front",
    focus: { x: 50, y: 18, scale: 1.8 },
  },
  {
    title: "Every table has a number",
    text: "Each terminal is labelled with its table number, so the order shows which table it came from.",
    image: "back",
  },
  {
    title: "Kitchen and owner stay in sync",
    text: "The kitchen sees the order on screen and prepares it. The owner sees every table, order and bill in one place.",
    image: "front",
  },
];

export function VenueWalkthrough({
  venue,
  onClose,
}: {
  venue: { name: string; blurb: string } | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  const last = STEPS.length - 1;
  const s = STEPS[step];

  // Open/close the native modal dialog (focus trap, Esc, focus return built in).
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (venue && !d.open) {
      setStep(0);
      d.showModal();
    } else if (!venue && d.open) {
      d.close();
    }
  }, [venue]);

  // Lock page scroll while open; always restore.
  useEffect(() => {
    if (!venue) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [venue]);

  const prev = () => setStep((n) => Math.max(0, n - 1));
  const next = () => setStep((n) => Math.min(last, n + 1));

  const f = s.image === "front" ? s.focus : undefined;
  const scale = f && !reduce ? f.scale : 1;
  const x = f && !reduce ? `${(50 - f.x) * f.scale}%` : "0%";
  const y = f && !reduce ? `${(50 - f.y) * f.scale}%` : "0%";
  const move = { duration: reduce ? 0.01 : 0.7, ease: [0.16, 1, 0.3, 1] as const };

  const arrow =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-lime)]/60 text-[var(--mkt-lime)] transition-colors hover:bg-[var(--mkt-lime)] hover:text-[var(--mkt-lime-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)] disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none";

  return (
    <dialog
      ref={ref}
      aria-labelledby="walkthrough-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // backdrop click
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      className="m-auto w-[min(96vw,60rem)] max-h-[96svh] overflow-y-auto rounded-xl border border-[var(--mkt-lime)]/40 bg-[var(--mkt-stage)] p-0 text-[var(--mkt-text-primary)] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)] backdrop:bg-black/80"
    >
      {venue && (
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
              Tablor&apos;s for {venue.name}
            </p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-text-secondary)] hover:text-[var(--mkt-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)]"
            >
              Close ✕
            </button>
          </div>
          <p className="mt-2 max-w-xl text-sm text-[var(--mkt-text-secondary)]">{venue.blurb}</p>

          {/* stage: fixed ratio, so nothing shifts while images load */}
          <div
            className="relative mt-5 w-full overflow-hidden rounded-lg border border-[var(--mkt-border)] bg-[#07080a]"
            style={{ aspectRatio: ASPECT }}
          >
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: s.image === "front" ? 1 : 0, scale, x, y }}
              transition={move}
              aria-hidden={s.image !== "front"}
            >
              <Image
                src={FRONT_SRC}
                alt="Tablor TBL-01 countertop ordering terminal, front view"
                fill
                sizes="(min-width: 1024px) 960px, 96vw"
                className="object-contain"
                draggable={false}
              />
            </motion.div>
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: s.image === "back" ? 1 : 0 }}
              transition={move}
              aria-hidden={s.image !== "back"}
            >
              <Image
                src={BACK_SRC}
                alt="Tablor TBL-01 countertop ordering terminal, back view with the TABLE 05 label"
                fill
                sizes="(min-width: 1024px) 960px, 96vw"
                className="object-contain"
                draggable={false}
              />
            </motion.div>
          </div>

          {/* steps */}
          <div className="mt-5 flex items-center gap-4">
            <button type="button" onClick={prev} disabled={step === 0} aria-label="Previous step" className={arrow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 text-center" aria-live="polite">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0.01 : 0.4 }}
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h3
                  id="walkthrough-title"
                  className="mt-1.5 text-xl leading-tight sm:text-2xl"
                  style={{ fontFamily: "var(--mkt-serif)" }}
                >
                  {s.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
                  {s.text}
                </p>
              </motion.div>
            </div>

            <button type="button" onClick={next} disabled={step === last} aria-label="Next step" className={arrow}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Choose a step">
            {STEPS.map((st, i) => (
              <button
                key={st.title}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}: ${st.title}`}
                aria-current={i === step ? "step" : undefined}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)] motion-reduce:transition-none ${
                  i === step ? "w-6 bg-[var(--mkt-lime)]" : "w-2 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>

          {step === last && (
            <div className="mt-5 text-center">
              <a
                href="#demo"
                onClick={() => {
                  // close first so the page can scroll to the demo form
                  document.documentElement.style.overflow = "";
                  ref.current?.close();
                }}
                className="inline-block rounded-full bg-[var(--mkt-lime)] px-7 py-3 text-sm font-medium text-[var(--mkt-lime-ink)] transition-colors hover:bg-[#c4ec2a]"
              >
                Request a free demo
              </a>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}