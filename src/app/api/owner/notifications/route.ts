import { NextResponse } from "next/server";
import { getDemoRole } from "@/server/modules/auth/session";
import {
  getNotificationFeed,
  markNotificationsRead,
} from "@/server/modules/notifications/feed";
import { listFor, setStatus } from "@/server/modules/notifications/store";
import "@/server/modules/notifications/connect";

const BUSINESS_ID = "demo-business";

export const dynamic = "force-dynamic";

async function allowed(): Promise<boolean> {
  const role = String(await getDemoRole()).toLowerCase();

  return role === "owner" || role === "manager";
}

/** Mirror "read" into the real notification store so the bell and the Notifications page agree. */
function markReadInStore(ids: string[] | "all"): void {
  for (const n of listFor("owner", null)) {
    if (n.status !== "unread") continue;

    if (ids === "all" || ids.includes(n.id)) {
      setStatus(n.id, "owner", "read");
    }
  }
}

export async function GET() {
  if (!(await allowed())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const feed = await getNotificationFeed(BUSINESS_ID);

  return NextResponse.json(
    {
      connected: feed.connected,
      unread: feed.unread,
      items: feed.items.map((n) => ({
        ...n,
        at: n.at.toISOString(),
      })),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}

export async function POST(req: Request) {
  if (!(await allowed())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ids?: unknown;
    all?: unknown;
  };

  if (body.all === true) {
    await markNotificationsRead("all", BUSINESS_ID);
    markReadInStore("all");
  } else if (Array.isArray(body.ids)) {
    const ids = body.ids
      .filter((id): id is string => typeof id === "string")
      .slice(0, 100);

    await markNotificationsRead(ids, BUSINESS_ID);
    markReadInStore(ids);
  } else {
    return new NextResponse("Bad request", { status: 400 });
  }

  return NextResponse.json({ ok: true });
}