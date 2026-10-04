import { describe, expect, it } from "vitest";
import { canActOnStaffRole, hasPermission, type Permission } from "./permissions";

describe("hasPermission", () => {
  it("owner can open every Owner Portal area", () => {
    for (const p of ["overview", "menu", "tables", "orders", "billing", "payments", "pots", "devices", "reports", "staff"] as Permission[]) {
      expect(hasPermission("owner", p)).toBe(true);
    }
  });

  it("only owner and manager can open Staff", () => {
    expect(hasPermission("owner", "staff")).toBe(true);
    expect(hasPermission("manager", "staff")).toBe(true);
    for (const r of ["cashier", "kitchen", "waiter", "admin"] as const) {
      expect(hasPermission(r, "staff")).toBe(false);
    }
    expect(hasPermission(null, "staff")).toBe(false);
  });

  it("kitchen and waiter never reach owner-only financial data", () => {
    for (const r of ["kitchen", "waiter"] as const) {
      for (const p of ["billing", "payments", "pots", "reports", "overview"] as Permission[]) {
        expect(hasPermission(r, p)).toBe(false);
      }
    }
  });

  it("cashier gets billing and payments only", () => {
    expect(hasPermission("cashier", "billing")).toBe(true);
    expect(hasPermission("cashier", "payments")).toBe(true);
    for (const p of ["menu", "tables", "orders", "pots", "devices", "reports", "staff"] as Permission[]) {
      expect(hasPermission("cashier", p)).toBe(false);
    }
  });

  it("manager has no billing, payments or pots", () => {
    for (const p of ["billing", "payments", "pots"] as Permission[]) {
      expect(hasPermission("manager", p)).toBe(false);
    }
  });
});

describe("canActOnStaffRole", () => {
  it("owner may act on any role", () => {
    for (const r of ["owner", "manager", "cashier", "kitchen", "waiter"] as const) {
      expect(canActOnStaffRole("owner", r)).toBe(true);
    }
  });

  it("manager may not create, promote or touch an owner", () => {
    expect(canActOnStaffRole("manager", "owner")).toBe(false);
    for (const r of ["manager", "cashier", "kitchen", "waiter"] as const) {
      expect(canActOnStaffRole("manager", r)).toBe(true);
    }
  });

  it("other roles may not manage staff", () => {
    for (const a of ["cashier", "kitchen", "waiter", "admin"] as const) {
      expect(canActOnStaffRole(a, "waiter")).toBe(false);
    }
  });
});

describe("new Owner Portal areas", () => {
  it("subscription and settings are owner-only", () => {
    for (const p of ["subscription", "settings"] as Permission[]) {
      expect(hasPermission("owner", p)).toBe(true);
      for (const r of ["manager", "cashier", "kitchen", "waiter", "admin"] as const) {
        expect(hasPermission(r, p)).toBe(false);
      }
    }
  });

  it("support and feedback are for owner and manager", () => {
    for (const p of ["support", "feedback"] as Permission[]) {
      expect(hasPermission("owner", p)).toBe(true);
      expect(hasPermission("manager", p)).toBe(true);
      for (const r of ["cashier", "kitchen", "waiter", "admin"] as const) {
        expect(hasPermission(r, p)).toBe(false);
      }
    }
  });
});
