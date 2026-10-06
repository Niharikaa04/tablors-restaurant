"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { BookDeviceIllustration } from "./book-device-illustration";

/** Degrees of idle auto-rotation per second (full 360 degree spin). */
const IDLE_SPEED = 8;
/** Degrees of rotation per pixel of horizontal drag/swipe. */
const DRAG_SENSITIVITY = 0.35;

/**
 * Resting pose. Restrained: front face dominates, the left spine and bottom
 * thickness read as a thin sliver. Rotating reveals more thickness naturally.
 */
const BASE_YAW = 11;
const PITCH = 1.5;
/** Key light azimuth (deg from +Z toward +X): front, right of camera. */
const KEY_AZIMUTH = 40;

/*
 * GEOMETRY. Container-query units of the rotator's own width (`cqw`).
 *
 * Total thickness = DEPTH + LIP ≈ 9% of width (target 8–16%).
 *
 * The solid is sized to the VISIBLE artwork: the SVG's real content box is
 * measured at runtime (see `useFaceInsets`), so the chassis, spine and rear
 * can never be larger than the front cover.
 */

const DEPTH = "8cqw"; //     main body thickness
const LIP = "1.2cqw"; //     champagne front housing thickness
const STEP_X = "1.2cqw"; //    rear body horizontal inset behind the front
const STEP_Y = "1.5cqw"; //  rear body vertical inset (never taller than cover)
const RADIUS = "1.3cqw"; //  rear cover corner radius
/** Nudge the floor line up/down to sit exactly on the book's bottom edge. */
const FLOOR_ADJUST = "6cqw";

type Side = "left" | "right" | "top" | "bottom";

const HIDE_BACK: CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

const SIDE_POSITION: Record<Side, CSSProperties> = {
  left: { left: 0, top: 0, height: "100%", transform: "translateX(-50%) rotateY(-90deg)" },
  right: { left: "100%", top: 0, height: "100%", transform: "translateX(-50%) rotateY(90deg)" },
  top: { top: 0, left: 0, width: "100%", transform: "translateY(-50%) rotateX(90deg)" },
  bottom: { top: "100%", left: 0, width: "100%", transform: "translateY(-50%) rotateX(-90deg)" },
};

/** World-space azimuth of each face's outward normal at rotateY = 0. */
const PHI: Partial<Record<Side, number>> = { left: 270, right: 90 };

/* Materials: navy body, muted champagne trim, warm metal for the bottom. */
const CHAMPAGNE_V =
  "linear-gradient(180deg, #8a6a37 0%, #dcc38f 38%, #f4e4bb 55%, #b08b50 100%)";
const SPINE =
  "linear-gradient(90deg, #04060d 0%, #101a36 36%, #0b1226 62%, #05070f 100%)";
/* Subtle champagne edge highlight on the spine's front edge. */
const SPINE_EDGE =
  "inset -0.2cqw 0 0 0 rgba(222,190,124,0.42), inset 0 0 0 0.1cqw rgba(214,178,110,0.14)";
const FORE_EDGE =
  "linear-gradient(90deg, transparent calc(50% - 0.15cqw), rgba(222,190,124,0.5) calc(50% - 0.15cqw) calc(50% + 0.15cqw), transparent calc(50% + 0.15cqw)), linear-gradient(90deg, #070b17, #141e3b 50%, #070b17)";
const BODY_TOP = "linear-gradient(180deg, #0c1428, #070b17)";
/* Warm lower trim with a bevel: bright crest, darker roll-off. */
const BODY_BOTTOM =
  "linear-gradient(180deg, #fff0c8 0%, #d8bd85 35%, #9a7a45 100%)";
const REAR =
  "radial-gradient(120% 90% at 30% 20%, #16234a 0%, #0b1226 58%, #060912 100%)";

