"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "motion/react";

import { BookDeviceRotator } from "./book-device-rotator";
import { CtaButton } from "./motion/cta-button";

/*
 * HERO PRODUCT SCALE
 *
 * The physical Tablor device is the visual hero.
 * Desktop sizing is driven primarily by viewport height,
 * rather than being restricted by the text column.
 */
const DEVICE_HEIGHT = 0.78;
// Lifted from 0.065 so dark floor shows beneath the book (reflection + light pool).
const DEVICE_BOTTOM = 0.11;

export function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);

  const [deviceWidth, setDeviceWidth] = useState<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  /*
   * DEVICE SIZE
   * Measure the real BookDeviceRotator aspect ratio and derive
   * its width from the desired viewport-relative height.
   */
  useEffect(() => {
    const device = deviceRef.current;
    const section = sectionRef.current;

    if (!device || !section) return;

    const fitDevice = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setDeviceWidth(null);
        return;
      }

      const previousWidth = device.style.width;

      device.style.width = "500px";

      const measuredHeight = device.offsetHeight;
      const ratio = measuredHeight / 500;

      device.style.width = previousWidth;

      if (!ratio) return;

      const heroHeight = section.clientHeight;
      const targetHeight = heroHeight * DEVICE_HEIGHT;
      const calculatedWidth = targetHeight / ratio;

      const maxWidth = Math.min(window.innerWidth * 0.48, 760);
      const finalWidth = Math.min(calculatedWidth, maxWidth);

      setDeviceWidth(finalWidth);
    };

    fitDevice();

    window.addEventListener("resize", fitDevice);

    const observer = new ResizeObserver(fitDevice);
    observer.observe(device);

    return () => {
      window.removeEventListener("resize", fitDevice);
      observer.disconnect();
    };
  }, []);

  /* Subtle scroll movement. */
  const parallaxY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : 24],
  );

  /* ANIMATION */

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
      {/* =====================================================
          PREMIUM STUDIO ENVIRONMENT
          Dark floor + vignette only. The warm light lives on
          the device wrapper so it always lines up with the base.
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* Dark studio floor: slightly lifted black, no colour */}
        <div
          className="absolute inset-x-0 bottom-0 h-[30%]"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(18,14,9,0.55) 55%, rgba(10,8,5,0.9) 100%)",
          }}
        />

        {/* Vignette keeps everything else near-black */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 100% at 66% 55%, transparent 45%, rgba(0,0,0,0.7) 100%)",
          }}
        />
      </div>

      {/* =====================================================
          MAIN HERO CONTAINER
          ===================================================== */}

      <div className="mkt-container relative flex h-full w-full flex-col lg:flex-row">
        {/* =================================================
            LEFT: TYPOGRAPHY
            ================================================= */}

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
            lg:w-[52%]
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
              lg:text-[5.4rem]
              xl:text-[5.9rem]
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
            A smart menu on every table that sends orders straight to your
            kitchen.
            
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

        {/* =================================================
            RIGHT: PHYSICAL TABLOR DEVICE
            ================================================= */}

        <div
          className="
            relative
            z-10
            flex-1
            lg:absolute
            lg:inset-y-0
            lg:right-[-2%]
            lg:flex
            lg:w-[58%]
            lg:items-end
            lg:justify-center
          "
          style={{
            paddingBottom: `calc(var(--hero-h) * ${DEVICE_BOTTOM})`,
          }}
        >
          <motion.div
            ref={deviceRef}
            variants={deviceEntrance}
            initial="hidden"
            animate="show"
            style={{
              y: parallaxY,
              width: deviceWidth ?? undefined,
            }}
            className="
              relative
              mx-auto
              w-full
              max-w-[20rem]
              sm:max-w-[26rem]
              lg:mx-0
            "
          >
            {/* =================================================
                FLOOR / DEVICE LIGHTING
                ================================================= */}

            {/* All floor lighting (pool, streak, reflection, shadows) lives inside
                BookDeviceRotator so it is anchored to the book's base line. */}

            {/* =================================================
                REAL ANIMATED TABLOR DEVICE
                ================================================= */}

            <BookDeviceRotator
              className="
                relative
                w-full
              "
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}