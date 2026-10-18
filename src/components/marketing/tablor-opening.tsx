"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

/**
 * Tablor opening: the countertop terminal fades in, then the view pushes
 * toward its screen as the gate fades into the homepage.
 *
 * - Scene A: logo, headline and the device fade in over a near-black studio.
 * - Scene C: Table → Kitchen → Owner, plus "Your orders. Connected."
 * - Scene D: ENTER TABLOR pushes in toward the screen, then the gate fades
 *   out and `tablor:opened` fires. Skip / Escape leave immediately.
 *
 * The device is a flat photo. The "push" is a scale transition, not a 3D
 * camera, and the back view is a plain crossfade to the second photo.
 *
 * - Shown on "/" with no #hash every time the page is opened.
 * - The homepage is already rendered underneath (inert while the gate is up).
 * - prefers-reduced-motion: no push; the gate does a plain crossfade.
 */

/**
 * width / height of tablor-ordering-device-front.png, exactly (e.g. 1600x800
 * → 2). The back image is letterboxed inside the same box by object-contain.
 */
const DEVICE_ASPECT = 2;

/** Where the push zooms toward, in % of the device box (roughly the screen). */
const PUSH_ORIGIN = "62% 55%";

const FRONT_SRC = "/images/tablor-ordering-device-front.webp";
const BACK_SRC = "/images/tablor-ordering-device-back.webp";

const FADE_MS = 500;
/** Length of the push toward the screen, then the gate fades. */
const PUSH_MS = 1200;
const PUSH_SCALE = 2.2;
/** Reduced motion: short hold, then a plain crossfade. */
const REDUCED_HOLD_MS = 600;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const PUSH_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1];

type Phase = "idle" | "entering" | "leaving" | "gone";
type View = "front" | "back";

/** Restrained radium glow for lime type. */
const LIME_GLOW = {
  textShadow: "0 0 22px color-mix(in srgb, var(--mkt-lime) 38%, transparent)",
};
const LIME_HAIRLINE = "color-mix(in srgb, var(--mkt-lime) 45%, transparent)";

/** Feathers the photo's edges so its dark backdrop doesn't show as a box. */
const FEATHER =
  "radial-gradient(ellipse 74% 72% at 50% 50%, #000 60%, transparent 100%)";
const FEATHER_STYLE = { maskImage: FEATHER, WebkitMaskImage: FEATHER } as const;

const SEQUENCE = ["Table", "Kitchen", "Owner"] as const;

/** Stage width: as wide as the viewport and height allow, capped at 1000px. */
const STAGE_WIDTH = `max(280px, min(92vw, calc((100svh - 24rem) * ${DEVICE_ASPECT}), 1000px))`;

/** Staggered load-in: each piece fades (and drifts a little) into place. */
function entrance(
  reduce: boolean | null,
  delay: number,
  from: { x?: number; y?: number; scale?: number } = {},
) {
  return {
    initial: { opacity: 0, ...(reduce ? {} : from) },
    animate: { opacity: 1, x: 0, y: 0, scale: 1 },
    transition: { duration: reduce ? 0.01 : 0.9, delay: reduce ? 0 : delay, ease: EASE },
  };
}

