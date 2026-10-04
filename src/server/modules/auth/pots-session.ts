import { cookies } from "next/headers";
import { POTS_PIN_COOKIE } from "./pots-pin";

export async function getPotsPinVerified(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(POTS_PIN_COOKIE)?.value === "granted";
}