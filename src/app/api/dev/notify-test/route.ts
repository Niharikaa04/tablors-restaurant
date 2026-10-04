import { NextResponse } from "next/server";
import { getDemoSession } from "@/server/modules/auth/session";
import { notify, listFor } from "@/server/modules/notifications/store";
import {
  NOTIFICATION_TYPES,
  type NotifyInput,
} from "@/server/modules/notifications/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const session = await getDemoSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const only = new URL(req.url).searchParams.get("type");
  const keys = Object.keys(NOTIFICATION_TYPES) as NotifyInput["type"][];
  const toFire = only
    ? keys.filter((k) => String(k).toLowerCase() === only.toLowerCase())
    : keys;

  const created = toFire.map((type) =>
    notify({
      type,
      title: `TEST ${String(type)}`,
      message: `Test notification for ${String(type)}`,
    }),
  );

  return NextResponse.json({
    sessionRole: session.role,
    typeKeys: keys,
    created: created.map((n) => ({
      id: n.id,
      type: n.type,
      targetRoles: n.targetRoles,
    })),
    visibleToSession: listFor(session.role).length,
  });
}