import type { ActorRole } from "./support";

/**
 * Role permissions (Pots spec §4). Defaults are deliberately narrow; the owner can grant more
 * via `grants`. Staff see only their own salary/payment status (handled by the UI, not here).
 */
export type Action =
  | "RULES_CONFIGURE" | "PAYOUT_REQUEST" | "PAYOUT_APPROVE" | "PROFIT_WITHDRAW" | "LEDGER_VIEW" | "RECONCILE"
  | "POT_ADJUST" | "BILL_CREATE" | "REFUND" | "REPORTS_VIEW" | "TEAM_MANAGE" | "PAYROLL_MANAGE"
  | "LOYALTY_MANAGE" | "LOYALTY_ADJUST";

export const BASE_PERMISSIONS: Record<ActorRole, readonly Action[]> = {
  OWNER: ["RULES_CONFIGURE", "PAYOUT_REQUEST", "PAYOUT_APPROVE", "PROFIT_WITHDRAW", "LEDGER_VIEW", "RECONCILE", "POT_ADJUST", "BILL_CREATE", "REFUND", "REPORTS_VIEW", "TEAM_MANAGE", "PAYROLL_MANAGE", "LOYALTY_MANAGE", "LOYALTY_ADJUST"],
  MANAGER: ["PAYOUT_REQUEST", "BILL_CREATE", "LEDGER_VIEW", "REPORTS_VIEW", "LOYALTY_ADJUST"],
  ACCOUNTANT: ["LEDGER_VIEW", "RECONCILE", "REPORTS_VIEW"],
  STAFF: [],
};
export const ACTION_LABEL: Record<Action, string> = {
  RULES_CONFIGURE: "Change allocation rules", PAYOUT_REQUEST: "Request payouts / supplier payments", PAYOUT_APPROVE: "Approve payouts",
  PROFIT_WITHDRAW: "Withdraw owner profit", LEDGER_VIEW: "View ledger & transactions", RECONCILE: "Reconcile", POT_ADJUST: "Reserve / transfer / adjust Pots",
  BILL_CREATE: "Create bills", REFUND: "Issue refunds", REPORTS_VIEW: "View reports", TEAM_MANAGE: "Manage team & limits", PAYROLL_MANAGE: "Edit & approve payroll",
  LOYALTY_MANAGE: "Change loyalty settings & rewards", LOYALTY_ADJUST: "Adjust loyalty points (managers: small amounts only)",
};
export type Grants = Partial<Record<ActorRole, readonly Action[]>>;
export function can(role: ActorRole, action: Action, grants: Grants = {}): boolean {
  return BASE_PERMISSIONS[role].includes(action) || (grants[role] ?? []).includes(action);
}