export function TablorOpening() {
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [view, setView] = useState<View>("front");
  const phaseRef = useRef<Phase>("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const inerted = useRef<Element[]>([]);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const unlock = useCallback(() => {
    inerted.current.forEach((el) => el.removeAttribute("inert"));
    inerted.current = [];
    document.documentElement.style.overflow = "";
  }, []);

  const lock = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    inerted.current = Array.from(root.parentElement?.children ?? []).filter(
      (el) => el !== root,
    );
    inerted.current.forEach((el) => el.setAttribute("inert", ""));
    document.documentElement.style.overflow = "hidden";
    root.focus({ preventScroll: true });
  }, []);

  // Lock the page and take focus when the gate mounts.
  // (Remove this effect if layout.tsx already locks scroll / sets inert.)
  useEffect(() => {
    lock();
  }, [lock]);

  // Release the page as soon as the gate starts leaving.
  useEffect(() => {
    if (phase === "leaving" || phase === "gone") unlock();
  }, [phase, unlock]);

  // Unmount cleanup: timers and page lock.
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      unlock();
    },
    [unlock],
  );

  /** Fade the gate out and tell the page. Safe to call more than once. */
  const leave = useCallback(() => {
    if (phaseRef.current === "leaving" || phaseRef.current === "gone") return;
    clearTimers(); // cancel any pending auto-continue so we never leave twice
    go("leaving");
    window.dispatchEvent(new Event("tablor:opened"));
    later(() => go("gone"), FADE_MS);
  }, [clearTimers, go, later]);

  /** ENTER TABLOR: push toward the screen, then leave automatically. */
  const enter = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    go("entering");
    later(leave, reduceMotion ? REDUCED_HOLD_MS : PUSH_MS);
  }, [go, later, leave, reduceMotion]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") leave();
  }

  if (phase === "gone") return null;

  const pushing = phase === "entering" || phase === "leaving";
  const viewTransition = { duration: reduceMotion ? 0.01 : 0.5, ease: EASE };

  return (
    <div
      ref={rootRef}
      data-tablor-gate
      // The inline guard in layout.tsx may set `hidden` before hydration.
      suppressHydrationWarning
      role="dialog"
      aria-modal="true"
      aria-label="Open Tablor"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[var(--mkt-stage)] outline-none transition-opacity ${
        phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* black studio: a wide, faint key light on the counter */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0.01 : 1.2, delay: reduceMotion ? 0 : 0.6 }}
        style={{
          background:
            "radial-gradient(ellipse 46% 32% at 50% 56%, rgba(212,175,55,0.09), transparent 72%), radial-gradient(ellipse 30% 18% at 50% 62%, color-mix(in srgb, var(--mkt-lime) 6%, transparent), transparent 75%)",
        }}
      />

      {/* header: logo on the left, wordmark centred, skip on the right */}
      <motion.header
        {...entrance(reduceMotion, 0.3)}
        className="relative z-20 grid grid-cols-3 items-center px-6 pt-6 sm:px-10"
      >
        <Image
          src="/brand/tablor-logo.png"
          alt="Tablors – smart table ordering system"
          width={120}
          height={120}
          priority
          style={{ height: "auto" }}
          className="col-start-1 h-10 w-auto justify-self-start rounded-md sm:h-12"
        />
        <span
          className="hidden text-[13px] uppercase tracking-[0.5em] text-[var(--mkt-lime)] sm:col-start-2 sm:block sm:text-center"
          style={LIME_GLOW}
        >
          Tablor&apos;s
        </span>
        <button
          type="button"
          onClick={leave}
          className="col-start-3 justify-self-end rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-text-secondary)] transition-colors hover:text-[var(--mkt-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)]"
        >
          Skip <span aria-hidden="true">→</span>
        </button>
      </motion.header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(1rem,3svh,2rem)] px-6 pb-6">
        {/* headline: two short lines, centred above the device */}
        <div
          className={`text-center transition-opacity duration-500 ${
            pushing ? "opacity-0" : "opacity-100"
          }`}
        >
          <h2
            className="font-normal leading-[1.04] tracking-tight text-[clamp(1.75rem,min(6vw,6.5svh),4.25rem)]"
            style={{ fontFamily: "var(--mkt-serif)", ...LIME_GLOW }}
          >
            <motion.span
              {...entrance(reduceMotion, 0.55, { y: 14 })}
              className="block text-[var(--mkt-lime)]"
            >
              Your table.
            </motion.span>
            <motion.span
              {...entrance(reduceMotion, 0.8, { y: 14 })}
              className="block text-[var(--mkt-lime)]/55"
            >
              Your order.
            </motion.span>
          </h2>
        </div>

        {/* the device: fades/rises in, then pushes toward the screen on Enter */}
        <motion.div {...entrance(reduceMotion, 1.0, { y: 24, scale: 0.96 })} className="relative">
          <motion.div
            animate={{ scale: pushing && !reduceMotion ? PUSH_SCALE : 1 }}
            transition={{ duration: pushing ? PUSH_MS / 1000 : 0.01, ease: PUSH_EASE }}
            style={{ transformOrigin: PUSH_ORIGIN }}
          >
            {/* fixed ratio + width: reserves space, so no layout shift on load */}
            <div
              className="relative select-none"
              style={{ width: STAGE_WIDTH, aspectRatio: DEVICE_ASPECT }}
            >
              {/* soft floor shadow (static) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-[8%] -bottom-[2%] h-[7%] rounded-full bg-black/90 blur-xl"
              />

              {/* back view (crossfades in via the discreet control) */}
              <motion.div
                className="absolute inset-0"
                aria-hidden={view !== "back"}
                initial={false}
                animate={{ opacity: view === "back" ? 1 : 0 }}
                transition={viewTransition}
              >
                <Image
                  src={BACK_SRC}
                  alt="Tablor ordering terminal, back view: dark angled casing with the TABLE 05 label and product identification sticker"
                  fill
                  sizes="(min-width: 1024px) 1000px, 92vw"
                  draggable={false}
                  className="object-contain"
                  style={FEATHER_STYLE}
                />
              </motion.div>

              {/* front view */}
              <motion.div
                className="absolute inset-0"
                aria-hidden={view !== "front"}
                initial={false}
                animate={{ opacity: view === "front" ? 1 : 0 }}
                transition={viewTransition}
              >
                <Image
                  src={FRONT_SRC}
                  alt="Tablor ordering terminal, front view: silver panel with a numeric keypad, order buttons, built-in LCD and a black handset on top"
                  fill
                  priority
                  sizes="(min-width: 1024px) 1000px, 92vw"
                  draggable={false}
                  className="object-contain"
                  style={FEATHER_STYLE}
                />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* journey + the single entrance action + tagline */}
        <motion.div
          {...entrance(reduceMotion, 1.7, { y: 10 })}
          className="flex flex-col items-center gap-[clamp(0.9rem,2.6svh,1.5rem)] text-center"
        >
          <ol
            aria-label="How Tablor works: table, kitchen, owner"
            className="flex items-center gap-3 sm:gap-5"
          >
            {SEQUENCE.map((label, i) => {
              const delay = reduceMotion ? 0 : i * 250;
              return (
                <li key={label} className="flex items-center gap-3 sm:gap-5">
                  <span
                    className="text-[10px] uppercase tracking-[0.35em] transition-[color,text-shadow] duration-700 sm:text-[11px]"
                    style={{
                      color: pushing ? "var(--mkt-lime)" : "var(--mkt-text-secondary)",
                      transitionDelay: pushing ? `${delay}ms` : "0ms",
                      textShadow: pushing ? LIME_GLOW.textShadow : "none",
                    }}
                  >
                    {label}
                  </span>
                  {i < SEQUENCE.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="h-px w-6 transition-colors duration-700 sm:w-12"
                      style={{
                        background: pushing ? LIME_HAIRLINE : "rgba(255,255,255,0.14)",
                        transitionDelay: pushing ? `${delay + 125}ms` : "0ms",
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={enter}
            disabled={phase !== "idle"}
            className="group inline-flex min-h-12 items-center gap-4 rounded-[3px] border border-[var(--mkt-lime)]/45 px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--mkt-lime)] transition-[background-color,color,border-color,box-shadow] duration-500 hover:border-[var(--mkt-lime)] hover:bg-[var(--mkt-lime)] hover:text-black hover:shadow-[0_0_30px_-8px_var(--mkt-lime)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--mkt-lime)] disabled:opacity-50 motion-reduce:transition-none"
          >
            Enter Tablor
            <span
              aria-hidden="true"
              className="transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </button>

          <div
            className={`flex flex-col items-center gap-2 transition-opacity duration-500 ${
              pushing ? "opacity-0" : "opacity-100"
            }`}
          >
            <p className="text-[11px] tracking-wide text-[var(--mkt-text-secondary)]">
              Your orders. Connected.
            </p>

            {/* discreet secondary control: inspect the back of the device */}
            <button
              type="button"
              onClick={() => setView((v) => (v === "front" ? "back" : "front"))}
              disabled={phase !== "idle"}
              aria-label={
                view === "front" ? "Show the back of the device" : "Show the front of the device"
              }
              className="rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-text-secondary)]/70 underline-offset-4 transition-colors hover:text-[var(--mkt-text-primary)] hover:underline focus-visible:text-[var(--mkt-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)] motion-reduce:transition-none"
            >
              {view === "front" ? "View back" : "View front"}
            </button>
            <span className="sr-only" aria-live="polite">
              Showing the {view} of the device
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}