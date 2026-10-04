"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDemoRole } from "@/server/modules/auth/session";
import { issueBill } from "@/server/modules/demo-store/store";

/**
 * Billing is owner-only financial functionality. The role is checked here
 * on the server for every mutation — hidden buttons are not protection.
 */
async function isOwner(): Promise<boolean> {
  const role = await getDemoRole();
  return role === "owner";
}

function revalidateBillingSurfaces(): void {
  revalidatePath("/owner/billing");
  revalidatePath("/owner/payments");
  revalidatePath("/owner/orders");
  revalidatePath("/owner/tables");
  revalidatePath("/owner");
}

/**
 * Sends the owner back to the billing page with a notice code (and an
 * optional bill id). redirect() throws internally, so call it as the
 * last statement of a branch.
 */
function back(code: string, billId?: string): never {
  const params = new URLSearchParams({ notice: code });

  if (billId) {
    params.set("bill", billId);
  }

  redirect(`/owner/billing?${params.toString()}`);
}

/** Strict numeric read: missing, empty or non-numeric input returns null. */
function readNumber(formData: FormData, key: string): number | null {
  const raw = formData.get(key);

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  if (trimmed === "") {
    return null;
  }

  const value = Number(trimmed);

  return Number.isFinite(value) ? value : null;
}

export async function createBill(
  orderId: string,
  formData: FormData
): Promise<void> {
  if (!(await isOwner())) {
    return back("forbidden");
  }

  if (typeof orderId !== "string" || orderId.trim() === "") {
    return back("invalid");
  }

  const gstPercent = readNumber(formData, "gstPercent");
  const serviceChargePercent = readNumber(formData, "serviceChargePercent");
  const discountRupees = readNumber(formData, "discountRupees");

  if (gstPercent === null) {
    return back("invalid-gst");
  }

  if (serviceChargePercent === null) {
    return back("invalid-service-charge");
  }

  if (discountRupees === null) {
    return back("invalid-discount");
  }

  const result = issueBill(orderId.trim(), {
    gstPercent,
    serviceChargePercent,
    discountRupees,
  });

  // Revalidate on failure too, so a stale screen picks up the latest state.
  revalidateBillingSurfaces();

  if (result.ok) {
    return back("billed", result.bill.id);
  }

  switch (result.reason) {
    case "not-found":
      return back("missing");
    case "not-served":
      return back("not-served");
    case "already-billed":
      return back("duplicate", result.bill.id);
    case "table-mismatch":
      return back("table-missing");
    case "empty-order":
      return back("empty");
    case "invalid-gst":
      return back("invalid-gst");
    case "invalid-service-charge":
      return back("invalid-service-charge");
    case "invalid-discount":
      return back("invalid-discount");
    case "discount-too-large":
      return back("discount-too-large");
  }
}