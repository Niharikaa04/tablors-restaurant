"use client";

import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

import { TablorDeviceImage } from "./tablor-device-image";

/** Small on purpose: one photo only holds up near its own angle. */
const MAX_YAW = 28;
const MAX_PITCH = 6;
const IDLE_YAW = 10;
const IDLE_PERIOD = 9; //            seconds per sway
const DRAG_DEG_PER_PX = 0.25;

const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

export function Tablor3DDevice({
  className = "",
  sizes,
  priority = false,
}: {
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const elapsed = useRef(0);
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const lastX = useRef(0);

  const idle = useMotionValue(0);
  const drag = useMotionValue(0);
  const pitchTarget = useMotionValue(0);

  const yawTarget = useTransform([idle, drag], ([i, d]: number[]) =>
    clamp(i + d, MAX_YAW),
  );
  const yaw = useSpring(yawTarget, { stiffness: 110, damping: 20, mass: 0.6 });
  const pitch = useSpring(pitchTarget, { stiffness: 110, damping: 20, mass: 0.6 });
  const shadowScale = useTransform(yaw, (v) => 1 - (Math.abs(v) / MAX_YAW) * 0.1);

  useAnimationFrame((_, delta) => {
    const dt = delta / 1000;
    if (!reduceMotion) {
      elapsed.current += dt;
      idle.set(Math.sin((elapsed.current / IDLE_PERIOD) * Math.PI * 2) * IDLE_YAW);
    }
    if (!dragging.current) drag.set(drag.get() * Math.exp(-dt * 1.5));
  });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    pointerId.current = e.pointerId;
    lastX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current && e.pointerId === pointerId.current) {
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      drag.set(clamp(drag.get() + dx * DRAG_DEG_PER_PX, MAX_YAW));
      return;
    }
    if (e.pointerType === "mouse") {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      pitchTarget.set(-y * 2 * MAX_PITCH);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    dragging.current = false;
    pointerId.current = null;
  };

  const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e);
    pitchTarget.set(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") drag.set(clamp(drag.get() - 12, MAX_YAW));
    else if (e.key === "ArrowRight") drag.set(clamp(drag.get() + 12, MAX_YAW));
  };

  return (
    <div
      className={`relative cursor-grab touch-pan-y select-none active:cursor-grabbing ${className}`}
      style={{ perspective: "1400px" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      role="group"
      aria-roledescription="3D product viewer"
      aria-label="Tablor's ordering terminal. Drag, or use the left and right arrow keys, to tilt it."
      tabIndex={0}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] bottom-[2%] h-[9%] rounded-[50%] bg-black/80 blur-xl"
        style={{ scaleX: shadowScale }}
      />

      <motion.div
        className="will-change-transform"
        style={{ rotateY: yaw, rotateX: pitch, transformStyle: "preserve-3d" }}
      >
        <div
          style={{
            WebkitMaskImage:
              "radial-gradient(ellipse 72% 78% at 50% 50%, #000 62%, transparent 100%)",
            maskImage:
              "radial-gradient(ellipse 72% 78% at 50% 50%, #000 62%, transparent 100%)",
          }}
        >
          <TablorDeviceImage priority={priority} sizes={sizes} />
        </div>
      </motion.div>
    </div>
  );
}