import { maskRef } from "./payroll";
import { PermissionError, type ActorRole } from "./support";
import { parseRupees, type Paise } from "./money";

/** Employees (salary profile + payout reference) and vendors (supplier profile + payout reference). Refs are provider tokens, always shown masked. */
export interface Employee { id: string; businessId: string; name: string; payoutRef: string; maskedRef: string; salaryPaise: Paise; status: "ACTIVE" | "INACTIVE" }
export interface Vendor { id: string; businessId: string; name: string; payoutRef: string; maskedRef: string; status: "ACTIVE" | "INACTIVE" }
export { parseRupees };

export class Directory {
  private emps = new Map<string, Employee>(); private vends = new Map<string, Vendor>(); private seq = 0;
  private owner(role: ActorRole) { if (role !== "OWNER") throw new PermissionError("only the owner can manage employees and vendors"); }
  private ref(r: string) { const t = r.trim(); if (t.length < 4 || t.length > 64) throw new Error("payout reference must be 4-64 characters"); return t; }
  addEmployee(businessId: string, i: { name: string; payoutRef: string; salaryPaise: Paise }, role: ActorRole): Employee {
    this.owner(role); if (!i.name.trim()) throw new Error("name is required");
    if (!Number.isSafeInteger(i.salaryPaise) || i.salaryPaise <= 0) throw new Error("salary must be greater than zero");
    const ref = this.ref(i.payoutRef); const e: Employee = { id: `emp_${++this.seq}`, businessId, name: i.name.trim(), payoutRef: ref, maskedRef: maskRef(ref), salaryPaise: i.salaryPaise, status: "ACTIVE" };
    this.emps.set(e.id, e); return e;
  }
  addVendor(businessId: string, i: { name: string; payoutRef: string }, role: ActorRole): Vendor {
    this.owner(role); if (!i.name.trim()) throw new Error("name is required");
    const ref = this.ref(i.payoutRef); const v: Vendor = { id: `ven_${++this.seq}`, businessId, name: i.name.trim(), payoutRef: ref, maskedRef: maskRef(ref), status: "ACTIVE" };
    this.vends.set(v.id, v); return v;
  }
  employees(businessId: string) { return [...this.emps.values()].filter((e) => e.businessId === businessId && e.status === "ACTIVE"); }
  vendors(businessId: string) { return [...this.vends.values()].filter((v) => v.businessId === businessId && v.status === "ACTIVE"); }
  vendor(id: string) { return this.vends.get(id); }
}
