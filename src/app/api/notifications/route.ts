import { NextResponse } from "next/server";
import { getDemoSession } from "@/server/modules/auth/session";
import { listFor, setStatus } from "@/server/modules/notifications/store";
import type { Status } from "@/server/modules/notifications/types";

export const dynamic = "force-dynamic";

const STATUSES = ["unread", "read", "acknowledged", "resolved"];

export async function GET(req: Request) {
  const session = await getDemoSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const type = new URL(req.url).searchParams.get("type");

  return NextResponse.json(listFor(session.role, type), {
    headers: { "cache-control": "no-store" },
  });
}

export async function PATCH(req: Request) {
  const session = await getDemoSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    status?: unknown;
  };

  if (
    typeof body.id !== "string" ||
    typeof body.status !== "string" ||
    !STATUSES.includes(body.status)
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const ok = setStatus(body.id, session.role, body.status as Status);
  if (!ok) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}