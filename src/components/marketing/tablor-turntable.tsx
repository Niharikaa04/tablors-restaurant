"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/* Must match the frames you add. */
const FRAME_COUNT = 36;
const FRAME_WIDTH = 1600;
const FRAME_HEIGHT = 812;
export const TURNTABLE_ASPECT = FRAME_WIDTH / FRAME_HEIGHT;

const frameSrc = (i: number) =>
  `/images/turntable/tablor-${String(i).padStart(2, "0")}.webp`;

const IDLE_DEG_PER_S = 12;
const DRAG_DEG_PER_PX = 0.5;
const FRICTION = 3;

export function TablorTurntable({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);

  const angle = useRef(0);
  const velocity = useRef(0);
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const lastFrame = useRef(0);
  const ready = useRef(false);

  /* Preload every frame so spinning never flashes a blank. */
  useEffect(() => {
    let loaded = 0;
    let cancelled = false;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        if (!cancelled && loaded === FRAME_COUNT) ready.current = true;
      };
      img.src = frameSrc(i);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      if (ready.current && !dragging.current) {
        if (Math.abs(velocity.current) > 1) {
          angle.current += velocity.current * dt;
          velocity.current *= Math.exp(-dt * FRICTION);
        } else if (!reduceMotion) {
          angle.current += IDLE_DEG_PER_S * dt;
        }
      }
      const norm = ((angle.current % 360) + 360) % 360;
      const f = Math.round((norm / 360) * FRAME_COUNT) % FRAME_COUNT;
      if (f !== lastFrame.current) {
        lastFrame.current = f;
        setFrame(f);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    velocity.current = 0;
    pointerId.current = e.pointerId;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || e.pointerId !== pointerId.current) return;
    const now = performance.now();
    const deg = (e.clientX - lastX.current) * DRAG_DEG_PER_PX;
    const dt = Math.max(1, now - lastT.current) / 1000;
    velocity.current = velocity.current * 0.6 + (deg / dt) * 0.4;
    angle.current += deg;
    lastX.current = e.clientX;
    lastT.current = now;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
    if (performance.now() - lastT.current > 80) velocity.current = 0;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") angle.current -= 360 / FRAME_COUNT;
    else if (e.key === "ArrowRight") angle.current += 360 / FRAME_COUNT;
  };

  return (
    <div
      className={`relative cursor-grab touch-pan-y select-none active:cursor-grabbing ${className}`}
      style={{ aspectRatio: TURNTABLE_ASPECT }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      role="group"
      aria-roledescription="360 degree product viewer"
      aria-label="Tablor's ordering terminal. Drag, or use the left and right arrow keys, to turn it."
      tabIndex={0}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10%] bottom-[4%] h-[8%] rounded-[50%] bg-black/80 blur-xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={frameSrc(frame)}
        alt="Tablor's countertop ordering terminal"
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        draggable={false}
        className="relative block h-full w-full object-contain"
      />
    </div>
  );
}