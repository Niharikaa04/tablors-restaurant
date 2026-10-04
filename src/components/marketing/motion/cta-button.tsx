"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Base the props on motion.a's own prop type (not plain
// AnchorHTMLAttributes) so drag/animation event handlers — which
// Motion re-types with its own gesture signatures — don't collide
// with React's DOM typings for the same prop names (e.g. onDrag).
type CtaButtonProps = Omit<ComponentPropsWithoutRef<typeof motion.a>, "children"> & {
  children: ReactNode;
  /** Solid lime buttons get a faint lift; everything else just scales. */
  glow?: "lime" | "none";
};

/**
 * Thin motion wrapper around an anchor styled as a button. Preserves
 * whatever className/href/etc. the caller passes — it only adds a
 * restrained hover/press lift (no glow blobs), and turns the transform
 * off entirely under prefers-reduced-motion.
 */
export function CtaButton({ children, glow = "none", ...props }: CtaButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.a
      {...props}
      whileHover={{
        scale: reduceMotion ? 1 : 1.02,
        boxShadow:
          glow === "lime"
            ? "0 6px 18px -6px rgba(215,254,59,0.35)"
            : "none",
      }}
      whileTap={{ scale: reduceMotion ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      {children}
    </motion.a>
  );
}
