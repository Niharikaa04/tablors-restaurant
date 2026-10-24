"use client";

import { useState } from "react";
import Image from "next/image";

import { Reveal } from "./motion/reveal";
import { VenueWalkthrough } from "./venue-walkthrough";

/**
 * Photos are the supplied files in public/images. `position` is the
 * object-position for object-cover; tune it per photo after a look.
 * After converting the photos to JPG, change ".png" to ".jpg" below.
 */
const venues = [
  {
    name: "Restaurants",
    blurb: "Streamlined ordering for a better dining experience.",
    image: "/images/restaurant.webp",
    // Picture shown at the top of the pop-up after clicking this card.
    popupImage: "/images/restaurant.webp",
    position: "center",
  },
  {
    name: "Hotel Room Service",
    blurb: "Let guests request food and service directly from their room.",
    image: "/images/hotel.webp",
    // Each venue shows its own pop-up picture.
    popupImage: "/images/hotel.webp",
    position: "center",
  },
  {
    name: "Hospitals",
    blurb: "Simplify meal ordering and service for patients and visitors.",
    image: "/images/hospital.webp",
    popupImage: "/images/hospital.webp",
    position: "center",
  },
] as const;

type VenueName = (typeof venues)[number]["name"];

const SHADOW_LEAD =
  "shadow-[0_0_0_1px_rgba(212,175,55,0.45),0_28px_60px_-20px_rgba(0,0,0,0.95),0_0_36px_-8px_rgba(212,175,55,0.3)]";
const SHADOW_ACTIVE =
  "shadow-[0_0_0_1px_rgba(212,175,55,0.5),0_0_28px_-10px_rgba(212,175,55,0.3)]";

/**
 * "Perfect for every table".
 *
 * One card is always "in focus": the one under the cursor, else the one
 * with keyboard focus, else the one the visitor last opened. Hover only
 * changes paint (scale, filter, border, shadow) so the grid never
 * reflows; the focused card is lifted with z-index.
 *
 * Clicking, tapping or pressing Enter on a card opens the device
 * walkthrough for that venue (see venue-walkthrough.tsx).
 *
 * Four cards: restaurants, trains, hotel room service and hospitals.
 */
export function BusinessTypes() {
  const [hovered, setHovered] = useState<VenueName | null>(null);
  const [focused, setFocused] = useState<VenueName | null>(null);
  const [active, setActive] = useState<VenueName | null>(null);
  const [open, setOpen] = useState<VenueName | null>(null);

  const lead = hovered ?? focused ?? active;
  const openVenue = venues.find((v) => v.name === open) ?? null;

  function handleClick(name: VenueName) {
    setActive(name);
    // Lets the demo form pre-select the matching "Restaurant type".
    window.dispatchEvent(new CustomEvent("tablor:venue", { detail: name }));
    setOpen(name);
  }

  return (
    <>
      <section
        aria-label="Perfect for restaurants, trains, hotel room service and hospitals"
        className="border-y border-[var(--mkt-border)] bg-[var(--mkt-stage)] px-6 py-10 sm:py-12 lg:py-16"
      >
        <div className="mkt-container">
          <Reveal className="max-w-2xl">
            <h2
              className="text-3xl leading-[1.1] tracking-tight text-[var(--mkt-text-primary)] sm:text-4xl"
              style={{ fontFamily: "var(--mkt-serif)" }}
            >
              Perfect for every table
            </h2>
          </Reveal>

          <ul
            className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-6"
            onPointerLeave={() => setHovered(null)}
          >
            {venues.map((v, i) => {
              const isLead = lead === v.name;
              const isActive = active === v.name;
              const dimmed = lead !== null && !isLead;
              // With an odd number of cards, the last one would sit alone on
              // its row (two-column grid from sm up): let it span the row.
              const wide = venues.length % 2 === 1 && i === venues.length - 1;

              return (
                <li
                  key={v.name}
                  className={`relative ${wide ? "sm:col-span-2" : ""}`}
                  // Raise immediately when gaining focus; drop only after the
                  // card has finished shrinking so it never slips under a neighbour.
                  style={{
                    zIndex: isLead ? 10 : 1,
                    transition: `z-index 0s linear ${isLead ? "0ms" : "450ms"}`,
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "touch") setHovered(v.name);
                  }}
                >
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`${v.name} — see how Tablor works`}
                    aria-current={isActive ? "true" : undefined}
                    data-lead={isLead}
                    onClick={() => handleClick(v.name)}
                    onFocus={(e) => {
                      if (e.currentTarget.matches(":focus-visible")) setFocused(v.name);
                    }}
                    onBlur={() => setFocused(null)}
                    className={`group relative block aspect-[4/3] ${wide ? "sm:aspect-[8/3] " : ""}w-full overflow-hidden rounded-md border text-left transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mkt-lime)] motion-reduce:scale-100 motion-reduce:transition-none ${
                      isLead
                        ? `scale-[1.045] border-[var(--mkt-lime)] ${SHADOW_LEAD}`
                        : isActive
                          ? `scale-100 border-[var(--mkt-lime)]/70 ${SHADOW_ACTIVE}`
                          : "scale-100 border-[var(--mkt-border)] shadow-none"
                    }`}
                  >
                    {/* Venue photograph (fixed card ratio, so no layout shift) */}
                    <div
                      className={`absolute inset-0 transition-[filter] duration-500 ease-out motion-reduce:transition-none ${
                        isLead
                          ? "brightness-110 contrast-110 saturate-100"
                          : dimmed
                            ? "brightness-[0.55] saturate-[0.8]"
                            : "brightness-[0.78] saturate-[0.9]"
                      }`}
                    >
                      <Image
                        src={v.image}
                        alt={`${v.name} venue`}
                        fill
                        sizes={wide ? "100vw" : "(min-width: 640px) 50vw, 100vw"}
                        className="object-cover"
                        style={{ objectPosition: v.position }}
                        draggable={false}
                      />
                    </div>

                    {/* readability for the caption */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
                      style={{
                        background:
                          "linear-gradient(to top, rgba(5,6,4,0.92), rgba(5,6,4,0.55) 55%, transparent)",
                      }}
                    />

                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <h3
                          className={`text-2xl leading-tight transition-colors duration-500 motion-reduce:transition-none ${
                            isLead ? "text-white" : "text-[var(--mkt-text-primary)]/80"
                          }`}
                          style={{ fontFamily: "var(--mkt-serif)" }}
                        >
                          {v.name}
                        </h3>
                        <p
                          className={`mt-1.5 max-w-[30ch] text-sm leading-snug transition-colors duration-500 motion-reduce:transition-none ${
                            isLead
                              ? "text-[var(--mkt-text-primary)]/90"
                              : "text-[var(--mkt-text-secondary)]"
                          }`}
                        >
                          {v.blurb}
                        </p>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,color,opacity,transform] duration-500 motion-reduce:transition-none ${
                          isLead || isActive
                            ? "translate-x-0 border-[var(--mkt-lime)] bg-[var(--mkt-lime)] text-[var(--mkt-lime-ink)] opacity-100"
                            : "-translate-x-0.5 border-[var(--mkt-lime)]/45 text-[var(--mkt-lime)] opacity-70"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <VenueWalkthrough venue={openVenue} onClose={() => setOpen(null)} />
    </>
  );
}