/** Darkens a face as its normal turns away from the key light. */
function Shade({
  yaw,
  phi,
  strength = 0.6,
  className = "",
}: {
  yaw: MotionValue<number>;
  phi: number;
  strength?: number;
  className?: string;
}) {
  const opacity = useTransform(yaw, (v) => {
    const a = ((phi + v - KEY_AZIMUTH) * Math.PI) / 180;
    const lit = Math.max(0, Math.cos(a));
    return 0.04 + strength * (1 - lit);
  });
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 bg-black ${className}`}
      style={{ opacity }}
    />
  );
}

type SideSpec = { background: string; boxShadow?: string; shade?: number };

/** Four side faces of a slab, `depth` thick, centred on the slab's plane. */
function SideFaces({
  depth,
  sides,
  yaw,
}: {
  depth: string;
  sides: Partial<Record<Side, SideSpec>>;
  yaw: MotionValue<number>;
}): ReactNode {
  return (["left", "right", "top", "bottom"] as const).map((side) => {
    const horizontal = side === "left" || side === "right";
    const spec = sides[side];
    if (!spec) return null;
    const phi = PHI[side];
    return (
      <div
        key={side}
        className="absolute overflow-hidden"
        style={{
          ...SIDE_POSITION[side],
          ...(horizontal ? { width: depth } : { height: depth }),
          background: spec.background,
          boxShadow: spec.boxShadow,
          ...HIDE_BACK,
        }}
      >
        {phi !== undefined && (
          <Shade yaw={yaw} phi={phi} strength={spec.shade ?? 0.6} />
        )}
      </div>
    );
  });
}

type Insets = { l: number; r: number; t: number; b: number };

/**
 * Fractions of the SVG box that are NOT the solid cover (margin, baked-in
 * shadows, soft glows). Measured by rasterising the SVG and finding the
 * bounds of its opaque body, because getBBox() also counts shadows and
 * faint decoration and made the chassis taller than the cover.
 */
function useFaceInsets(ref: React.RefObject<HTMLDivElement | null>): Insets {
  const [insets, setInsets] = useState<Insets>({ l: 0, r: 0, t: 0, b: 0 });
  useEffect(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const vb = svg.viewBox.baseVal;
    if (!vb.width || !vb.height) return;
    let cancelled = false;

    const W = 240;
    const H = Math.round((W * vb.height) / vb.width);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml;charset=utf-8",
      }),
    );

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        // A row/column belongs to the cover when most of it is opaque.
        const rows = new Array<number>(H).fill(0);
        const cols = new Array<number>(W).fill(0);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (data[(y * W + x) * 4 + 3] > 200) {
              rows[y]++;
              cols[x]++;
            }
          }
        }
        const top = rows.findIndex((n) => n > W * 0.5);
        const bottom = H - 1 - [...rows].reverse().findIndex((n) => n > W * 0.5);
        const left = cols.findIndex((n) => n > H * 0.5);
        const right = W - 1 - [...cols].reverse().findIndex((n) => n > H * 0.5);
        if (cancelled || top < 0 || left < 0 || bottom <= top || right <= left) return;
        setInsets({
          l: left / W,
          r: (W - 1 - right) / W,
          t: top / H,
          b: (H - 1 - bottom) / H,
        });
      } catch {
        /* canvas unreadable: keep zero insets */
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [ref]);
  return insets;
}

/**
 * Wraps the Tablor book SVG in an interactive 360° Y-axis rotation: mouse
 * drag, touch swipe and keyboard arrows, plus a subtle idle spin that pauses
 * while the user is interacting.
 *
 * ONE connected solid: front cover + champagne housing + thin navy chassis
 * (spine, fore-edge, top, champagne bottom trim) + rear cover. Every layer
 * lives inside the visible face's bounding box; the rear is only inset behind
 * the front, never offset sideways or extended vertically.
 */
export function BookDeviceRotator({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const rotateY = useMotionValue(0);
  const isInteracting = useRef(false);
  const activePointerId = useRef<number | null>(null);
  const lastPointerX = useRef(0);
  const coverRef = useRef<HTMLDivElement>(null);
  const face = useFaceInsets(coverRef);

  // Continuous 360 degree idle spin; paused while dragging / reduced motion.
  useAnimationFrame((_, delta) => {
    if (reduceMotion || isInteracting.current) return;
    rotateY.set(rotateY.get() + (IDLE_SPEED * delta) / 1000);
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isInteracting.current = true;
    activePointerId.current = e.pointerId;
    lastPointerX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteracting.current || e.pointerId !== activePointerId.current) return;
    const deltaX = e.clientX - lastPointerX.current;
    lastPointerX.current = e.clientX;
    rotateY.set(rotateY.get() + deltaX * DRAG_SENSITIVITY);
  };

  const endInteraction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    isInteracting.current = false;
    activePointerId.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") rotateY.set(rotateY.get() - 15);
    else if (e.key === "ArrowRight") rotateY.set(rotateY.get() + 15);
  };

  // Total yaw of the single rigid assembly.
  const yaw = useTransform(rotateY, (v) => v + BASE_YAW);

  // Footprint of a W x D slab seen from above: |cos| + (D/W)|sin|.
  const footprint = useTransform(yaw, (v) => {
    const r = (v * Math.PI) / 180;
    return Math.max(0.2, Math.abs(Math.cos(r)) + 0.09 * Math.abs(Math.sin(r)));
  });

  return (
    <div
      className={`relative touch-none select-none cursor-grab active:cursor-grabbing ${className ?? ""}`}
      style={{ containerType: "inline-size" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
      onPointerLeave={endInteraction}
      onKeyDown={handleKeyDown}
      role="img"
      aria-label="Interactive preview of the Tablor's book-shaped table ordering device. Drag or use arrow keys to rotate."
      tabIndex={0}
    >
      {/* FLOOR: a zero-height line at the book's base. Everything below is
          positioned relative to it, in cqw, so it scales with the device. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 w-full"
        style={{ bottom: `calc(${face.b * 100}% + ${FLOOR_ADJUST})`, height: 0 }}
      >
        {/* Warm pool on the floor: wide, low, brightest just right of the base */}
        <div
          className="absolute"
          style={{
            left: "-75cqw",
            width: "230cqw",
            top: "-6cqw",
            height: "22cqw",
            background: [
              "radial-gradient(ellipse 34% 36% at 66% 27%, rgba(248,186,84,0.60), rgba(232,160,64,0.22) 50%, transparent 100%)",
              "radial-gradient(ellipse 50% 44% at 55% 27%, rgba(214,150,64,0.16), transparent 100%)",
            ].join(","),
          }}
        />

        {/* Thin bright streak grazing the floor at the base line */}
        <div
          className="absolute"
          style={{
            left: "18cqw",
            width: "140cqw",
            top: "-0.2cqw",
            height: "0.4cqw",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,214,140,0.25) 35%, rgba(255,226,160,0.75) 70%, rgba(255,214,140,0.35) 88%, transparent 100%)",
          }}
        />
        {/* Soft band around the streak */}
        <div
          className="absolute"
          style={{
            left: "10cqw",
            width: "150cqw",
            top: "-1.6cqw",
            height: "3.2cqw",
            background:
              "radial-gradient(ellipse 50% 50% at 62% 50%, rgba(255,204,120,0.30), transparent 100%)",
          }}
        />

        {/* Reflection of the base: vertical, fading, never mirror-like */}
        <motion.div
          className="absolute"
          style={{
            left: "0%",
            width: "100%",
            top: "0.4cqw",
            height: "13cqw",
            scaleX: footprint,
            transformOrigin: "50% 0%",
            background: [
              "radial-gradient(ellipse 30% 100% at 88% 0%, rgba(246,186,92,0.34), transparent 100%)",
              "linear-gradient(to bottom, rgba(226,170,84,0.20), rgba(226,170,84,0.05) 55%, transparent)",
            ].join(","),
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, #000 14%, #000 88%, transparent)",
            maskImage:
              "linear-gradient(90deg, transparent, #000 14%, #000 88%, transparent)",
          }}
        />

        {/* Soft occlusion + dense contact shadow, hugging the footprint */}
        <motion.div
          className="absolute rounded-[50%] bg-black/70 blur-lg"
          style={{
            left: "-4%",
            width: "108%",
            top: "-2.6cqw",
            height: "6cqw",
            scaleX: footprint,
          }}
        />
        <motion.div
          className="absolute rounded-[50%] bg-black blur-[3px]"
          style={{
            left: "3%",
            width: "94%",
            top: "-1.3cqw",
            height: "2.6cqw",
            scaleX: footprint,
          }}
        />
      </div>

      {/* Perspective lives on a descendant so `cqw` resolves to this width. */}
      <div className="relative" style={{ perspective: "800cqw" }}>
        <motion.div
          className="relative will-change-transform"
          style={{ rotateX: PITCH, rotateY: yaw, transformStyle: "preserve-3d" }}
        >
          {/* SOLID: sized to the visible face; everything below is inside it. */}
          <div
            className="pointer-events-none absolute"
            style={{
              inset: `${face.t * 100}% ${face.r * 100}% ${face.b * 100}% ${face.l * 100}%`,
              transformStyle: "preserve-3d",
            }}
          >
            {/* CHASSIS: rear cover + spine, fore-edge, top, champagne bottom.
                Inset by STEP so it only peeks out behind the front. */}
            <div
              className="absolute"
              style={{ inset: `${STEP_Y} ${STEP_X}`, transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  background: REAR,
                  borderRadius: RADIUS,
                  transform: `translateZ(calc(${DEPTH} / -2)) rotateY(180deg)`,
                  ...HIDE_BACK,
                }}
              >
                <div
                  className="absolute"
                  style={{
                    inset: "4cqw",
                    border: "0.14cqw solid rgba(214,178,110,0.34)",
                    borderRadius: "0.8cqw",
                  }}
                />
                <Shade yaw={yaw} phi={180} />
              </div>
              <SideFaces
                depth={DEPTH}
                yaw={yaw}
                sides={{
                  left: { background: SPINE, boxShadow: SPINE_EDGE, shade: 0.45 },
                  right: { background: FORE_EDGE },
                  top: { background: BODY_TOP },
                  bottom: { background: BODY_BOTTOM },
                }}
              />
            </div>

            {/* FRONT HOUSING: thin champagne bezel wrapping the perimeter,
                flush with the front cover so the chassis reads as attached. */}
            <div
              className="absolute inset-0"
              style={{
                transformStyle: "preserve-3d",
                transform: `translateZ(calc(${DEPTH} / 2 + ${LIP} / 2))`,
              }}
            >
              <SideFaces
                depth={LIP}
                yaw={yaw}
                sides={{
                  // No left/right bezel faces: they read as a tall gold line
                  // when the book is edge-on. Gold stays on the bottom trim.
                  top: { background: BODY_TOP },
                  bottom: { background: CHAMPAGNE_V },
                }}
              />
            </div>
          </div>

          {/* FRONT COVER: the existing Tablor SVG, unchanged. In flow, so it
              also sets the component's height. */}
          <div
            ref={coverRef}
            className="relative"
            style={{
              transform: `translateZ(calc(${DEPTH} / 2 + ${LIP} + 0.05cqw))`,
              ...HIDE_BACK,
            }}
          >
            <BookDeviceIllustration className="block w-full" />
            <Shade yaw={yaw} phi={0} strength={0.45} className="rounded-[14px]" />
            {/* Warm rim light on the right and bottom edges only, clipped to the
                visible cover (not the SVG's transparent margin). */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                inset: `${face.t * 100}% ${face.r * 100}% ${face.b * 100}% ${face.l * 100}%`,
                background: [
                  "linear-gradient(to left, rgba(246,190,100,0.26) 0%, transparent 5%)",
                  "linear-gradient(to top, rgba(246,190,100,0.16) 0%, transparent 7%)",
                ].join(","),
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}