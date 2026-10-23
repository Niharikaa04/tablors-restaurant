"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Auto-turning product turntable for the hero (front, right, back, left).
 *
 * Why not a 3D box: the Tablor terminal is wedge-shaped, so four flat photos
 * folded into a box never meet cleanly and the panels look disconnected from
 * some angles. Instead ONE photo is shown at a time on a fixed-size stage. It
 * swings round edge-on, the next real view swings in, and every view is
 * centred and scaled consistently, so nothing overlaps, stretches or jumps.
 *
 * Drag (or swipe sideways) to turn it by hand; it resumes turning on its own.
 * Photos are the same separate files used by the six-view grid
 * (public/images/device-views/).
 */
const FULL_WIDTH = 94; // % of the stage a full-width view fills
const DEPTH_RATIO = 0.508; // device depth / device width (side views are narrower)

const VIEWS = [
  { src: "/images/device-views/front.webp", alt: "Tablor ordering terminal, front view", aspect: 2.5118, width: FULL_WIDTH },
  { src: "/images/device-views/right.webp", alt: "Tablor ordering terminal, right-side view", aspect: 1.2748, width: FULL_WIDTH * DEPTH_RATIO },
  { src: "/images/device-views/back.webp", alt: "Tablor ordering terminal, back view", aspect: 2.8881, width: FULL_WIDTH },
  { src: "/images/device-views/left.webp", alt: "Tablor ordering terminal, left-side view", aspect: 1.2748, width: FULL_WIDTH * DEPTH_RATIO },
] as const;

/** Same stage for every view, so the hero never changes height. */
const STAGE_ASPECT = 2.2;
/** Degrees per second of the (virtual) turntable; 90 degrees = one view. */
const DEG_PER_SECOND = 22;
/** Wait this long after a drag before turning resumes. */
const RESUME_AFTER_MS = 1500;

export function DeviceCube3D({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const angle = useRef(0);
  const drag = useRef<{ x: number; a: number } | null>(null);
  const lastInteraction = useRef(0);

  useEffect(() => {
    // Paint one frame: pick the nearest view and swing it by an eased amount,
    // so each view dwells face-on and the turn happens between views.
    const paint = () => {
      const a = ((angle.current % 360) + 360) % 360;
      const nearest = Math.round(a / 90);
      const k = nearest % 4;
      const phi = a - nearest * 90; // -45 .. 45
      const t = Math.min(1, Math.abs(phi) / 45);
      const eased = t * t; // slow near face-on, quick near edge-on
      const swing = Math.sign(phi) * eased * 90;
      refs.current.forEach((el, i) => {
        if (!el) return;
        if (i === k) {
          el.style.visibility = "visible";
          el.style.transform = `translate(-50%, -50%) rotateY(${swing}deg)`;
          el.style.opacity = String(1 - eased * 0.35);
        } else {
          el.style.visibility = "hidden";
        }
      });
    };

    paint();
    if (reduce) {
      // No auto-turn for people who ask for less motion; drag still works.
      const onFrame = () => paint();
      const id = setInterval(onFrame, 50);
      return () => clearInterval(id);
    }

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const idle = now - lastInteraction.current > RESUME_AFTER_MS;
      if (!drag.current && idle && document.visibilityState === "visible") {
        angle.current += DEG_PER_SECOND * dt;
      }
      paint();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, a: angle.current };
    lastInteraction.current = performance.now();
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    angle.current = drag.current.a - (e.clientX - drag.current.x) * 0.4;
    lastInteraction.current = performance.now();
  }
  function onPointerUp() {
    drag.current = null;
    lastInteraction.current = performance.now();
  }

  return (
    <div
      role="group"
      aria-label="Tablor ordering terminal turning through front, right, back and left views. Drag to turn it yourself."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`relative w-full max-w-full select-none overflow-hidden [touch-action:pan-y] cursor-grab active:cursor-grabbing ${className}`}
      style={{ perspective: "1800px", aspectRatio: String(STAGE_ASPECT) }}
    >
      {VIEWS.map((v, i) => (
        <div
          key={v.src}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute left-1/2 top-1/2"
          style={{
            width: `${v.width}%`,
            aspectRatio: String(v.aspect),
            transform: "translate(-50%, -50%)",
            visibility: i === 0 ? "visible" : "hidden",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={v.src}
            alt={v.alt}
            draggable={false}
            className="block h-full w-full object-contain"
          />
        </div>
      ))}
    </div>
  );
}
