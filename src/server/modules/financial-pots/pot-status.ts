import type { FinancialPot } from "./types";

/**
 * Derived, display-only status for a pot.
 *
 * The 85%/100% thresholds below are placeholder UI thresholds for the demo
 * only — no business rule for "near limit" / "over allocated" has been
 * confirmed. Replace this once real thresholds are defined.
 */
export interface PotStatusInfo {
  remainingRupees: number;
  usedPercent: number;
  label: "On track" | "Near limit" | "Over allocated";
  colorClass: string;
}

export function getPotStatus(pot: FinancialPot): PotStatusInfo {
  const remainingRupees = pot.allocatedRupees - pot.usedRupees;
  const usedPercent =
    pot.allocatedRupees === 0
      ? 0
      : Math.round((pot.usedRupees / pot.allocatedRupees) * 100);

  let label: PotStatusInfo["label"] = "On track";
  let colorClass =
    "text-[var(--radium-green)] bg-[var(--radium-green)]/10 border-[var(--radium-green)]/30";

  if (usedPercent >= 100) {
    label = "Over allocated";
    colorClass = "text-red-400 bg-red-500/10 border-red-500/30";
  } else if (usedPercent >= 85) {
    label = "Near limit";
    colorClass = "text-amber-400 bg-amber-500/10 border-amber-500/30";
  }

  return { remainingRupees, usedPercent, label, colorClass };
}