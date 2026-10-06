// src/app/api/notifications/stream/route.ts

import { getDemoSession } from "@/server/modules/auth/session";
import { notificationBus } from "@/server/modules/notifications/store";
import type { Notification } from "@/server/modules/notifications/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getDemoSession();

  if (!session) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (notification: Notification) => {
        if (!notification.targetRoles.includes(session.role)) {
          return;
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(notification)}\n\n`,
          ),
        );
      };

      const ping = setInterval(() => {
        controller.enqueue(
          encoder.encode(": ping\n\n"),
        );
      }, 25_000);

      notificationBus.on("new", send);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        notificationBus.off("new", send);

        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}