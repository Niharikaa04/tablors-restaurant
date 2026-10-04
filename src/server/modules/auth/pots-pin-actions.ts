"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPotsPin, POTS_PIN_COOKIE } from "./pots-pin";

export type PotsPinState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function verifyPotsPin(
  _prevState: PotsPinState,
  formData: FormData
): Promise<PotsPinState> {
  const pin = String(formData.get("pin") ?? "");

  if (!checkPotsPin(pin)) {
    return { status: "error", message: "Incorrect PIN. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(POTS_PIN_COOKIE, "granted", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Shorter than the main session (8h) since this gates sensitive data —
    // demo convenience only, re-verify after 15 minutes.
    maxAge: 60 * 15,
  });

  redirect("/owner/pots");
}