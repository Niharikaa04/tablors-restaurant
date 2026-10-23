import { existsSync } from "node:fs";
import path from "node:path";

import Image from "next/image";

import { Reveal } from "./motion/reveal";

/**
 * Six inspection views of the Tablor terminal, one separate image each.
 *
 * Every card is exactly the same size. Inside a card the picture is centred
 * with object-fit: contain, so nothing is cropped, stretched or overlapped.
 *
 * Scale is kept consistent on purpose: front, back, top and bottom show the
 * full width of the device, so they fill the same share of their card; the two
 * side views show the (narrower) depth of the device, so they fill a
 * proportionally smaller share. That way the terminal reads as the same
 * physical size in every card.
 *
 * Images live in public/images/device-views/ (front, back, right, left, top,
 * bottom) as .webp, .png, .jpg or .jpeg. If a file is missing, that card shows
 * a neutral placeholder instead of breaking the grid.
 */
const FULL_WIDTH = 92; // % of the card stage taken by a full-width view
const DEPTH_RATIO = 0.508; // device depth / device width

const views = [
  { key: "front", label: "Front view", width: FULL_WIDTH },
  { key: "back", label: "Back view", width: FULL_WIDTH },
  { key: "right", label: "Right-side view", width: FULL_WIDTH * DEPTH_RATIO },
  { key: "left", label: "Left-side view", width: FULL_WIDTH * DEPTH_RATIO },
  { key: "top", label: "Top-down view", width: FULL_WIDTH },
  { key: "bottom", label: "Bottom-up view", width: FULL_WIDTH },
] as const;

const EXTENSIONS = ["webp", "png", "jpg", "jpeg"] as const;

/** Returns the public URL of the view image if a file exists, else null. */
function findImage(key: string): string | null {
  for (const ext of EXTENSIONS) {
    const file = path.join(
      process.cwd(),
      "public",
      "images",
      "device-views",
      `${key}.${ext}`,
    );
    if (existsSync(file)) return `/images/device-views/${key}.${ext}`;
  }
  return null;
}

export function DeviceViews() {
  return (
    <section
      id="views"
      className="border-t border-[var(--mkt-border)] px-6 py-16 sm:py-20 lg:py-24"
      style={{ scrollMarginTop: "4.25rem" }}
    >
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
            Every angle
          </p>
          <h2
            className="mt-3 text-4xl leading-[1.08] tracking-tight sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            See all six sides of the terminal
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--mkt-text-secondary)]">
            Front, back, both sides, top and underside, shown at the same scale.
          </p>
        </Reveal>

        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {views.map((v, i) => {
            const src = findImage(v.key);
            const inset = (100 - v.width) / 2;
            return (
              <li key={v.key} className="min-w-0">
                <figure className="group m-0 overflow-hidden rounded-2xl border border-[var(--mkt-border)] bg-[#07080c] transition-colors hover:border-[var(--mkt-lime-dim)]/60">
                  {/* Same stage for every card: fixed 3:2 box via padding ratio. */}
                  <div
                    className="relative w-full"
                    style={{
                      paddingTop: "66.6667%",
                      background:
                        "radial-gradient(ellipse 70% 55% at 50% 55%, rgba(109,61,245,0.14), transparent 70%)",
                    }}
                  >
                    {/* Width sets the scale; object-contain centres it and never crops. */}
                    <div
                      className="absolute inset-y-0"
                      style={{ left: `${inset}%`, right: `${inset}%` }}
                    >
                      {src ? (
                        <Image
                          src={src}
                          alt={`Tablor ordering terminal, ${v.label.toLowerCase()}`}
                          fill
                          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                          className="object-contain"
                          draggable={false}
                        />
                      ) : (
                        <div
                          role="img"
                          aria-label={`${v.label}: photo coming soon`}
                          className="absolute inset-x-0 top-1/2 flex h-[55%] -translate-y-1/2 items-center justify-center rounded-xl border border-dashed border-[var(--mkt-border-strong)] text-xs uppercase tracking-[0.18em] text-[var(--mkt-text-muted)]"
                        >
                          Photo coming soon
                        </div>
                      )}
                    </div>
                  </div>

                  <figcaption className="flex items-center gap-3 border-t border-[var(--mkt-border)] px-5 py-3.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-lime-dim)]/50 text-xs text-[var(--mkt-lime)]">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-[var(--mkt-text-primary)]">
                      {v.label}
                    </span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}