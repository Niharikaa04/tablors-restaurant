import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: null as string | null }));

vi.mock("@/server/modules/auth/session", () => ({
  getDemoRole: async () => session.role,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { createDemoOrder, getOrder } from "@/server/modules/demo-store/store";
import { advanceOrder } from "./actions";

function freshOrder() {
  return createDemoOrder("t01", [
    { code: "125", name: "Butter Naan", qty: 1, priceRupees: 45 },
  ]);
}

describe("advanceOrder", () => {
  beforeEach(() => {
    session.role = null;
  });

  it("rejects a signed-out caller and leaves the order unchanged", async () => {
    const order = freshOrder();

    const result = await advanceOrder(order.id);

    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(getOrder(order.id)?.status).toBe("new");
  });

  it("lets the owner advance an order", async () => {
    session.role = "owner";
    const order = freshOrder();

    expect(await advanceOrder(order.id)).toEqual({ ok: true });
    expect(getOrder(order.id)?.status).toBe("preparing");
  });

  it("lets the kitchen advance an order, and the owner sees the same state", async () => {
    session.role = "kitchen";
    const order = freshOrder();

    await advanceOrder(order.id);
    await advanceOrder(order.id);

    session.role = "owner";
    expect(getOrder(order.id)?.status).toBe("ready");
  });

  it("returns a safe error for a nonexistent order", async () => {
    session.role = "owner";

    expect(await advanceOrder("nope")).toMatchObject({
      ok: false,
      code: "missing",
    });
  });

  it("rejects an empty order id", async () => {
    session.role = "owner";

    expect(await advanceOrder("  ")).toMatchObject({
      ok: false,
      code: "invalid",
    });
  });

  it("does not let a served order advance to billed", async () => {
    session.role = "owner";
    const order = freshOrder();

    await advanceOrder(order.id);
    await advanceOrder(order.id);
    await advanceOrder(order.id);

    expect(await advanceOrder(order.id)).toMatchObject({
      ok: false,
      code: "served",
    });
    expect(getOrder(order.id)?.status).toBe("served");
  });

  it("rejects a stale click instead of skipping a step", async () => {
    session.role = "owner";
    const order = freshOrder();

    await advanceOrder(order.id, "new");

    expect(await advanceOrder(order.id, "new")).toMatchObject({
      ok: false,
      code: "stale",
    });
    expect(getOrder(order.id)?.status).toBe("preparing");
  });
});