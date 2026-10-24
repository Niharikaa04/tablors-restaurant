"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

const FRONT_SRC = "/images/device-views/front.webp";
const BACK_SRC = "/images/device-views/back.webp";
const HANDSET_FRONT_SRC = "/images/device-views/tablor-handset-front.png";
const HANDSET_BACK_SRC = "/images/device-views/tablor-handset-back.png";
/** Venues whose walkthrough shows the handset terminal (matched on venue.name). */
const HANDSET_VENUES = new Set(["Hotel Room Service", "Hospitals"]);
/** width / height of the front image. Set from the real file. */
const ASPECT = 1600 / 637;

type Focus = { x: number; y: number; scale: number };
/** Every venue walks through the same seven steps, so each list has exactly seven entries. */
type Seven<T> = readonly [T, T, T, T, T, T, T];
type StepView = {
  image: "front" | "back";
  /** Where to zoom, in % of the image. PLACEHOLDER guesses: tune per step. */
  focus?: Focus;
};
type StepCopy = { title: string; text: string };
type Step = StepView & StepCopy;

/*
 * What each step shows (front/back photo and zoom area). Shared by every
 * venue, so the images and animation stay the same; only the words change.
 */
const STEP_VIEWS: Seven<StepView> = [
  { image: "front" },
  { image: "front", focus: { x: 16, y: 55, scale: 3 } },
  { image: "front", focus: { x: 77, y: 53, scale: 2.4 } },
  { image: "front", focus: { x: 35, y: 33, scale: 3 } },
  { image: "front", focus: { x: 38, y: 57, scale: 2.2 } },
  { image: "back" },
  { image: "front" },
];

/*
 * Words for each step, per venue. Built only from what the photos show
 * (keypad, QTY keys, button labels, LCD columns, number label) or what the
 * site already says (order goes to the kitchen; the owner or staff see every
 * order and bill in one place).
 * TO CONFIRM before publishing (hotel and hospital copy): what the handset
 * does, that each terminal is set up per room or bed, and that the call
 * button reaches hotel or hospital staff.
 */
const RESTAURANT_COPY: Seven<StepCopy> = [
  {
    title: "Meet the TBL-01",
    text: "A countertop ordering terminal that sits on every table, so guests can order without waiting.",
  },
  {
    title: "Choose with the keypad",
    text: "Type an item code on the numeric keypad and set the quantity with the QTY keys.",
  },
  {
    title: "See the order on the screen",
    text: "The built-in display lists each item with its code, quantity and price, plus the total.",
  },
  {
    title: "Confirm to send",
    text: "Press Confirm Order and the order goes straight to the kitchen.",
  },
  {
    title: "Ask for help or the bill",
    text: "Dedicated buttons let guests call a waiter, generate the bill, clear the order or leave feedback.",
  },
  {
    title: "Every table has a number",
    text: "Each terminal is labelled with its table number, so the order shows which table it came from.",
  },
  {
    title: "Kitchen and owner stay in sync",
    text: "The kitchen sees the order on screen and prepares it. The owner sees every table, order and bill in one place.",
  },
];

const HOTEL_COPY: Seven<StepCopy> = [
  {
    title: "Meet Tablor in the room",
    text: "A Tablor terminal sits in the guest room, so guests can order food and ask for room service without leaving the room.",
  },
  {
    title: "Choose with the keypad",
    text: "The guest types an item code on the numeric keypad and sets the quantity with the QTY keys.",
  },
  {
    title: "Check the order on the screen",
    text: "The display lists each item with its code, quantity and price, plus the total, so the guest can check before sending.",
  },
  {
    title: "Confirm to send",
    text: "The guest presses Confirm Order and the order goes straight to the hotel kitchen.",
  },
  {
    title: "Ask for service or the bill",
    text: "Dedicated buttons let guests call hotel staff, ask for their bill, clear the order or leave feedback.",
  },
  {
    title: "Every room has a number",
    text: "Each terminal is set up for one room, so every order shows which room it came from.",
  },
  {
    title: "Kitchen and staff stay in sync",
    text: "The kitchen sees each room order on screen and prepares it. Hotel staff see every room's orders and bills in one place.",
  },
];

const HOSPITAL_COPY: Seven<StepCopy> = [
  {
    title: "Meet Tablor at the bedside",
    text: "A Tablor terminal sits by the patient's bed or in the room, so patients or their attendants can request meals and other available services.",
  },
  {
    title: "Choose with the keypad",
    text: "The patient or attendant types a meal code on the numeric keypad and sets the quantity with the QTY keys.",
  },
  {
    title: "Check the request on the screen",
    text: "The display lists each item with its code, quantity and price, plus the total, so they can check before sending.",
  },
  {
    title: "Confirm to send the request",
    text: "Press Confirm Order and the meal request goes straight to the hospital kitchen.",
  },
  {
    title: "Ask hospital staff for help",
    text: "Dedicated buttons let patients or attendants call hospital staff, ask for the bill, clear the request or leave feedback.",
  },
  {
    title: "Every bed or room has a number",
    text: "Each terminal is set up for one room or bed, so every request shows where it came from.",
  },
  {
    title: "Kitchen and staff stay in sync",
    text: "The kitchen sees each meal request on screen and prepares it. Hospital staff can follow every room's requests in one place and keep service running smoothly.",
  },
];

/** Keyed by the venue name used in business-types.tsx. Unknown names fall back to the restaurant steps. */
const COPY_BY_VENUE: Record<string, Seven<StepCopy>> = {
  Restaurants: RESTAURANT_COPY,
  "Hotel Room Service": HOTEL_COPY,
  Hospitals: HOSPITAL_COPY,
};

export function VenueWalkthrough({
  venue,
  onClose,
}: {
  venue: { name: string; blurb: string; popupImage?: string } | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  // Words follow the selected venue; images and zoom stay shared.
  const copy = (venue && COPY_BY_VENUE[venue.name]) || RESTAURANT_COPY;
  const steps: Step[] = STEP_VIEWS.map((view, i) => ({ ...view, ...copy[i] }));
  const last = steps.length - 1;
  const s = steps[step];

  // Handset terminal images for Hotel Room Service and Hospitals only.
  const handset = !!venue && HANDSET_VENUES.has(venue.name);
  const frontSrc = handset ? HANDSET_FRONT_SRC : FRONT_SRC;
  const backSrc = handset ? HANDSET_BACK_SRC : BACK_SRC;

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
                src={frontSrc}
                alt={
                  handset
                    ? "Tablor ordering terminal with telephone handset, front view"
                    : "Tablor TBL-01 countertop ordering terminal, front view"
                }
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
                src={backSrc}
                alt={
                  handset
                    ? "Tablor ordering terminal with telephone handset, rear view with a plain back panel"
                    : "Tablor TBL-01 countertop ordering terminal, back view with the TABLE 05 label"
                }
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
                  Step {step + 1} of {steps.length}
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
            {steps.map((st, i) => (
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