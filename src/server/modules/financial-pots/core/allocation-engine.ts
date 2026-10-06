/**
 * The allocation engine now lives in the Pots module (single authoritative copy).
 * Re-exported here under the legacy names so existing financial-pots/core code
 * and tests keep working unchanged.
 */
export {
  allocate, activeRules, isRuleActive,
  type PotRuleBase as PotRule,
  type AllocationMethod as RuleMethod,
  type AllocationLine, type AllocationAlert, type AllocationAlertCode, type AllocationResult,
} from "@/server/modules/pots/rules";
