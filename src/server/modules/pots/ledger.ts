import { assertPaise, type Paise } from "./money";

/**
 * Append-only, double-entry, in-memory Pots ledger (prototype).
 * A Postgres/Drizzle repository must keep exactly these invariants:
 *  - entries are never updated or deleted
 *  - every journal sums to zero
 *  - (businessId, idempotency key) is unique: replays write nothing
 *  - no POT or UNALLOCATED account may go negative; merchant funds may not go negative
 *
 * Accounts:
 *  - SETTLEMENT  contra account for money entering/leaving the business (balance <= 0).
 *                merchantFunds = -balance(SETTLEMENT)
 *  - UNALLOCATED settled money not (yet) assigned to any pot
 *  - POT:<id>    one per pot
 * Invariant checked by reconcile(): merchantFunds = sum(pots) + unallocated.
 */
export type Account = "SETTLEMENT" | "UNALLOCATED" | `POT:${string}`;
export type LedgerSource =
  | "PAYMENT_RECEIVED" | "ALLOCATION" | "ALLOCATION_REVERSAL" | "REFUND_PAYOUT"
  | "PAYOUT" | "TRANSFER" | "ADJUSTMENT";

export const potAccount = (potId: string): Account => `POT:${potId}`;

export interface LedgerEntry {
  readonly id: string;
  readonly businessId: string;
  readonly journalId: string;
  readonly account: Account;
  /** Signed paise. Positive = CREDIT to the account, negative = DEBIT. */
  readonly amount: Paise;
  readonly direction: "CREDIT" | "DEBIT";
  readonly sourceType: LedgerSource;
  readonly sourceId: string;
  /** `${businessId}:${ruleKey}:${version}` of the rule that produced the entry, if any. */
  readonly ruleId?: string;
  readonly ruleVersion?: number;
  readonly actorId: string;
  readonly createdAt: Date;
  readonly reason?: string;
}

export interface Leg {
  account: Account;
  amount: Paise;
  sourceType: LedgerSource;
  ruleId?: string;
  ruleVersion?: number;
}

export class InsufficientFundsError extends Error {
  constructor(public readonly account: string, public readonly shortfall: Paise) {
    super(`Insufficient funds in ${account}: short by ${shortfall} paise`);
  }
}

export interface ReconcileResult {
  ok: boolean;
  merchantFunds: Paise;
  potsTotal: Paise;
  unallocated: Paise;
  /** merchantFunds - (potsTotal + unallocated); 0 when reconciled. */
  difference: Paise;
  issues: string[];
}

export interface LedgerSummary {
  totalSettledBalance: Paise;
  /** Net sales (payments received minus refunds paid out) in [from, to). */
  salesInRange: Paise;
  allocatedToPots: Paise;
  unallocated: Paise;
}

export class Ledger {
  private rows: LedgerEntry[] = [];
  private keys = new Set<string>();
  private balances = new Map<string, Paise>();
  private seq = 0;

  private nid(p: string): string { return `${p}_${++this.seq}`; }
  private bkey(businessId: string, account: Account): string { return `${businessId}|${account}`; }

  // ---------- writes ----------
  hasJournal(businessId: string, key: string): boolean {
    return this.keys.has(`${businessId}:${key}`);
  }

  /** Returns false (and writes nothing) if the idempotency key already exists. */
  post(businessId: string, key: string, sourceId: string, legs: Leg[], actorId: string, at: Date, reason?: string): boolean {
    const k = `${businessId}:${key}`;
    if (this.keys.has(k)) return false;
    const live = legs.filter((l) => l.amount !== 0);
    live.forEach((l) => assertPaise(l.amount, "leg"));
    if (live.reduce((a, l) => a + l.amount, 0) !== 0) throw new Error("journal does not balance");

    const delta = new Map<Account, Paise>();
    for (const l of live) delta.set(l.account, (delta.get(l.account) ?? 0) + l.amount);
    for (const [account, d] of delta) {
      const after = this.balance(businessId, account) + d;
      // SETTLEMENT is a contra account: it must stay <= 0 (merchant funds >= 0). Others must stay >= 0.
      if (account === "SETTLEMENT" ? after > 0 : after < 0) throw new InsufficientFundsError(account, Math.abs(after));
    }

    const journalId = this.nid("jrn");
    for (const l of live) {
      this.rows.push(Object.freeze({
        id: this.nid("le"), businessId, journalId, account: l.account, amount: l.amount,
        direction: l.amount > 0 ? "CREDIT" : "DEBIT", sourceType: l.sourceType, sourceId,
        ruleId: l.ruleId, ruleVersion: l.ruleVersion, actorId, createdAt: at, reason,
      } satisfies LedgerEntry));
      const bk = this.bkey(businessId, l.account);
      this.balances.set(bk, (this.balances.get(bk) ?? 0) + l.amount);
    }
    this.keys.add(k);
    return true;
  }

