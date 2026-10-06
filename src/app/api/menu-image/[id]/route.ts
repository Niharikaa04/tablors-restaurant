import { getMenuImage } from "@/server/modules/demo-store/store";

/**
 * Serves a menu item's uploaded image from the shared store. Public on
 * purpose (customers see menu photos); read-only. Uploads happen only
 * through the owner-authorized server actions in modules/menu/actions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = getMenuImage(id);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(image.bytes as BodyInit, {
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.bytes.byteLength),
      // URL carries ?v=<version>, so a replaced image gets a new URL.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
