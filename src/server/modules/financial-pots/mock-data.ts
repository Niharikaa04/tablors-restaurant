import type { FinancialPot } from "./types";

/**
 * DEMO / MOCK DATA ONLY.
 *
 * These figures are illustrative placeholders. They are not read from or
 * written to any real billing, payment, or bank data, and no allocation
 * engine calculates them — the allocation basis (percentage of sales,
 * fixed monthly target, or manual entry) has not been confirmed yet.
 *
 * This module is structured so a real implementation can later replace
 * the body of these functions with database/allocation-engine calls
 * without changing the shape callers rely on.
 */
const financialPotsMock: FinancialPot[] = [
  {
    id: "gst",
    name: "GST",
    description: "Reserved for the business's configured tax liability.",
    allocatedRupees: 18000,
    usedRupees: 12500,
  },
  {
    id: "salary",
    name: "Staff Salary",
    description: "Monthly payroll reserve for restaurant staff.",
    allocatedRupees: 60000,
    usedRupees: 42000,
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Supplier and stock purchase reserve.",
    allocatedRupees: 25000,
    usedRupees: 21000,
  },
  {
    id: "maintenance",
    name: "Maintenance",
    description: "Repairs and upkeep of equipment and premises.",
    allocatedRupees: 6000,
    usedRupees: 4200,
  },
  {
    id: "subscriptions",
    name: "Subscriptions",
    description: "Recurring software and service subscriptions.",
    allocatedRupees: 3000,
    usedRupees: 2600,
  },
  {
    id: "service-charges",
    name: "Service Charges",
    description: "Business-defined service/operating allocation.",
    allocatedRupees: 8000,
    usedRupees: 3100,
  },
  {
    id: "owner-profit",
    name: "Owner Profit",
    description:
      "Remaining amount after obligations. \"Used\" reflects amount already withdrawn by the owner.",
    allocatedRupees: 40000,
    usedRupees: 15000,
  },
];

export function getFinancialPots(): FinancialPot[] {
  return financialPotsMock;
}

export function getFinancialPotById(id: string): FinancialPot | undefined {
  return financialPotsMock.find((pot) => pot.id === id);
}