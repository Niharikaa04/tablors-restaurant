
"use client";

import { useRef, type CSSProperties } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";
import { CtaButton } from "./motion/cta-button";
import { DevicePhotoFlip } from "./device-photo-flip";
import { DEVICE_ASPECT } from "./tablor-device-image";

/*
 * HERO PRODUCT SCALE
 *
 * The terminal is a wide, horizontal device. On desktop its width is derived
 * from the hero height (share of the hero it may occupy vertically x the image
 * aspect ratio), capped by the width of its column.
 */
const DEVICE_HEIGHT = 0.56;

export function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  /* Subtle scroll movement (disabled for reduced motion). */
  const parallaxY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : 24],
  );

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.1,
      },
    },
  };

  const rise: Variants = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 20,
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0.01 : 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const deviceEntrance: Variants = {
    hidden: {
      opacity: 0,
      y: reduceMotion ? 0 : 30,
      scale: reduceMotion ? 1 : 0.97,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: reduceMotion ? 0.01 : 1,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const deviceWidth = {
    "--device-w": `min(100%, calc(var(--hero-h) * ${DEVICE_HEIGHT} * ${DEVICE_ASPECT}))`,
  } as CSSProperties;

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="
        snap-section
        relative
        isolate
        overflow-hidden
        bg-[var(--mkt-stage)]
        py-10
        [--hero-h:max(41rem,calc(100svh-4.25rem))]
        lg:h-[var(--hero-h)]
        lg:py-0
      "
    >
      {/* Dark studio floor and vignette. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[30%]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(18,14,9,0.55) 55%, rgba(10,8,5,0.9) 100%)",
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 100% at 66% 55%, transparent 45%, rgba(0,0,0,0.7) 100%)",
          }}
        />
      </div>

      <div className="mkt-container relative flex h-full w-full flex-col lg:flex-row">
        {/* LEFT: TYPOGRAPHY */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="
            relative
            z-20
            flex
            w-full
            flex-col
            justify-center
            lg:w-[44%]
            lg:pt-[calc(var(--hero-h)*0.03)]
            lg:pr-8
          "
        >
          <motion.h1
            variants={rise}
            className="
              max-w-[40rem]
              text-[13vw]
              leading-[0.92]
              tracking-[-0.035em]
              text-[var(--mkt-text-primary)]
              sm:text-[4.5rem]
              lg:text-[5rem]
              xl:text-[5.6rem]
            "
            style={{
              fontFamily: "var(--mkt-serif)",
            }}
          >
            The table
            <br />
            takes the
            <br />
            <span className="text-[var(--mkt-lime)]">order.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            className="
              mt-7
              max-w-[34rem]
              text-[16px]
              leading-[1.65]
              text-[var(--mkt-text-secondary)]
              sm:text-[17px]
            "
          >
            Customers select items on the countertop device, and the order goes
            directly to your kitchen.
          </motion.p>

          <motion.div
            variants={rise}
            className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4"
          >
            <CtaButton
              href="/order"
              glow="lime"
              className="
                rounded-full
                bg-[var(--mkt-lime)]
                px-7
                py-3.5
                text-sm
                font-medium
                text-[var(--mkt-lime-ink)]
              "
            >
              Get Started
            </CtaButton>

            <a
              href="#demo"
              className="
                inline-flex
                items-center
                rounded-full
                border
                border-[rgba(196,168,96,0.35)]
                px-6
                py-3.5
                text-sm
                font-medium
                text-[var(--mkt-text-primary)]
                transition-colors
                duration-300
                hover:border-[var(--mkt-lime)]
                focus-visible:border-[var(--mkt-lime)]
              "
            >
              Book a Demo
            </a>
          </motion.div>
        </motion.div>

        {/* RIGHT: COUNTERTOP ORDERING TERMINAL */}
        <div
          className="
            relative
            z-10
            mt-10
            flex
            min-w-0
            flex-1
            items-center
            justify-center
            lg:absolute
            lg:inset-y-0
            lg:right-0
            lg:mt-0
            lg:w-[58%]
            lg:flex-none
            lg:pl-4
          "
        >
          <motion.div
            variants={deviceEntrance}
            initial="hidden"
            animate="show"
            style={{ y: parallaxY, ...deviceWidth }}
            className="
              relative
              w-full
              max-w-[34rem]
              lg:w-[var(--device-w)]
              lg:max-w-none
            "
          >
            {/* Soft warm light beneath the device. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[-6%] bottom-[-12%] h-[34%]"
              style={{
                background:
                  "radial-gradient(ellipse 55% 50% at 50% 35%, rgba(232,160,64,0.24), transparent 75%)",
              }}
            />

            <DevicePhotoFlip className="relative z-10 w-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
