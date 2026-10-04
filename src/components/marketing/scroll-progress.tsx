"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/**
 * A single subtle top progress bar showing how far down the page you are.
 * (Previously also rendered a right-hand rail of per-section nav dots —
 * removed per the redesign brief: one scroll indicator, not two.)
 */
export function ScrollProgress() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.3,
  });

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-[var(--mkt-lime)]"
      style={{ scaleX: reduceMotion ? scrollYProgress : smoothProgress }}
    />
  );
}