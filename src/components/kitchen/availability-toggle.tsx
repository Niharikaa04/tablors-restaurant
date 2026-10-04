"use client";

import { ChevronDown, Loader2 } from "lucide-react";

/**
 * A single control for one menu item's availability. There are only
 * ever two states, so this is a toggle button (not a real listbox) —
 * styled like a compact dropdown to read clearly at a glance, but a
 * single click/Enter/Space flips it, which keeps it fully keyboard
 * and screen-reader accessible without custom listbox wiring.
 */
export function AvailabilityToggle({
  available,
  pending,
  onToggle,
  size = "md",
}: {
  available: boolean;
  pending: boolean;
  onToggle: (nextAvailable: boolean) => void;
  size?: "sm" | "md";
}) {
  const isSmall = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={available}
      aria-label={available ? "Mark unavailable" : "Mark available"}
      disabled={pending}
      onClick={() => onToggle(!available)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border font-medium transition-colors disabled:cursor-wait disabled:opacity-70 ${
        isSmall ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
      } ${
        available
          ? "border-[var(--kd-ready)]/35 bg-[var(--kd-ready)]/10 text-[var(--kd-ready)] hover:bg-[var(--kd-ready)]/15"
          : "border-[var(--kd-error)]/35 bg-[var(--kd-error)]/10 text-[var(--kd-error)] hover:bg-[var(--kd-error)]/15"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          available ? "bg-[var(--kd-ready)]" : "bg-[var(--kd-error)]"
        }`}
      />
      {available ? "Available" : "Unavailable"}
      {pending ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </button>
  );
}
