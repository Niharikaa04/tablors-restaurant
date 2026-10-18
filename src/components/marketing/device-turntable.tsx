"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const FRAMES = 36;
const BASE = "/images/turntable/frame-"; // frame-00.png ... frame-35.png
const EXT = "png";
const FALLBACK = "/images/tablor-ordering-device-front.webp";
const PX_PER_FRAME = 12; // drag distance per frame

const src = (i: number) => `${BASE}${String(i).padStart(2, "0")}.${EXT}`;

export function DeviceTurntable({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState<"loading" | "ok" | "missing">("loading");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; f: number } | null>(null);
  const spinning = useRef(false);

  // Preload every frame; if the first one is missing, use the fallback.
  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    for (let i = 0; i < FRAMES; i += 1) {
      const img = new Image();
      img.onload = () => {
        loaded += 1;
        if (!cancelled && loaded === FRAMES) setReady("ok");
      };
      img.onerror = () => {
        if (!cancelled) setReady("missing");
      };
      img.src = src(i);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // One slow intro spin once everything has loaded.
  useEffect(() => {
    if (ready !== "ok" || reduce) return;
    spinning.current = true;
    let i = 0;
    const id = window.setInterval(() => {
      if (!spinning.current || i >= FRAMES) {
        window.clearInterval(id);
        spinning.current = false;
        return;
      }
      i += 1;
      setFrame(i % FRAMES);
    }, 60);
    return () => window.clearInterval(id);
  }, [ready, reduce]);

  const wrap = (n: number) => ((n % FRAMES) + FRAMES) % FRAMES;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    spinning.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, f: frame };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (ready === "ok" && drag.current) {
      const dx = e.clientX - drag.current.x;
      setFrame(wrap(drag.current.f - Math.round(dx / PX_PER_FRAME)));
    } else if (ready === "missing" && !reduce) {
      const r = e.currentTarget.getBoundingClientRect();
      setTilt({
        x: ((e.clientX - r.left) / r.width - 0.5) * 2,
        y: ((e.clientY - r.top) / r.height - 0.5) * 2,
      });
    }
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (ready !== "ok") return;
    spinning.current = false;
    if (e.key === "ArrowLeft") setFrame((f) => wrap(f - 1));
    if (e.key === "ArrowRight") setFrame((f) => wrap(f + 1));
  }

  return (
    <div
      role="group"
      tabIndex={ready === "ok" ? 0 : -1}
      aria-label="Tablor TBL-01 terminal. Drag, or use the left and right arrow keys, to turn it."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      onKeyDown={onKeyDown}
      className={`relative select-none outline-none [touch-action:pan-y] ${
        ready === "ok" ? "cursor-grab active:cursor-grabbing" : ""
      } ${className}`}
      style={{ perspective: "1400px" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ready === "ok" ? src(frame) : FALLBACK}
        alt="Tablor TBL-01 countertop ordering terminal"
        draggable={false}
        className="block h-auto w-full"
        style={
          ready === "missing" && !reduce
            ? {
                transform: `rotateY(${tilt.x * 8}deg) rotateX(${tilt.y * -5}deg)`,
                transition: "transform 200ms ease-out",
              }
            : undefined
        }
      />
      {ready === "ok" && (
        <p className="pointer-events-none mt-2 text-center text-[11px] tracking-wide text-[var(--mkt-text-secondary)]">
          Drag to turn the device
        </p>
      )}
    </div>
  );
}