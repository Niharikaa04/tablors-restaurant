import { NextResponse } from "next/server";
import { getPotsPinVerified } from "@/server/modules/auth/pots-session";
import { getDemoRole } from "@/server/modules/auth/session";
import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { gstCsv } from "@/server/modules/pots/reports";

export const dynamic = "force-dynamic";

/** Accountant export (Pots spec §10). PIN-gated and limited to roles that may view reports. */
export async function GET(req: Request) {
  const role = String(await getDemoRole());
  if (!(await getPotsPinVerified()) || !["owner", "accountant", "manager"].includes(role)) return new NextResponse("Forbidden", { status: 403 });
  const m = new URL(req.url).searchParams.get("m") ?? undefined;
  return new NextResponse(gstCsv(getPotsRuntime(), m), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="gst-reserve-${m ?? "latest"}.csv"` } });
}
