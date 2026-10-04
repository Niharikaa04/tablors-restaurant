import type { OrderStatus } from "@/server/modules/demo-store/store";

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string; dot: string }> = {
  new: {
    label: "New",
    className: "border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/10 text-[var(--ov-gold)]",
    dot: "bg-[var(--ov-gold)]",
  },
  preparing: {
    label: "Preparing",
    className: "border-[var(--ov-accent)]/25 bg-[var(--ov-accent)]/10 text-[var(--ov-accent)]",
    dot: "bg-[var(--ov-accent)]",
  },
  ready: {
    label: "Ready",
    className: "border-[var(--ov-accent)]/40 bg-[var(--ov-accent)]/20 text-[var(--ov-accent)]",
    dot: "bg-[var(--ov-accent)]",
  },
  served: {
    label: "Served",
    className: "border-[var(--ov-border)] bg-white/5 text-[var(--ov-text-secondary)]",
    dot: "bg-[var(--ov-text-secondary)]",
  },
  billed: {
    label: "Billed",
    className: "border-[var(--ov-border)] bg-white/[0.03] text-[var(--ov-muted)]",
    dot: "bg-[var(--ov-muted)]",
  },
};

export function StatusPill({ status, pulse = false }: { status: OrderStatus; pulse?: boolean }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} ${pulse ? "animate-pulse" : ""}`} />
      {config.label}
    </span>
  );
}