  // ---------- reads ----------
  balance(businessId: string, account: Account): Paise {
    return this.balances.get(this.bkey(businessId, account)) ?? 0;
  }
  potBalance(businessId: string, potId: string): Paise { return this.balance(businessId, potAccount(potId)); }
  unallocated(businessId: string): Paise { return this.balance(businessId, "UNALLOCATED"); }
  /** Settled money currently held for the business (pots + unallocated). */
  merchantFunds(businessId: string): Paise { return -this.balance(businessId, "SETTLEMENT") || 0; }

  entries(businessId: string, account?: Account): readonly LedgerEntry[] {
    return this.rows.filter((e) => e.businessId === businessId && (account === undefined || e.account === account));
  }
  /** Chronological entries of one pot. */
  potEntries(businessId: string, potId: string): readonly LedgerEntry[] {
    return this.entries(businessId, potAccount(potId));
  }

  /** Net paise allocated to a pot by payments (allocations minus refund reversals) in [from, to). */
  allocatedToPot(businessId: string, potId: string, from: Date, to: Date): Paise {
    let s = 0;
    for (const e of this.potEntries(businessId, potId)) {
      if ((e.sourceType === "ALLOCATION" || e.sourceType === "ALLOCATION_REVERSAL") && e.createdAt >= from && e.createdAt < to) s += e.amount;
    }
    return s;
  }

  summary(businessId: string, from: Date, to: Date, potIds: readonly string[]): LedgerSummary {
    let sales = 0;
    for (const e of this.entries(businessId, "SETTLEMENT")) {
      if (e.createdAt < from || e.createdAt >= to) continue;
      // SETTLEMENT is a contra account: money in is a debit (negative), refunds out are credits.
      if (e.sourceType === "PAYMENT_RECEIVED" || e.sourceType === "REFUND_PAYOUT") sales -= e.amount;
    }
    return {
      totalSettledBalance: this.merchantFunds(businessId),
      salesInRange: sales,
      allocatedToPots: potIds.reduce((a, id) => a + this.potBalance(businessId, id), 0),
      unallocated: this.unallocated(businessId),
    };
  }

  reconcile(businessId: string, potIds: readonly string[]): ReconcileResult {
    const issues: string[] = [];
    const known = new Set(potIds.map(potAccount));
    const byJournal = new Map<string, number>();
    const byAccount = new Map<Account, number>();
    for (const e of this.entries(businessId)) {
      byJournal.set(e.journalId, (byJournal.get(e.journalId) ?? 0) + e.amount);
      byAccount.set(e.account, (byAccount.get(e.account) ?? 0) + e.amount);
    }
    for (const [j, s] of byJournal) if (s !== 0) issues.push(`journal ${j} does not sum to zero (${s})`);
    let potsTotal = 0;
    for (const [account, bal] of byAccount) {
      if (account === "SETTLEMENT") { if (bal > 0) issues.push("merchant funds are negative"); continue; }
      if (bal < 0) issues.push(`${account} is negative (${bal})`);
      if (account.startsWith("POT:")) {
        if (!known.has(account) && bal !== 0) issues.push(`${account} holds ${bal} but is not a known pot`);
        potsTotal += bal;
      }
    }
    const merchantFunds = this.merchantFunds(businessId);
    const unallocated = this.unallocated(businessId);
    const difference = merchantFunds - (potsTotal + unallocated);
    if (difference !== 0) issues.push(`funds ${merchantFunds} != pots ${potsTotal} + unallocated ${unallocated}`);
    return { ok: issues.length === 0, merchantFunds, potsTotal, unallocated, difference, issues };
  }
}
