import { getDemoSession } from "@/server/modules/auth/session";
import { listSince } from "@/server/modules/notifications/store";

export const dynamic = "force-dynamic";
// Serverless functions cannot hold a connection forever. The stream polls the
// database for new rows and closes itself well before the platform limit; the
// browser's EventSource reconnects automatically and resumes from the
// Last-Event-ID, so nothing is missed in between.
export const maxDuration = 60;

const POLL_MS = 3_000;
const MAX_STREAM_MS = 50_000;

export async function GET(req: Request) {
  const session = await getDemoSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const lastEventId = Number(req.headers.get("last-event-id"));
  let since = new Date(
    Number.isFinite(lastEventId) && lastEventId > 0 ? lastEventId : Date.now(),
  );

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", close);
      controller.enqueue(encoder.encode("retry: 3000\n\n"));

      while (!closed && Date.now() - startedAt < MAX_STREAM_MS) {
        try {
          const fresh = await listSince(session.role, since);

          for (const notification of fresh) {
            const at = new Date(notification.createdAt);
            if (at > since) since = at;
            controller.enqueue(
              encoder.encode(
                `id: ${at.getTime()}\ndata: ${JSON.stringify(notification)}\n\n`,
              ),
            );
          }

          if (fresh.length === 0) {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
        } catch (error) {
          console.error("[notifications:stream] poll failed", error);
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
