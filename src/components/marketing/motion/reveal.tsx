"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Animation delay in seconds. */
  delay?: number;
  /** Vertical travel distance in px. */
  y?: number;
  /** Re-play the animation every time the section re-enters the viewport.
   *  Off by default: replaying makes sections near the bottom of the page
   *  flicker, because sliding the element changes whether it counts as
   *  "in view", which re-triggers the animation in a loop. */
  repeat?: boolean;
  /** Fraction of the element that must be visible before it animates in. */
  amount?: number;
};

/**
 * Fades + slides content in as it scrolls into view, and (by default)
 * resets so it can play again if the user scrolls back up past it.
 * Fully inert under prefers-reduced-motion (opacity-only, no movement).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  repeat = false,
  amount = 0.25,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  const variants: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : y },
    show: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: !repeat, amount, margin: "0px 0px -8% 0px" }}
      variants={variants}
      transition={{
        duration: reduceMotion ? 0.01 : 0.7,
        delay: reduceMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
