"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission } from "./permissions";
import { getDemoSession } from "./session";
import { checkStaffPin, STAFF_PIN_COOKIE } from "./staff-pin";

export type StaffPinState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function verifyStaffPin(
  _prevState: StaffPinState,
  formData: FormData,
): Promise<StaffPinState> {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "staff")) redirect("/login");

  const pin = String(formData.get("pin") ?? "");
  if (!checkStaffPin(pin)) {
    return { status: "error", message: "Incorrect PIN. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(STAFF_PIN_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15, // re-enter the PIN after 15 minutes
  });

  redirect("/owner/staff");
}

/** Lets the owner lock the Staff page again straight away. */
export async function lockStaffPage() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_PIN_COOKIE);
  redirect("/owner/staff-pin");
}