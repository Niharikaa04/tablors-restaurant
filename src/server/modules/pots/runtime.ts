import { Ledger } from "./ledger";
import { PaymentService } from "./payments";
import { PayoutService } from "./payouts";
import { PayrollService } from "./payroll";
import { Directory } from "./directory";
import { AlertCenter, AuditLog, RuleRegistry, createCustomPot, createDefaultPots, type ActorRole, type Pot } from "./support";

/**
 * Process-wide Pots runtime for the PROTOTYPE (in-memory, resets on server restart,
 * like demo-store). Replace the Ledger with a Postgres-backed one later; the
 * method contract stays the same.
 *
 * NO allocation rules are seeded: until the owner publishes rules through
 * RuleRegistry.publish, every settled payment lands in UNALLOCATED, which is the
 * correct, reconcilable behaviour (the specs give no real percentages).
 */
export const DEMO_BUSINESS_ID = "demo-business";

export interface PotsRuntime {
  ledger: Ledger;
  audit: AuditLog;
  alerts: AlertCenter;
  registry: RuleRegistry;
  payments: PaymentService;
  payouts: PayoutService;
  payroll: PayrollService;
  directory: Directory;
  pots: Pot[];
  potIds: string[];
}

function build(): PotsRuntime {
  const ledger = new Ledger();
  const audit = new AuditLog();
  const alerts = new AlertCenter();
  const registry = new RuleRegistry(audit, alerts);
  const pots = createDefaultPots(DEMO_BUSINESS_ID);
  const potIds = pots.map((p) => p.id);
  const payments = new PaymentService({
    ledger, audit, alerts,
    potIds: () => potIds,
    getRules: (businessId) => registry.forBusiness(businessId),
  });
  const payouts = new PayoutService({ ledger, audit, alerts, potIds: () => potIds });
  return { ledger, audit, alerts, registry, payments, payouts, payroll: new PayrollService(payouts), directory: new Directory(), pots, potIds };
}

/** Adds an owner-defined Pot (Rent, Electricity...). potIds/pots are shared by reference with PaymentService. */
export function addCustomPot(rt: PotsRuntime, name: string, role: ActorRole, actorId = "owner"): Pot {
  const pot = createCustomPot(DEMO_BUSINESS_ID, name, rt.pots, role);
  rt.pots.push(pot); rt.potIds.push(pot.id);
  rt.audit.record({ businessId: DEMO_BUSINESS_ID, actorId, action: "POT_CREATED", entity: "pot", entityId: pot.id, after: pot, at: new Date() });
  return pot;
}

// Survive Next.js dev hot-reload and share one instance across server actions/pages.
const g = globalThis as unknown as { __tablorsPotsRuntime?: PotsRuntime };

export function getPotsRuntime(): PotsRuntime {
  return (g.__tablorsPotsRuntime ??= build());
}

/** Test helper: start from a clean runtime. */
export function resetPotsRuntimeForTests(): void {
  g.__tablorsPotsRuntime = undefined;
}
