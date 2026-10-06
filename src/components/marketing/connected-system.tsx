"use client";

import { useState } from "react";
import { Reveal } from "./motion/reveal";
import { StaggerGroup, StaggerItem } from "./motion/stagger";
import { SAMPLE_GST_PERCENT, sampleLines, sampleTotal } from "./product-story-data";

/**
 * The architecture payoff. <ProductStory /> follows one order forward in
 * time (table → device → kitchen → owner → bill); this section pulls the
 * camera back and shows the same order sitting on all three real screens
 * at once — the thing that actually makes Tablor's "one system" rather
 * than a device plus two separate dashboards. Same `sampleLines` /
 * `sampleTotal` as the story above it, so the numbers agree.
 *
 * The three cards behave as one hover group: the card under the pointer
 * (or keyboard focus) lifts and glows, the other two dim slightly.
 */

const nodes = [
  { id: "device", kicker: "01 · The table", caption: "Confirmed on the device", dot: "var(--mkt-lime)" },
  { id: "kitchen", kicker: "02 · The kitchen", caption: "Cooking from the same ticket", dot: "var(--color-radium-500)" },
  { id: "owner", kicker: "03 · The owner", caption: "Closed on the dashboard", dot: "var(--color-gold-500)" },
] as const;

function DeviceNode() {
  return (
    <div
      className="tablor-device flex h-full flex-col rounded-xl border-2 p-3"
      style={{ borderColor: "var(--device-gold)", background: "var(--device-shell)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--device-lcd-cyan)" }}>
          Your Order
        </span>
        <span className="text-[10px]" style={{ color: "var(--device-lcd-text)" }}>
          TABLE NO: 04
        </span>
      </div>
      <ul className="mt-2.5 space-y-1 border-t pt-2 text-[11px]" style={{ borderColor: "var(--device-lcd-border)", color: "var(--device-lcd-text)" }}>
        {sampleLines.slice(0, 3).map((line) => (
          <li key={line.code} className="flex items-center justify-between">
            <span>{line.name}</span>
            <span style={{ color: "var(--device-lcd-muted)" }}>× {line.qty}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]" style={{ borderColor: "var(--device-lcd-cyan)", color: "var(--device-lcd-cyan)" }}>
        <span>Confirmed</span>
        <span className="font-semibold">₹ {sampleTotal}/-</span>
      </div>
    </div>
  );
}

function KitchenNode() {
  return (
    <div className="flex h-full flex-col rounded-xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-radium-500)" }}>
          Kitchen display
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--color-radium-700)", color: "#05070a" }}>
          Table 04
        </span>
      </div>
      <ul className="mt-2.5 space-y-1 border-t pt-2 text-[11px]" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
        {sampleLines.slice(0, 3).map((line) => (
          <li key={line.code} className="flex items-center justify-between">
            <span>{line.name}</span>
            <span style={{ color: "var(--color-text-muted)" }}>× {line.qty}</span>
          </li>
        ))}
      </ul>
      <div
        className="mt-2.5 border-t pt-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ borderColor: "var(--color-border)", color: "var(--color-radium-500)" }}
      >
        Ready to serve
      </div>
    </div>
  );
}

function OwnerNode() {
  const tables = [
    { label: "Table 01", status: "Free" },
    { label: "Table 04", status: `₹${sampleTotal}/-`, highlight: true },
    { label: "Table 07", status: "Preparing" },
  ];
  return (
    <div className="flex h-full flex-col rounded-xl border p-3" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-1)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-gold-500)" }}>
          Owner dashboard
        </span>
      </div>
      <ul className="mt-2.5 space-y-1 border-t pt-2 text-[11px]" style={{ borderColor: "var(--color-border)" }}>
        {tables.map((table) => (
          <li key={table.label} className="flex items-center justify-between">
            <span style={{ color: "var(--color-text-primary)" }}>{table.label}</span>
            <span style={{ color: table.highlight ? "var(--mkt-lime)" : "var(--color-text-muted)", fontWeight: table.highlight ? 600 : 400 }}>
              {table.status}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 border-t pt-2 text-[11px]" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
        GST {SAMPLE_GST_PERCENT}% applied automatically
      </div>
    </div>
  );
}

const cardById = { device: DeviceNode, kitchen: KitchenNode, owner: OwnerNode };

export function ConnectedSystem() {
  const [activeCard, setActiveCard] = useState<number | null>(null);

  return (
    <section id="system" className="snap-section relative overflow-hidden bg-[var(--mkt-stage)] px-6 py-16 sm:py-20 lg:py-24">
      <div className="mkt-container">
        <Reveal className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--mkt-lime)]">One connected system</p>
          <h2
            className="mt-4 text-4xl leading-[1.05] tracking-tight text-[var(--mkt-text-primary)] sm:text-5xl"
            style={{ fontFamily: "var(--mkt-serif)" }}
          >
            Three screens. The same order, live.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--mkt-text-secondary)]">
            One order, seen from the table, the kitchen and the owner&apos;s
          desk at the same time.
          </p>
        </Reveal>

        {/* Group wrapper: resets the highlight when the pointer or focus leaves all three cards. */}
        <div
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setActiveCard(null);
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActiveCard(null);
          }}
        >
          <StaggerGroup className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-3" stagger={0.12}>
            {nodes.map((node, index) => {
              const Card = cardById[node.id];
              const isActive = activeCard === index;
              const isDimmed = activeCard !== null && !isActive;
              return (
                <StaggerItem key={node.id} className="flex flex-col">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full transition-transform duration-[400ms] ease-out motion-reduce:transition-none"
                      style={{
                        background: node.dot,
                        boxShadow: `0 0 10px 2px ${node.dot}55`,
                        transform: isActive ? "scale(1.5)" : "scale(1)",
                      }}
                    />
                    <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--mkt-text-muted)]">{node.kicker}</span>
                  </div>
                  <p className="mb-3 min-h-[2.5rem] text-sm text-[var(--mkt-text-secondary)]">{node.caption}</p>

                  {/*
                    Interaction layer sits inside StaggerItem so our transform
                    never fights the entrance animation on the item itself.
                  */}
                  <div
                    role="group"
                    aria-label={`${node.kicker}: ${node.caption}`}
                    tabIndex={0}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setActiveCard(index);
                    }}
                                        onPointerUp={(e) => {
                      // Touch / pen tap = the equivalent of hovering.
                      if (e.pointerType !== "mouse") setActiveCard(index);
                    }}
                    onFocus={(e) => {
                      if (e.currentTarget.matches(":focus-visible")) setActiveCard(index);
                    }}
                    className="h-56 rounded-xl outline-none transition-[transform,opacity,filter,box-shadow] duration-[400ms] ease-out will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mkt-lime)] motion-reduce:transition-none"
                    style={{
                      transform: isActive ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
                      opacity: isDimmed ? 0.6 : 1,
                      filter: isDimmed ? "saturate(0.7)" : "none",
                      boxShadow: isActive
                        ? `0 0 0 1px color-mix(in srgb, ${node.dot} 55%, transparent), 0 14px 34px -14px color-mix(in srgb, ${node.dot} 45%, transparent)`
                        : "0 0 0 0 transparent",
                    }}
                  >
                    <Card />
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>

        <Reveal delay={0.15} className="mt-10 max-w-xl border-t border-[var(--mkt-border)] pt-6 text-sm leading-relaxed text-[var(--mkt-text-secondary)]">
          Change a price on the owner dashboard, and every device shows it on the next order.
        </Reveal>
      </div>
    </section>
  );
}