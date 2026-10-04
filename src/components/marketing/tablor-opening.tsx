"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

import { BookDeviceIllustration } from "./book-device-illustration";

/**
 * Tablor opening: a product entrance, not a hero.
 *
 * A closed gold Tablor's book stands alone in a black studio. Radium-green
 * type frames it; the book is the only warm object on screen. The visitor
 * drags/swipes the cover open (or clicks/taps, or presses "Enter Tablor").
 * The cover swings on its spine, the Table → Kitchen → Owner line lights up
 * step by step, and the gate fades into the homepage.
 *
 * - Shown on "/" with no #hash every time the page is opened.
 * - The homepage is already rendered underneath (made inert while the gate
 *   is up).
 * - Drag, tilt and hover all write to motion values (no React re-renders).
 * - prefers-reduced-motion: no drag, tilt, float or 3D; one button and a
 *   plain crossfade.
 */

const OPEN_DEG = 165;
/** Fraction of the stage width the pointer must travel for a full open. */
const DRAG_RANGE = 0.55;
const TAP_SLOP = 6;
const FADE_MS = 500;
/** How long the opened book + lit sequence is held before auto-continuing. */
const OPEN_HOLD_MS = 3800;
/** Maximum cursor tilt, in degrees. */
const TILT_Y = 4;
const TILT_X = 3;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Phase = "closed" | "opening" | "open" | "leaving" | "gone";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Cover geometry, as % of the illustration's 480x600 viewBox
// (cover rect is x84–424, y44–544; the hinge is the cover's left edge).
const COVER = { left: "17.5%", top: "7.33%", width: "70.83%", height: "83.33%" };
const HINGE = "17.5% 50%";

/** Restrained radium glow for lime type. */
const LIME_GLOW = {
  textShadow: "0 0 22px color-mix(in srgb, var(--mkt-lime) 38%, transparent)",
};
const LIME_HAIRLINE = "color-mix(in srgb, var(--mkt-lime) 45%, transparent)";

