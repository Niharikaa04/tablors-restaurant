import { cookies } from "next/headers";
import { STAFF_PIN_COOKIE } from "./staff-pin";

export async function getStaffPinVerified(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(STAFF_PIN_COOKIE)?.value === "granted";
}