/**
 * Money is ALWAYS integer paise (1 INR = 100 paise). No floats anywhere in
 * the ledger. In Postgres store as BIGINT paise (or NUMERIC(18,2) with
 * string<->paise conversion at the boundary).
 *
 * This is the single authoritative money module for Pots
 * (financial-pots/core/money.ts re-exports it).
 */
export type Paise = number;

export function assertPaise(n: number, label = "amount"): void {
  if (!Number.isSafeInteger(n)) throw new Error(`${label} must be an integer number of paise, got ${n}`);
}
export function assertPositivePaise(n: number, label = "amount"): void {
  assertPaise(n, label);
  if (n <= 0) throw new Error(`${label} must be > 0, got ${n}`);
}
/** Test/seed helper only: whole or 2dp rupees -> paise. */
export const rupees = (r: number): Paise => Math.round(r * 100);

/** Display only: integer paise -> "₹1,18,000.00" (Indian digit grouping, always 2dp). */
export function formatINR(paise: Paise): string {
  assertPaise(paise, "amount");
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${paise < 0 ? "-" : ""}₹${whole.toLocaleString("en-IN")}.${frac}`;
}

/** floor(amount * bps / 10000) without float or overflow. 100 bps = 1%. */
export function bpsOf(amount: Paise, bps: number): Paise {
  return Number((BigInt(amount) * BigInt(bps)) / BigInt(10000));
}

/**
 * Split `total` across `weights` using largest-remainder so shares sum to
 * exactly `total`. If total <= sum(weights), every share <= its weight.
 */
export function apportion(total: Paise, weights: Paise[]): Paise[] {
  const W = weights.reduce((a, b) => a + b, 0);
  if (W === 0) {
    if (total !== 0) throw new Error("cannot apportion non-zero total over zero weights");
    return weights.map(() => 0);
  }
  const bt = BigInt(total), bW = BigInt(W);
  const shares = weights.map((w) => (bt * BigInt(w)) / bW);
  const rems = weights.map((w) => (bt * BigInt(w)) % bW);
  const left = Number(bt - shares.reduce((a, b) => a + b, BigInt(0)));
  const order = weights.map((_, i) => i).sort((a, b) => (rems[a]! === rems[b]! ? a - b : rems[a]! > rems[b]! ? -1 : 1));
  for (let k = 0; k < left; k++) shares[order[k]!]! += BigInt(1);
  return shares.map(Number);
}

/** Strict user input -> paise with integer maths (no floats). "1180", "1180.5", "1180.50" ok; "", "-1", "1e3", "1.234" -> null. */
export function parseRupees(input: string): Paise | null {
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}