const SEQUENCE = ["Table", "Kitchen", "Owner"] as const;

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
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("closed");
  const phaseRef = useRef<Phase>("closed");
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const inerted = useRef<Element[]>([]);
  const idle = useRef<ReturnType<typeof animate> | null>(null);
  const drag = useRef<{
    id: number;
    startX: number;
    startP: number;
    lastX: number;
    lastT: number;
    v: number;
    moved: boolean;
  } | null>(null);

  // 0 = closed, 1 = fully open. Driven by drag, spring and the idle tug.
  const progress = useMotionValue(0);
  const coverRotate = useTransform(progress, [0, 1], [0, -OPEN_DEG]);
  // Keeps the hinge on the centre line, so the opened book stays centred.
  const stageX = useTransform(progress, [0, 1], ["0%", "32%"]);
  const stageScale = useTransform(progress, [0, 1], [1.15, 1]);
  const coverShade = useTransform(progress, [0, 0.5, 1], [0, 0.25, 0.55]);
  const insideShade = useTransform(progress, [0, 0.6, 1], [0.7, 0.15, 0]);
  const shadowScale = useTransform(progress, [0, 1], [1, 1.55]);
  const pedestalScale = useTransform(progress, [0, 1], [1, 1.25]);
  // Headline recedes as the book opens; the frame brackets let go of it.
  const headlineOpacity = useTransform(progress, [0, 0.3], [1, 0.22]);
  const headlineY = useTransform(progress, [0, 0.3], [0, -8]);
  const bracketOpacity = useTransform(progress, [0, 0.35], [1, 0]);

  // Cursor position (-1..1) → a small, springy tilt.
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotY = useSpring(useTransform(pointerX, [-1, 1], [-TILT_Y, TILT_Y]), {
    stiffness: 90,
    damping: 20,
  });
  const rotX = useSpring(useTransform(pointerY, [-1, 1], [TILT_X, -TILT_X]), {
    stiffness: 90,
    damping: 20,
  });

  // Hovering the book brings it "closer": more glow, deeper shadow.
  const lift = useMotionValue(0);
  const hoverScale = useTransform(lift, [0, 1], [1, 1.025]);
  const glowOpacity = useTransform(lift, [0, 1], [0.32, 0.6]);
  const shadowOpacity = useTransform(lift, [0, 1], [0.7, 1]);

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

  const startIdle = useCallback(() => {
    if (reduceMotion) return;
    idle.current?.stop();
    // A small tug on the cover, so the book reads as something to open.
    idle.current = animate(progress, [0, 0.05, 0], {
      duration: 2.4,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 2.2,
    });
  }, [progress, reduceMotion]);

  // Show the gate on the home page every time.
  // There is intentionally no localStorage/session persistence here.

  // Release the page as soon as the gate starts leaving; settle the tilt.
  useEffect(() => {
    if (phase === "leaving" || phase === "gone") unlock();
    if (phase !== "closed") {
      pointerX.set(0);
      pointerY.set(0);
      animate(lift, 0, { duration: 0.4 });
    }
  }, [phase, unlock, pointerX, pointerY, lift]);

  useEffect(
    () => () => {
      idle.current?.stop();
      timers.current.forEach((t) => window.clearTimeout(t));
      unlock();
    },
    [unlock],
  );

  const leave = useCallback(
    (delay: number) => {
      later(() => {
        go("leaving");
        window.dispatchEvent(new Event("tablor:opened"));
        later(() => go("gone"), FADE_MS);
      }, delay);
    },
    [go, later],
  );

  const finishOpening = useCallback(() => {
    go("open");
    leave(reduceMotion ? 900 : OPEN_HOLD_MS);
  }, [go, leave, reduceMotion]);

  const open = useCallback(() => {
    if (phaseRef.current !== "closed") return;
    idle.current?.stop();
    go("opening");
    if (reduceMotion) {
      progress.set(1);
      finishOpening();
      return;
    }
    animate(progress, 1, {
      type: "spring",
      stiffness: 90,
      damping: 20,
      restDelta: 0.002,
      onComplete: finishOpening,
    });
  }, [finishOpening, go, progress, reduceMotion]);

  const skip = useCallback(() => {
    if (phaseRef.current === "leaving" || phaseRef.current === "gone") return;
    idle.current?.stop();
    go("leaving");
    window.dispatchEvent(new Event("tablor:opened"));
    later(() => go("gone"), FADE_MS);
  }, [go, later]);

  /** One primary action: opens the book, or continues once it is open. */
  const enter = useCallback(() => {
    if (phaseRef.current === "closed") {
      open();
    } else if (phaseRef.current === "open") {
      clearTimers(); // cancel the auto-continue so we don't leave twice
      skip();
    }
  }, [clearTimers, open, skip]);

  const settleBack = useCallback(() => {
    animate(progress, 0, {
      type: "spring",
      stiffness: 180,
      damping: 22,
      onComplete: startIdle,
    });
  }, [progress, startIdle]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (phaseRef.current !== "closed" || reduceMotion) return;
    idle.current?.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startP: progress.get(),
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > TAP_SLOP) d.moved = true;
    const width = stageRef.current?.offsetWidth ?? 320;
    progress.set(clamp(d.startP + -dx / (width * DRAG_RANGE), 0, 1));
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientX - d.lastX) / dt; // px/ms, negative = leftwards
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const flicked = d.moved && d.v < -0.45;
    // A click/tap (no real movement) also opens: no precise drag required.
    if (!d.moved || progress.get() > 0.35 || flicked) open();
    else settleBack();
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    settleBack();
  }

  // Cursor tilt is tracked across the whole screen, so the book follows
  // the mouse even before it is over it. Mouse only; never on touch.
  function onRootPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || reduceMotion || phaseRef.current !== "closed") return;
    pointerX.set((e.clientX / window.innerWidth - 0.5) * 2);
    pointerY.set((e.clientY / window.innerHeight - 0.5) * 2);
  }

  if (phase === "gone") return null;

  const opened = phase === "open" || phase === "leaving";
  const floating = phase === "closed" && !reduceMotion;

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
      onKeyDown={(e) => {
        if (e.key === "Escape") skip();
      }}
      onPointerMove={onRootPointerMove}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
      className={`fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[var(--mkt-stage)] outline-none transition-opacity ${
        phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* black studio: one faint pool of warm light where the book stands */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0.01 : 1.2, delay: reduceMotion ? 0 : 0.6 }}
        style={{
          background:
            "radial-gradient(ellipse 34% 30% at 50% 56%, rgba(212,175,55,0.08), transparent 72%)",
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
          onClick={skip}
          className="col-start-3 justify-self-end rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-text-secondary)] transition-colors hover:text-[var(--mkt-text-primary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mkt-lime)]"
        >
          Skip <span aria-hidden="true">→</span>
        </button>
      </motion.header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(1.25rem,4svh,2.5rem)] px-6 pb-6">
        {/* headline: two short lines, centred above the book */}
        <motion.div style={{ opacity: headlineOpacity, y: headlineY }} className="text-center">
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
        </motion.div>

        {/* the book: the one gold object */}
        <motion.div {...entrance(reduceMotion, 1.0, { y: 24, scale: 0.94 })} className="relative">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse" && phaseRef.current === "closed") {
                animate(lift, 1, { duration: 0.5, ease: "easeOut" });
              }
            }}
            onPointerLeave={() => animate(lift, 0, { duration: 0.5, ease: "easeOut" })}
            className={`relative aspect-[4/5] w-[max(200px,min(62vw,calc((100svh_-_25rem)/1.35),460px))] touch-none select-none lg:w-[max(240px,min(34vw,calc((100svh_-_24rem)/1.35),500px))] ${
              phase === "closed" && !reduceMotion ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            style={{ perspective: "1600px", containerType: "inline-size" }}
          >
            {/* studio horizon: a hairline of radium light at pedestal height */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[92.5%] h-px w-[300%] -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.01 : 1.4, delay: reduceMotion ? 0 : 1.3 }}
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--mkt-lime) 28%, transparent) 30%, color-mix(in srgb, var(--mkt-lime) 28%, transparent) 70%, transparent)",
              }}
            />

            {/* viewfinder brackets frame the closed book, then let go */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-[10%] -bottom-[1%] -top-[5%]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.01 : 1.2, delay: reduceMotion ? 0 : 1.5 }}
            >
              <motion.div className="absolute inset-0" style={{ opacity: bracketOpacity }}>
                {[
                  "left-0 top-0 border-l border-t",
                  "right-0 top-0 border-r border-t",
                  "bottom-0 left-0 border-b border-l",
                  "bottom-0 right-0 border-b border-r",
                ].map((c) => (
                  <span
                    key={c}
                    className={`absolute h-4 w-4 ${c}`}
                    style={{ borderColor: LIME_HAIRLINE }}
                  />
                ))}
              </motion.div>
            </motion.div>

            {/* dark circular pedestal with a lit gold edge */}
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[85%] h-[15%] w-[128%] -translate-x-1/2"
              style={{ scaleX: pedestalScale }}
            >
              <div
                className="h-full w-full rounded-[50%] border"
                style={{
                  borderColor: "rgba(212,175,55,0.38)",
                  background:
                    "radial-gradient(ellipse at 50% 35%, #23251b 0%, #12130d 55%, #0a0b08 100%)",
                  boxShadow:
                    "inset 0 1px 0 rgba(240,212,122,0.35), 0 0 34px -8px rgba(212,175,55,0.3), 0 26px 40px -14px rgba(0,0,0,0.95)",
                }}
              />
              <div
                className="absolute inset-[16%_12%] rounded-[50%] border"
                style={{ borderColor: "rgba(212,175,55,0.1)" }}
              />
            </motion.div>

            {/* tilt (cursor) → float (idle) → shift/scale (opening) → parts */}
            <motion.div
              className="absolute inset-0"
              style={{
                rotateX: rotX,
                rotateY: rotY,
                scale: hoverScale,
                transformStyle: "preserve-3d",
              }}
            >
              <motion.div
                className="absolute inset-0"
                animate={floating ? { y: [0, -6, 0] } : { y: 0 }}
                transition={
                  floating
                    ? { duration: 6, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.4 }
                }
                style={{ transformStyle: "preserve-3d" }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ x: stageX, scale: stageScale, transformStyle: "preserve-3d" }}
                >
                  {/* ground shadow */}
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-x-[10%] bottom-[5%] h-[4%] rounded-full bg-black blur-xl"
                    style={{ scaleX: shadowScale, originX: 0.35, opacity: shadowOpacity }}
                  />

                  {/* soft gold rim light behind the cover */}
                  <div
                    aria-hidden="true"
                    className="absolute"
                    style={{ ...COVER, transform: "translateZ(-3px)" }}
                  >
                    <motion.div
                      className="absolute -inset-[5%] rounded-[4cqw] blur-2xl"
                      style={{ background: "rgba(212,175,55,0.55)", opacity: glowOpacity }}
                    />
                  </div>

                  {/* what stays put: spine + the inside of the device */}
                  <div
                    aria-hidden="true"
                    className="absolute rounded-[1.5cqw]"
                    style={{
                      left: "11.25%",
                      top: "8%",
                      width: "7.1%",
                      height: "84.7%",
                      transform: "translateZ(-1px)",
                      background: "linear-gradient(90deg,#05070d,#1b2236)",
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="tablor-device absolute overflow-hidden rounded-[2cqw] border"
                    style={{
                      ...COVER,
                      transform: "translateZ(-1px)",
                      background: "#0b0f1a",
                      borderColor: "#2b3450",
                    }}
                  >
                    <InsideSpread />
                    <motion.div
                      className="absolute inset-0 bg-black"
                      style={{ opacity: insideShade }}
                    />
                  </div>

                  {/* the cover, hinged on its spine edge */}
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                      rotateY: coverRotate,
                      transformOrigin: HINGE,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
                      <BookDeviceIllustration className="h-full w-full" />
                      <motion.div
                        className="absolute rounded-[2cqw] bg-black"
                        style={{ ...COVER, opacity: coverShade }}
                      />
                    </div>
                    {/* underside of the cover, seen once it swings past 90° */}
                    <div
                      className="absolute rounded-[2cqw] border"
                      style={{
                        ...COVER,
                        transform: "rotateY(180deg)",
                        backfaceVisibility: "hidden",
                        background: "linear-gradient(135deg,#141a2b,#0b0f1a)",
                        borderColor: "#2b3450",
                      }}
                    >
                      <div
                        className="absolute inset-[3cqw] rounded-[1cqw] border"
                        style={{ borderColor: "rgba(212,175,55,0.35)" }}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* technical callouts: appear once the book is open (large screens) */}
            {opened && (
              <>
                <SideLabel side="left" caption="Order placed" value="Table 05" reduce={reduceMotion} />
                <SideLabel side="right" caption="Sent to" value="Kitchen" reduce={reduceMotion} />
              </>
            )}
          </div>
        </motion.div>

        {/* sequence + the single entrance action */}
        <motion.div
          {...entrance(reduceMotion, 1.7, { y: 10 })}
          className="flex flex-col items-center gap-[clamp(1rem,3svh,1.75rem)] text-center"
        >
          <ol
            aria-label="How Tablor works: table, kitchen, owner"
            className="flex items-center gap-3 sm:gap-5"
          >
            {SEQUENCE.map((label, i) => {
              const lit = opened || phase === "opening";
              const delay = reduceMotion ? 0 : 500 + i * 550;
              return (
                <li key={label} className="flex items-center gap-3 sm:gap-5">
                  <span
                    className="text-[10px] uppercase tracking-[0.35em] transition-[color,text-shadow] duration-700 sm:text-[11px]"
                    style={{
                      color: lit ? "var(--mkt-lime)" : "var(--mkt-text-secondary)",
                      transitionDelay: lit ? `${delay}ms` : "0ms",
                      textShadow: lit ? LIME_GLOW.textShadow : "none",
                    }}
                  >
                    {label}
                  </span>
                  {i < SEQUENCE.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="h-px w-6 transition-colors duration-700 sm:w-12"
                      style={{
                        background: lit ? LIME_HAIRLINE : "rgba(255,255,255,0.14)",
                        transitionDelay: lit ? `${delay + 250}ms` : "0ms",
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
            disabled={phase === "opening"}
            className="group inline-flex items-center gap-4 rounded-[3px] border border-[var(--mkt-lime)]/45 px-8 py-3.5 text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--mkt-lime)] transition-[background-color,color,border-color,box-shadow] duration-500 hover:border-[var(--mkt-lime)] hover:bg-[var(--mkt-lime)] hover:text-black hover:shadow-[0_0_30px_-8px_var(--mkt-lime)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--mkt-lime)] disabled:opacity-50 motion-reduce:transition-none"
          >
            Enter Tablor
            <span
              aria-hidden="true"
              className="transition-transform duration-500 group-hover:translate-x-1 motion-reduce:transition-none"
            >
              →
            </span>
          </button>

          {/* drag hint: keeps its space so nothing shifts when it goes */}
          <p
            aria-hidden="true"
            className={`h-4 text-[11px] tracking-wide text-[var(--mkt-text-secondary)] transition-opacity duration-500 ${
              phase === "closed" && !reduceMotion ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="hidden [@media(pointer:coarse)]:inline">Swipe the cover, or tap</span>
            <span className="[@media(pointer:coarse)]:hidden">Drag the cover, or click</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/** Small technical callout beside the opened book (large screens only). */
function SideLabel({
  side,
  caption,
  value,
  reduce,
}: {
  side: "left" | "right";
  caption: string;
  value: string;
  reduce: boolean | null;
}) {
  const left = side === "left";
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute top-[44%] hidden items-center gap-3 lg:flex ${
        left ? "right-[132%] flex-row" : "left-[132%] flex-row-reverse"
      }`}
      initial={{ opacity: 0, x: reduce ? 0 : left ? 10 : -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reduce ? 0.01 : 0.8, delay: reduce ? 0 : 0.3, ease: EASE }}
    >
      <div className={left ? "text-right" : "text-left"}>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--mkt-text-secondary)]">
          {caption}
        </p>
        <p
          className="mt-1.5 text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]"
          style={LIME_GLOW}
        >
          {value}
        </p>
      </div>
      <span className="h-px w-14" style={{ background: LIME_HAIRLINE }} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Inside of the device: the menu page, keypad and order LCD, as they  */
/* are printed in the product document (same codes as <OpenDevice />). */
/* Sizes use container-query units so it scales with the stage.        */
/* ------------------------------------------------------------------ */

const pageRows = [
  [85, "Chicken Fry"],
  [86, "Chicken 65"],
  [87, "Egg Fry"],
  [88, "Fish Fry"],
  [89, "Chicken Curry"],
  [90, "Mutton Curry"],
] as const;

const lcdRows = [
  ["055", "Veg Biryani", 1, "250/-"],
  ["125", "Butter Naan", 3, "125/-"],
  ["114", "Dal Tadka", 2, "400/-"],
] as const;

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];

function InsideSpread() {
  return (
    <div className="flex h-full flex-col gap-[2cqw] p-[2.2cqw]">
      <div className="flex-[1.2] rounded-[1cqw] bg-[#f6f6f3] p-[2.4cqw] text-[#111]">
        <div className="flex items-center gap-[1.6cqw] border-b border-black/10 pb-[1.2cqw]">
          <span className="rounded-[0.5cqw] bg-[#d81f26] px-[1.2cqw] py-[0.3cqw] text-[2.4cqw] font-bold text-white">
            Page 3
          </span>
          <span className="text-[2.8cqw] font-bold text-[#d81f26]">Non veg items</span>
        </div>
        <ul className="mt-[1.4cqw] space-y-[0.9cqw]">
          {pageRows.map(([code, name]) => (
            <li key={code} className="flex items-center gap-[1.6cqw] text-[3cqw] font-medium">
              <span className="w-[5.4cqw] rounded-[0.4cqw] bg-black py-[0.1cqw] text-center text-[2.4cqw] text-white">
                {code}
              </span>
              {name}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-1 gap-[2cqw]">
        <div className="grid grid-cols-3 content-start gap-[1cqw]">
          {keys.map((k) => (
            <span
              key={k}
              className="flex h-[6cqw] w-[6cqw] items-center justify-center rounded-[0.8cqw] text-[2.8cqw] font-bold text-black"
              style={{
                background:
                  "linear-gradient(180deg,var(--device-gold-hover),var(--device-gold-soft))",
              }}
            >
              {k}
            </span>
          ))}
        </div>

        <div
          className="min-w-0 flex-1 rounded-[1cqw] border p-[1.8cqw] text-[2.4cqw]"
          style={{ background: "var(--device-lcd-bg)", borderColor: "var(--device-lcd-border)" }}
        >
          <div className="flex justify-between font-bold" style={{ color: "var(--device-lcd-cyan)" }}>
            <span>Your Order</span>
            <span className="font-normal" style={{ color: "var(--device-lcd-text)" }}>
              Table No: 05
            </span>
          </div>
          <ul className="mt-[1.2cqw] space-y-[0.8cqw]" style={{ color: "var(--device-lcd-text)" }}>
            {lcdRows.map(([code, name, qty, price]) => (
              <li key={code} className="flex justify-between gap-[1cqw]">
                <span className="truncate">
                  {code} {name}
                </span>
                <span className="shrink-0">
                  {qty} · {price}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}