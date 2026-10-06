import type { ReactNode } from "react";
import { Reveal } from "./motion/reveal";
import { BookDeviceIllustration } from "./book-device-illustration";
import {
  SAMPLE_GST_PERCENT,
  sampleLines,
  sampleItems,
  sampleSubtotal,
  sampleGst,
  sampleTotal,
  beats,
} from "./product-story-data";

// Re-exported so any existing `import { sampleLines, beats, ... } from
// "./product-story"` elsewhere in the app keeps working unchanged. The
// real values live in the plain (non-"use client") data module — see
// product-story-data.ts for why that split exists.
export { SAMPLE_GST_PERCENT, sampleLines, sampleItems, sampleSubtotal, sampleGst, sampleTotal, beats };

/**
 * The product story, rebuilt as a controlled editorial sequence rather
 * than a single pinned-scroll "film."
 *
 * Six steps, one continuous visual language:
 *   01 The table   — the closed device, at rest (reuses BookDeviceIllustration)
 *   02 Menu & select — the open device, browsing + building an order
 *   03 Confirm & send — the same open device, order confirmed
 *   04 Kitchen     — the real kitchen-display layout (New/Preparing/Ready)
 *   05 Owner       — the real owner-dashboard stat cards
 *   06 Bill & pay  — the open device again, showing the payment QR
 *
 * Every step is a normal-flow two-column row (visual left, copy right on
 * desktop; visual above copy on mobile) — nothing is pinned, nothing
 * scrubs a shared "stage" value, and the device is never scaled or
 * squashed into a side-on sliver. `Reveal` only fades/lifts each half in
 * as it enters the viewport, so with `prefers-reduced-motion` the whole
 * sequence is simply readable top-to-bottom with no motion at all — the
 * table → menu → select → confirm → kitchen → owner → billing
 * progression is carried entirely by layout and copy, not by animation.
 *
 * Seven `beats` of real product copy (product-story-data.ts) are kept
 * and merged into six steps: the "menu" and "selection" beats become one
 * "Menu & select" step, with the selection copy demoted to a short
 * supporting line — matching the requested 01→06 structure without
 * inventing new copy.
 */

type PageRow = { code: string; name: string };

const menuPages: { tag: string; title: string; rows: PageRow[] }[] = [
  {
    tag: "PAGE 4",
    title: "CHICKEN",
    rows: [
      { code: "008", name: "Chicken 65" },
      { code: "060", name: "Butter Chicken" },
      { code: "099", name: "Pepper Chicken" },
      { code: "082", name: "Chilli Chicken" },
    ],
  },
  {
    tag: "PAGE 7",
    title: "BIRYANIS & RICE",
    rows: [
      { code: "055", name: "Veg Biryani" },
      { code: "111", name: "Chicken Biryani" },
      { code: "116", name: "Jeera Rice" },
      { code: "118", name: "Curd Rice" },
    ],
  },
];

type Step = {
  anchorId?: string;
  number: string;
  label: string;
  heading: string;
  body: string;
  meta?: string;
  visual: ReactNode;
};

const steps: Step[] = [
  {
    anchorId: "device",
    number: "01",
    label: "THE TABLE",
    heading: beats[0].title,
    body: beats[0].body,
    visual: <ClosedDeviceVisual />,
  },
  {
    anchorId: "ordering",
    number: "02",
    label: "MENU & SELECT",
    heading: beats[1].title,
    body: beats[1].body,
    meta: beats[2].body,
    visual: <OpenDeviceVisual lcd="building" />,
  },
  {
    number: "03",
    label: "CONFIRM & SEND",
    heading: beats[3].title,
    body: beats[3].body,
    visual: <OpenDeviceVisual lcd="confirmed" />,
  },
  {
    number: "04",
    label: "KITCHEN",
    heading: beats[4].title,
    body: beats[4].body,
    visual: <KitchenVisual />,
  },
  {
    number: "05",
    label: "OWNER",
    heading: beats[5].title,
    body: beats[5].body,
    visual: <OwnerVisual />,
  },
  {
    number: "06",
    label: "BILL & PAY",
    heading: beats[6].title,
    body: beats[6].body,
    visual: <OpenDeviceVisual lcd="billing" />,
  },
];

