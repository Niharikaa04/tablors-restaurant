import { describe, expect, it } from "vitest";

import { NOTIFICATION_TYPES as SERVER_TYPES } from "@/server/modules/notifications/types";
import { NOTIFICATION_TYPES as FEED_TYPES, TYPE_META } from "@/server/modules/notifications/feed";

describe("notification type registry", () => {
  it("every stored notification type has a feed type with title and link", () => {
    for (const key of Object.keys(SERVER_TYPES)) {
      const feedKey = key.toLowerCase();
      expect(FEED_TYPES as readonly string[], key).toContain(feedKey);
      const meta = TYPE_META[feedKey as keyof typeof TYPE_META];
      expect(meta?.title, key).toBeTruthy();
      expect(meta?.href, key).toMatch(/^\/owner\//);
    }
  });

  it("includes the offer and loyalty notification types", () => {
    expect(Object.keys(SERVER_TYPES)).toEqual(
      expect.arrayContaining(["OFFER_CREATED", "LOYALTY_POINTS_EARNED"])
    );
  });
});
