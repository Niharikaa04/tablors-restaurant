import { describe, expect, it } from "vitest";

import { formatDay, istDay, resolveDay, todayIst } from "@/lib/day";

describe("day helpers (India time)", () => {
  it("rolls to the next day at 18:30 UTC, i.e. midnight IST", () => {
    expect(istDay(Date.parse("2026-10-17T18:29:00Z"))).toBe("2026-10-17");
    expect(istDay(Date.parse("2026-10-17T18:31:00Z"))).toBe("2026-10-18");
  });

  it("falls back to today for missing, malformed or future dates", () => {
    const today = todayIst();
    expect(resolveDay(undefined)).toBe(today);
    expect(resolveDay("not-a-date")).toBe(today);
    expect(resolveDay("2099-01-01")).toBe(today);
    expect(resolveDay("2026-10-16")).toBe("2026-10-16");
  });

  it("formats a day for display", () => {
    expect(formatDay("2026-10-16")).toContain("16");
  });
});