export function ProductStory() {
  return (
    <section
      id="story"
      aria-label="How an order moves from the table, through the device, the kitchen and the owner's dashboard, to the final bill"
      className="snap-section relative bg-[var(--mkt-stage)] px-6 py-16 sm:py-20 lg:py-24"
    >
      <div id="product" aria-hidden="true" className="absolute top-0" style={{ scrollMarginTop: "4.25rem" }} />

      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">How it works</p>
          <h2
            className="mt-4 text-4xl leading-[1.05] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
           From the table to the owner, in four steps
          </h2>
        </Reveal>

        <FlowStrip />
        <div className="mt-4">
          {steps.map((step, index) => (
            <StoryStep key={step.number} step={step} first={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
const flow = [
  { n: "01", title: "Customer", text: "Picks dishes on the table device" },
  { n: "02", title: "Order", text: "One tap sends it instantly" },
  { n: "03", title: "Kitchen", text: "Sees it on screen and prepares it" },
  { n: "04", title: "Owner", text: "Sees every table, order and bill" },
];

function FlowStrip() {
  return (
    <ol className="mt-10 grid sm:grid-cols-4 sm:gap-6">
      {flow.map((s, i) => (
        <li key={s.n} className="relative flex gap-4 pb-8 last:pb-0 sm:block sm:pb-0">
          {i < flow.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-5 top-12 h-[calc(100%-3.5rem)] w-px bg-[var(--mkt-border-strong)] sm:left-12 sm:top-5 sm:h-px sm:w-[calc(100%-2rem)]"
            />
          )}
          <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--mkt-lime)]/50 bg-[var(--mkt-stage)] text-xs text-[var(--mkt-lime)]">
            {s.n}
          </span>
          <div className="sm:mt-4">
            <h3 className="text-xl text-[var(--mkt-text-primary)]" style={{ fontFamily: "var(--mkt-serif)" }}>
              {s.title}
            </h3>
            <p className="mt-1 text-sm leading-snug text-[var(--mkt-text-secondary)]">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function StoryStep({ step, first }: { step: Step; first: boolean }) {
  return (
    <div
      id={step.anchorId}
      className={`grid items-center gap-8 py-10 sm:py-12 lg:grid-cols-2 lg:gap-16 lg:py-16 ${
        first ? "" : "border-t border-[var(--mkt-border)]"
      }`}
      style={step.anchorId ? { scrollMarginTop: "4.25rem" } : undefined}
    >
      <Reveal className="w-full">
        <div className="mx-auto w-full max-w-md">{step.visual}</div>
      </Reveal>

      <Reveal delay={0.08} className="w-full text-center lg:text-left">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">
          {step.number} / {step.label}
        </p>
        <h3
          className="mx-auto mt-3 max-w-md text-2xl leading-[1.15] tracking-tight text-[var(--mkt-text-primary)] sm:text-3xl lg:mx-0"
          style={{ fontFamily: "var(--mkt-serif)" }}
        >
          {step.heading}
        </h3>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-[var(--mkt-text-secondary)] lg:mx-0">
          {step.body}
        </p>
        {step.meta && (
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--mkt-text-muted)] lg:mx-0">
            {step.meta}
          </p>
        )}
      </Reveal>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Step 01 visual — the closed device, at rest                       */
/* ---------------------------------------------------------------- */

function ClosedDeviceVisual() {
  return (
    <div className="mx-auto w-48 sm:w-56 lg:w-64">
      <BookDeviceIllustration className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]" />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Steps 02 / 03 / 06 visual — the open device, real menu + keypad   */
/* + order display, differing only in what the LCD shows.            */
/* ---------------------------------------------------------------- */

function OpenDeviceVisual({ lcd }: { lcd: "building" | "confirmed" | "billing" }) {
  return (
    <div
      role="img"
      aria-label="Illustration of the open Tablor's device with menu pages, a numeric keypad and an order display"
      className="tablor-device overflow-hidden rounded-2xl border-2 p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:p-2"
      style={{ borderColor: "var(--device-gold)", background: "var(--device-shell)" }}
    >
      <div aria-hidden="true">
        <div className="grid gap-1 sm:grid-cols-2">
          {menuPages.map((page) => (
            <div key={page.tag} className="rounded-lg px-2.5 pb-2 pt-2.5 sm:px-3" style={{ background: "#fdfcf8" }}>
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  style={{ background: "var(--device-tag-red)" }}
                >
                  {page.tag}
                </span>
                <span className="text-[11px] font-extrabold tracking-wide" style={{ color: "var(--device-tag-red)" }}>
                  {page.title}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1 border-t border-[#ddd] pt-1.5">
                {page.rows.map((row) => (
                  <li key={row.code} className="flex items-center gap-2">
                    <span className="flex h-4 w-6 shrink-0 items-center justify-center rounded-sm bg-[#111] text-[9px] font-bold text-white">
                      {row.code}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-[#1b1b1b]">{row.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          <div
            className="hidden rounded-lg border px-3 py-3 sm:block"
            style={{ borderColor: "var(--device-shell-border)", background: "#0b0c10" }}
          >
            <DeviceKeypad />
          </div>

          <div
            className="min-h-[9.5rem] rounded-lg border px-3 py-2.5"
            style={{ background: "var(--device-lcd-bg)", borderColor: "var(--device-lcd-border)" }}
          >
            {lcd === "building" && <DeviceLcdBuilding />}
            {lcd === "confirmed" && <DeviceLcdConfirmed />}
            {lcd === "billing" && <DeviceLcdBilling />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeviceKeypad() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"].map((key) => (
        <div
          key={key}
          className="flex h-6 items-center justify-center rounded-md text-[10px] font-bold text-[#171a10]"
          style={{ background: "linear-gradient(180deg, var(--device-gold-hover), var(--device-gold-soft))" }}
        >
          {key}
        </div>
      ))}
    </div>
  );
}

function LcdHeader() {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--device-lcd-cyan)" }}>
        Your Order
      </span>
      <span className="text-[10px]" style={{ color: "var(--device-lcd-text)" }}>
        TABLE NO: 04
      </span>
    </div>
  );
}

function DeviceLcdBuilding() {
  return (
    <div className="flex h-full flex-col">
      <LcdHeader />
      <table className="mt-1.5 w-full text-[10px]" style={{ color: "var(--device-lcd-text)" }}>
        <tbody>
          {sampleLines.map((line) => (
            <tr key={line.code}>
              <td className="py-0.5">{line.name}</td>
              <td className="py-0.5 text-right">× {line.qty}</td>
              <td className="py-0.5 text-right">{line.qty * line.price}/-</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        className="mt-auto flex items-end justify-between border-t pt-1.5 text-[10px]"
        style={{ borderColor: "var(--device-lcd-cyan)", color: "var(--device-lcd-cyan)" }}
      >
        <span className="font-semibold">Items : {sampleItems}</span>
        <span className="text-right leading-tight">
          <span className="block text-[9px]" style={{ color: "var(--device-lcd-muted)" }}>
            GST {SAMPLE_GST_PERCENT}% : {sampleGst}/-
          </span>
          <span className="font-semibold">Total : ₹ {sampleTotal}/-</span>
        </span>
      </div>
    </div>
  );
}

function DeviceLcdConfirmed() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span
        className="rounded-full px-3 py-1 text-[11px] font-semibold"
        style={{ background: "var(--mkt-lime)", color: "var(--mkt-lime-ink)" }}
      >
        Order confirmed ✓
      </span>
      <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--device-lcd-muted)" }}>
        Sent to kitchen
      </span>
      <span className="text-[11px] font-semibold" style={{ color: "var(--device-lcd-text)" }}>
        {sampleItems} items · Total ₹ {sampleTotal}/-
      </span>
    </div>
  );
}

function DeviceLcdBilling() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--device-lcd-cyan)" }}>
        Scan &amp; pay
      </span>
      <QrGlyph />
      <span className="text-[11px] font-semibold" style={{ color: "var(--device-lcd-text)" }}>
        Total ₹ {sampleTotal}/-
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: "var(--mkt-lime)", color: "var(--mkt-lime-ink)" }}
      >
        Table 04 · Paid
      </span>
    </div>
  );
}

function QrGlyph() {
  // Decorative — a book-cipher of filled/empty cells, not a scannable
  // code. It only needs to read as "a QR code" at a glance.
  const cells = [
    1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1,
    1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1,
  ];
  return (
    <div className="grid grid-cols-7 gap-[1.5px] rounded bg-white p-1.5">
      {cells.map((cell, i) => (
        <span key={i} className={`h-1 w-1 ${cell ? "bg-black" : "bg-white"}`} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Step 04 visual — the real kitchen display (New/Preparing/Ready)   */
/* ---------------------------------------------------------------- */

function KitchenVisual() {
  const columns = [
    { title: "NEW", action: "Accept" },
    { title: "PREPARING", action: "Mark ready" },
    { title: "READY", action: "Mark served" },
  ];

  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--color-border)", background: "var(--mkt-surface)" }}>
      <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--color-radium-500)" }}>
        Kitchen display
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--color-text-muted)" }}>
              {column.title}
            </p>
            <div
              className="mt-2 rounded-lg border p-2.5 sm:p-3"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}
            >
              <p className="text-xs" style={{ color: "var(--color-text-primary)" }}>Table 04</p>
              <ul
                className="mt-1.5 space-y-0.5 text-[9px] leading-snug sm:text-[10px]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {sampleLines.slice(0, 2).map((line) => (
                  <li key={line.code}>
                    {line.name} × {line.qty}
                  </li>
                ))}
              </ul>
              <p
                className="mt-2 rounded-md py-1 text-center text-[9px] font-medium"
                style={{ background: "var(--color-gold-500)", color: "#0a0a0a" }}
              >
                {column.action}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Step 05 visual — the real owner dashboard stat cards               */
/* ---------------------------------------------------------------- */

function OwnerVisual() {
  const stats = [
    { label: "Today's sales", value: `₹${(sampleTotal * 23).toLocaleString("en-IN")}`, highlight: true },
    { label: "Total orders", value: "23" },
    { label: "New orders", value: "1" },
    { label: "Devices online", value: "12/12" },
  ];

  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--color-border)", background: "var(--mkt-surface)" }}>
      <p
        className="flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] sm:justify-start"
        style={{ color: "var(--color-radium-500)" }}
      >
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-radium-500)", boxShadow: "0 0 8px var(--color-radium-500)" }}
        />
        Live operations
      </p>
      <h4
        className="mt-2 text-center text-lg sm:text-left"
        style={{ fontFamily: "var(--mkt-serif)", color: "var(--color-text-primary)" }}
      >
        Today&apos;s overview
      </h4>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border p-3"
            style={{
              borderColor: stat.highlight ? "rgba(57,255,106,0.4)" : "var(--color-border)",
              background: "var(--color-surface-1)",
            }}
          >
            <p className="text-[9px] uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
              {stat.label}
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: stat.highlight ? "var(--color-radium-500)" : "var(--color-text-primary)" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
