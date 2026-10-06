"use server";

import { headers } from "next/headers";
import { demoRequestSchema } from "./schema";
import { checkRateLimit } from "./rate-limit";
import { recordLead } from "@/server/modules/demo-store/store";

export type SubmitDemoRequestState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "rate_limited"; message: string };

export async function submitDemoRequest(
  _prevState: SubmitDemoRequestState,
  formData: FormData
): Promise<SubmitDemoRequestState> {
  const headerList = await headers();
  // Behind a proxy, only the first entry in x-forwarded-for is
  // meaningful; fall back to a constant key in dev where it's absent.
  const forwardedFor = headerList.get("x-forwarded-for");
  const clientKey = forwardedFor?.split(",")[0]?.trim() ?? "local-dev";

  const rateLimit = checkRateLimit(`demo-request:${clientKey}`);
  if (!rateLimit.allowed) {
    return {
      status: "rate_limited",
      message: "Too many requests from this connection. Please try again later.",
    };
  }

  const raw = {
    restaurantName: formData.get("restaurantName"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    	city: formData.get("city") ?? "",
    tableCount: formData.get("tableCount"),
    restaurantType: formData.get("restaurantType") ?? "",
    message: formData.get("message") ?? "",
    consent: formData.get("consent") === "on",
    companyWebsite: formData.get("companyWebsite") ?? "",
  };

  const parsed = demoRequestSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  // Honeypot tripped — pretend success so bots don't learn anything,
  // but do not persist the submission.
  if (parsed.data.companyWebsite) {
    return { status: "success" };
  }

  // Phase 1 demo: no database yet (real schema lands in Phase 2). We
  // record into the in-memory demo store so the Company Admin demo can
  // show it, and log server-side. Nothing here is trusted from the
  // client beyond what Zod has already validated.
  recordLead({
    restaurantName: parsed.data.restaurantName,
    ownerName: parsed.data.fullName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    city: parsed.data.city,
    tableCount: parsed.data.tableCount,
    restaurantType: parsed.data.restaurantType,
  });
  console.info("[leads] demo request received", {
    restaurantName: parsed.data.restaurantName,
    city: parsed.data.city,
    restaurantType: parsed.data.restaurantType,
    tableCount: parsed.data.tableCount,
  });

  return { status: "success" };
}
