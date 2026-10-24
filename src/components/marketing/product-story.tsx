import type { ReactNode } from "react";
import { Reveal } from "./motion/reveal";
import { TablorDeviceImage } from "./tablor-device-image";
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
 * The product story: a controlled editorial sequence (no pinned scroll).
 *
 * Six steps, one continuous visual language:
 *   01 The table   — the countertop ordering terminal (client photo)
 *   02 Menu & select — the terminal's order display, building an order
 *   03 Confirm & send — the same order display, order confirmed
 *   04 Kitchen     — the kitchen-display layout (New/Preparing/Ready)
 *   05 Owner       — the owner-dashboard stat cards
 *   06 Bill & pay  — the bill summary
 *
 * Every step is a normal-flow two-column row (visual left, copy right on
 * desktop; visual above copy on mobile). `Reveal` only fades/lifts each
 * half in, so with `prefers-reduced-motion` the sequence is simply readable
 * top-to-bottom.
 *
 * Only the terminal's keypad, order buttons and built-in LCD order display
 * are established by the client's reference. The order-display
 * panels below are illustrations of that LCD; they do not claim extra
 * device functions (no QR, menu pages or bill printing on the device).
 */

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
    label: "THE TERMINAL",
    heading: "A terminal on the counter",
    body: "Customers select items using the numeric keypad and order buttons, and see their order on the built-in display.",
    visual: <DeviceImageVisual />,
  },
  {
    anchorId: "ordering",
    number: "02",
    label: "MENU & SELECT",
    heading: beats[1].title,
    body: beats[1].body,
    meta: beats[2].body,
    visual: <OrderDisplayVisual state="building" />,
  },
  {
    number: "03",
    label: "CONFIRM & SEND",
    heading: beats[3].title,
    body: beats[3].body,
    visual: <OrderDisplayVisual state="confirmed" />,
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
    visual: <BillVisual />,
  },
];

export function ProductStory() {
  return (
    <section
      id="story"
      aria-label="How an order moves from the table, through the terminal, the kitchen and the owner's dashboard, to the final bill"
      className="snap-section relative bg-[var(--mkt-stage)] px-6 py-10 sm:py-12 lg:py-16"
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
  { n: "01", title: "Customer", text: "Selects items on the countertop device" },
  { n: "02", title: "Order", text: "Sent straight to the kitchen" },
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
      className={`grid items-center gap-8 py-6 sm:py-8 lg:grid-cols-2 lg:gap-16 lg:py-10 ${
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
/* Step 01 visual — the countertop terminal (client photo)           */
/* ---------------------------------------------------------------- */

function DeviceImageVisual() {
  return (
    <div className="mx-auto w-full">
     <TablorDeviceImage
       alt=""
       sizes="(min-width: 1024px) 28rem, 92vw"
      className="drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
    />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Steps 02 / 03 visual — the terminal's built-in order display      */
/* ---------------------------------------------------------------- */

function OrderDisplayVisual({ state }: { state: "building" | "confirmed" }) {
  return (
    <div
      role="img"
      aria-label={
        state === "building"
          ? "Illustration of the terminal's order display listing the items in an order and the total"
          : "Illustration of the terminal's order display showing the order confirmed and sent to the kitchen"
      }
      className="tablor-device overflow-hidden rounded-2xl border-2 p-1.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:p-2"
      style={{ borderColor: "var(--device-gold)", background: "var(--device-shell)" }}
    >
      <div
        aria-hidden="true"
        className="min-h-[12rem] rounded-lg border px-4 py-3.5"
        style={{ background: "var(--device-lcd-bg)", borderColor: "var(--device-lcd-border)" }}
      >
        {state === "building" ? <DeviceLcdBuilding /> : <DeviceLcdConfirmed />}
      </div>
    </div>
  );
}

function LcdHeader() {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--device-lcd-cyan)" }}>
        Your Order
      </span>
      <span className="text-[11px]" style={{ color: "var(--device-lcd-text)" }}>
        TABLE NO: 04
      </span>
    </div>
  );
}

function DeviceLcdBuilding() {
  return (
    <div className="flex h-full min-h-[10.5rem] flex-col">
      <LcdHeader />
      <table className="mt-2 w-full text-[11px]" style={{ color: "var(--device-lcd-text)" }}>
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
        className="mt-auto flex items-end justify-between border-t pt-2 text-[11px]"
        style={{ borderColor: "var(--device-lcd-cyan)", color: "var(--device-lcd-cyan)" }}
      >
        <span className="font-semibold">Items : {sampleItems}</span>
        <span className="text-right leading-tight">
          <span className="block text-[10px]" style={{ color: "var(--device-lcd-muted)" }}>
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
    <div className="flex min-h-[10.5rem] flex-col items-center justify-center gap-2.5 text-center">
      <span
        className="rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: "var(--mkt-lime)", color: "var(--mkt-lime-ink)" }}
      >
        Order confirmed ✓
      </span>
      <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--device-lcd-muted)" }}>
        Sent to kitchen
      </span>
      <span className="text-xs font-semibold" style={{ color: "var(--device-lcd-text)" }}>
        {sampleItems} items · Total ₹ {sampleTotal}/-
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Step 04 visual — the kitchen display (New/Preparing/Ready)        */
/* ---------------------------------------------------------------- */

function KitchenVisual() {
  const columns = [
    { title: "NEW", action: "Start preparing" },
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
                style={{ background: "var(--mkt-lime)", color: "#0a0a0a" }}
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
/* Step 05 visual — the owner dashboard stat cards                    */
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

/* ---------------------------------------------------------------- */
/* Step 06 visual — the bill summary (system view, not on the device) */
/* ---------------------------------------------------------------- */

function BillVisual() {
  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--color-border)", background: "var(--mkt-surface)" }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: "var(--color-radium-500)" }}>
          Bill
        </p>
        <span className="text-xs" style={{ color: "var(--color-text-primary)" }}>
          Table 04
        </span>
      </div>

      <ul
        className="mt-4 space-y-1.5 border-t pt-3 text-xs"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
      >
        {sampleLines.map((line) => (
          <li key={line.code} className="flex items-center justify-between">
            <span>
              {line.name} × {line.qty}
            </span>
            <span>{line.qty * line.price}/-</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-3 space-y-1 border-t pt-3 text-xs"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{sampleSubtotal}/-</span>
        </p>
        <p className="flex justify-between">
          <span>GST {SAMPLE_GST_PERCENT}%</span>
          <span>{sampleGst}/-</span>
        </p>
        <p className="flex justify-between text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          <span>Total</span>
          <span>₹ {sampleTotal}/-</span>
        </p>
      </div>

      <p
        className="mt-4 rounded-full py-1 text-center text-[11px] font-medium"
        style={{ background: "var(--mkt-lime)", color: "var(--mkt-lime-ink)" }}
      >
        Paid
      </p>
    </div>
  );
}