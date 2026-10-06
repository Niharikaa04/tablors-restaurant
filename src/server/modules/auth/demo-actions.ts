"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkDemoCredentials, roleHome, SESSION_COOKIE } from "./demo-auth";

export type DemoLoginState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function demoLogin(
  _prevState: DemoLoginState,
  formData: FormData
): Promise<DemoLoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const role = checkDemoCredentials(username, password);
  if (!role) {
    return { status: "error", message: "Incorrect username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours — demo convenience only
  });

  redirect(roleHome[role]);
}

export async function demoLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}