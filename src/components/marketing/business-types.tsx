"use client";

import { useRef, useState } from "react";

import { VenueScene } from "./venue-scenes";
import { Reveal } from "./motion/reveal";

const venues = [
  { name: "Restaurants", blurb: "Streamlined ordering for a better dining experience." },
  { name: "Hotels", blurb: "Enhance guest stays with effortless in-room and dining services." },
  { name: "Cafes", blurb: "Quick, convenient ordering for modern cafe spaces." },
  { name: "Theatres", blurb: "Seamless ordering for an uninterrupted experience." },
  { name: "Lounges", blurb: "Elevate leisure moments with effortless service." },
  { name: "Banquets", blurb: "Effortless ordering for grand events and celebrations." },
] as const;

type VenueName = (typeof venues)[number]["name"];

// The existing destination for every category is the demo form; kept as is.
const DESTINATION = "#demo";

const SHADOW_LEAD =
  "shadow-[0_0_0_1px_rgba(212,175,55,0.45),0_28px_60px_-20px_rgba(0,0,0,0.95),0_0_36px_-8px_rgba(212,175,55,0.3)]";
const SHADOW_ACTIVE =
  "shadow-[0_0_0_1px_rgba(212,175,55,0.5),0_0_28px_-10px_rgba(212,175,55,0.3)]";

/**
 * "Perfect for every table".
 *
 * One card is always "in focus": the one under the cursor, else the one
 * with keyboard focus, else the one the visitor clicked/tapped. Hover
 * only changes paint (scale, filter, border, shadow) so the grid never
 * reflows; the focused card is lifted with z-index.
 *
 * - Mouse: hover leads; leaving the grid returns to the selected card
 *   (or to the default state if nothing was selected).
 * - Touch: no hover, so the first tap selects the card and a second tap
 *   follows its link. Scrolling never selects.
 * - Keyboard: :focus-visible produces the same state as hover.
 */
export function BusinessTypes() {
  const [hovered, setHovered] = useState<VenueName | null>(null);
  const [focused, setFocused] = useState<VenueName | null>(null);
  const [active, setActive] = useState<VenueName | null>(null);
  const inputKind = useRef<string>("mouse");

  const lead = hovered ?? focused ?? active;

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, name: VenueName) {
    if (inputKind.current === "touch" && active !== name) {
      // First tap only selects; the second tap follows the link.
      e.preventDefault();
    }
    setActive(name);
    // Lets the demo form pre-select the matching "Restaurant type".
    window.dispatchEvent(new CustomEvent("tablor:venue", { detail: name }));
  }

  return (
    <section
      aria-label="Perfect for restaurants, hotels, cafés, theatres, lounges and banquets"
      className="border-y border-[var(--mkt-border)] bg-[var(--mkt-stage)] px-6 py-16 sm:py-20 lg:py-24"
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
          className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          onPointerLeave={() => setHovered(null)}
        >
          {venues.map((v) => {
            const isLead = lead === v.name;
            const isActive = active === v.name;
            const dimmed = lead !== null && !isLead;

            return (
              <li
                key={v.name}
                className="relative"
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
                <a
                  href={DESTINATION}
                  aria-label={`${v.name} — book a demo`}
                  aria-current={isActive ? "true" : undefined}
                  data-lead={isLead}
                  onPointerDown={(e) => {
                    inputKind.current = e.pointerType;
                  }}
                  onKeyDown={() => {
                    inputKind.current = "keyboard";
                  }}
                  onClick={(e) => handleClick(e, v.name)}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible")) setFocused(v.name);
                  }}
                  onBlur={() => setFocused(null)}
                  className={`group relative block aspect-[4/3] overflow-hidden rounded-md border transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mkt-gold)] motion-reduce:scale-100 motion-reduce:transition-none ${
                    isLead
                      ? `scale-[1.045] border-[var(--mkt-gold)] ${SHADOW_LEAD}`
                      : isActive
                        ? `scale-100 border-[var(--mkt-gold)]/70 ${SHADOW_ACTIVE}`
                        : "scale-100 border-[var(--mkt-border)] shadow-none"
                  }`}
                >
                  {/* Scene / photograph. Swap <VenueScene /> for an <Image /> later. */}
                  <div
                    className={`absolute inset-0 transition-[filter] duration-500 ease-out motion-reduce:transition-none ${
                      isLead
                        ? "brightness-110 contrast-110 saturate-100"
                        : dimmed
                          ? "brightness-[0.55] saturate-[0.8]"
                          : "brightness-[0.78] saturate-[0.9]"
                    }`}
                  >
                    <VenueScene name={v.name} />
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
                          isLead
                            ? "text-white"
                            : "text-[var(--mkt-text-primary)]/80"
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
                          ? "translate-x-0 border-[var(--mkt-gold)] bg-[var(--mkt-gold)] text-[var(--mkt-lime-ink)] opacity-100"
                          : "-translate-x-0.5 border-[var(--mkt-gold)]/45 text-[var(--mkt-gold)] opacity-70"
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
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}