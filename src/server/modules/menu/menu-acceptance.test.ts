import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * --------------------------------------------------------------------------
 * TEST MOCKS
 * --------------------------------------------------------------------------
 *
 * The real application uses:
 *
 *   getDemoRole()
 *     -> reads the "tablors_demo_role" cookie
 *
 *   revalidatePath()
 *     -> Next.js cache invalidation
 *
 * The old acceptance test incorrectly expected:
 *
 *   auth.role
 *   revalidated
 *
 * Those APIs do not exist in the current application.
 *
 * We therefore mock the actual Next.js APIs used by the application.
 */

const cookieState = {
  role: null as "owner" | "kitchen" | "admin" | null,
};

const revalidatePathMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === "tablors_demo_role" && cookieState.role) {
        return {
          value: cookieState.role,
        };
      }

      return undefined;
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
  toggleItemAvailability,
} from "@/server/modules/menu/actions";

import { placeCustomerOrder } from "@/server/modules/orders/actions";

import {
  getMenu,
  getMenuItemByCode,
  getOrders,
  getMenuImage,
  getTopSellingItems,
  getOrdersByCategory,
  getSlowActiveOrders,
  getMenuItemUsage,
} from "@/server/modules/demo-store/store";

import { getEffectivePrice } from "@/lib/menu-shared";

/**
 * --------------------------------------------------------------------------
 * HELPERS
 * --------------------------------------------------------------------------
 */

function setRole(
  role: "owner" | "kitchen" | "admin" | null
): void {
  cookieState.role = role;
}

function check(
  name: string,
  condition: boolean,
  extra?: unknown
): void {
  if (condition) {
    console.log("  ✓", name);
  } else {
    console.log("  ✗", name, extra ?? "");
  }
}

function form(
  values: Record<string, string | boolean | File>
): FormData {
  const fd = new FormData();

  for (const [key, value] of Object.entries(values)) {
    fd.set(
      key,
      value instanceof File ? value : String(value)
    );
  }

  return fd;
}

function hasFieldError(
  result: unknown,
  field: string
): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }

  const value = result as {
    fieldErrors?: Record<string, unknown>;
  };

  return Boolean(value.fieldErrors?.[field]);
}

function getOrderId(
  result: Awaited<ReturnType<typeof placeCustomerOrder>>
): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  if ("orderId" in result && typeof result.orderId === "string") {
    return result.orderId;
  }

  return undefined;
}

function getError(
  result: unknown
): string {
  if (!result || typeof result !== "object") {
    return "";
  }

  const value = result as {
    error?: unknown;
  };

  return typeof value.error === "string"
    ? value.error
    : "";
}

const base = {
  name: "Pepper Chicken",
  code: "099",
  description: "",
  priceRupees: "280",
  category: "Chicken",
  veg: "non-veg",
  prepMinutes: "15",
  available: true,
  isSpecial: false,
  discountPercent: "",
};

/**
 * --------------------------------------------------------------------------
 * ACCEPTANCE TEST
 * --------------------------------------------------------------------------
 */

describe("Tablor menu / ordering acceptance flow", () => {
  beforeEach(() => {
    setRole(null);
    revalidatePathMock.mockClear();
  });

  it("passes the complete menu and ordering acceptance flow", async () => {
    let pass = 0;
    let fail = 0;

    const expectCheck = (
      name: string,
      condition: boolean,
      extra?: unknown
    ) => {
      check(name, condition, extra);

      if (condition) {
        pass++;
      } else {
        fail++;
      }
    };

    /**
     * ----------------------------------------------------------------------
     * SETUP
     * ----------------------------------------------------------------------
     */

    console.log(
      "Setup: existing seed already has 099 Pepper Chicken with a historical order (o1)."
    );

    setRole("owner");

    const seed099 = getMenuItemByCode("099");

    expectCheck(
      "seed 099 exists",
      Boolean(seed099)
    );

    if (!seed099) {
      throw new Error(
        "Acceptance test cannot continue: seeded item 099 was not found."
      );
    }

    /**
     * ----------------------------------------------------------------------
     * A. ARCHIVE EXISTING 099
     * ----------------------------------------------------------------------
     */

    const r0 = await deleteMenuItemAction(seed099.id);

    expectCheck(
      "seed 099 referenced by order o1 -> archived, not erased",
      r0.ok &&
        "message" in r0 &&
        /unchanged/.test(r0.message),
      r0
    );

    expectCheck(
      "archived item gone from getMenu()",
      !getMenu().some(
        (item) => item.id === seed099.id
      )
    );

    const o1 = getOrders().find(
      (order) => order.id === "o1"
    );

    expectCheck(
      "historical order o1 still exists",
      Boolean(o1)
    );

    if (!o1) {
      throw new Error(
        "Acceptance test cannot continue: historical order o1 was not found."
      );
    }

    expectCheck(
      "o1 line still intact after archive",
      o1.lines[0]?.name === "Pepper Chicken" &&
        o1.lines[0]?.priceRupees === 280 &&
        o1.lines[0]?.code === "099"
    );

    /**
     * ----------------------------------------------------------------------
     * A. OWNER CREATES NEW 099
     * ----------------------------------------------------------------------
     */

    console.log(
      "A. Owner creates 099 Pepper Chicken ₹280"
    );

    const a = await createMenuItemAction(
      form(base)
    );

    expectCheck(
      "created",
      a.ok,
      a
    );

    const item = getMenuItemByCode("099");

    expectCheck(
      "new item exists",
      Boolean(item)
    );

    if (!item) {
      throw new Error(
        "Acceptance test cannot continue: new item 099 was not created."
      );
    }

    expectCheck(
      "new item has fresh id != archived one",
      item.id !== seed099.id
    );

    expectCheck(
      "stored fields",
      item.priceRupees === 280 &&
        !item.veg &&
        item.prepMinutes === 15 &&
        item.available &&
        item.category === "Chicken"
    );

    /**
     * ----------------------------------------------------------------------
     * B. CUSTOMER / KITCHEN / OWNER SHARE CANONICAL MENU
     * ----------------------------------------------------------------------
     */

    console.log(
      "B. Customer sees it (getMenu is canonical source)"
    );

    expectCheck(
      "visible in canonical menu",
      getMenu().some(
        (menuItem) => menuItem.code === "099"
      )
    );

    /**
     * ----------------------------------------------------------------------
     * C/D. PRICE UPDATE
     * ----------------------------------------------------------------------
     */

    console.log("C/D. Price ₹320");

    const c = await updateMenuItemAction(
      item.id,
      form({
        ...base,
        priceRupees: "320",
      })
    );

    expectCheck(
      "updated",
      c.ok,
      c
    );

    expectCheck(
      "menu shows 320",
      getMenuItemByCode("099")?.priceRupees === 320
    );

    /**
     * ----------------------------------------------------------------------
     * E/F/G. UNAVAILABLE ITEM
     * ----------------------------------------------------------------------
     */

    console.log(
      "E/F/G. Unavailable -> direct checkout rejected"
    );

    const e = await toggleItemAvailability(
      "099",
      false
    );

    expectCheck(
      "toggle ok",
      e.ok,
      e
    );

    expectCheck(
      "menu shows unavailable",
      getMenuItemByCode("099")?.available === false
    );

    const ordersBefore = getOrders().length;

    const g = await placeCustomerOrder({
      tableId: "t01",
      lines: [
        {
          code: "099",
          qty: 1,
        },
      ],
    });

    expectCheck(
      "backend rejects unavailable item",
      !g.ok &&
        /unavailable/i.test(getError(g)),
      g
    );

    const g2 = await placeCustomerOrder({
      tableId: "t01",
      lines: [
        {
          code: "099",
          itemId: item.id,
          qty: 1,
        },
        {
          code: "125",
          qty: 1,
        },
      ],
    });

    expectCheck(
      "mixed cart rejected wholesale (no partial order)",
      !g2.ok &&
        getOrders().length === ordersBefore,
      g2
    );

    /**
     * ----------------------------------------------------------------------
     * H. ENABLE AGAIN + CUSTOMER ORDER
     * ----------------------------------------------------------------------
     */

    console.log(
      "H. Available again -> orderable"
    );

    await toggleItemAvailability(
      "099",
      true
    );

    /**
     * We intentionally send a fake client price.
     *
     * The cast is through unknown rather than any because the actual
     * production action owns the input validation/type.
     */
    const tamperedOrderInput =
      {
        tableId: "t01",
        lines: [
          {
            code: "099",
            qty: 2,
            priceRupees: 1,
          },
        ],
      } as unknown as Parameters<
        typeof placeCustomerOrder
      >[0];

    const h = await placeCustomerOrder(
      tamperedOrderInput
    );

    expectCheck(
      "order placed",
      h.ok,
      h
    );

    const placedOrderId = getOrderId(h);

    const placed = placedOrderId
      ? getOrders().find(
          (order) => order.id === placedOrderId
        )
      : undefined;

    expectCheck(
      "placed order exists",
      Boolean(placed),
      h
    );

    if (!placed) {
      throw new Error(
        "Acceptance test cannot continue: placed order was not found."
      );
    }

    expectCheck(
      "server resolved price (ignored client price)",
      placed.lines[0]?.priceRupees === 320
    );

    expectCheck(
      "line snapshot has itemId/category/prep/base",
      placed.lines[0]?.itemId === item.id &&
        placed.lines[0]?.category === "Chicken" &&
        placed.lines[0]?.basePriceRupees === 320
    );

    /**
     * ----------------------------------------------------------------------
     * J. CHANGE CODE 099 -> 105
     * ----------------------------------------------------------------------
     */

    console.log("J. Code 099 -> 105");

    const j = await updateMenuItemAction(
      item.id,
      form({
        ...base,
        code: "105",
        priceRupees: "320",
      })
    );

    expectCheck(
      "code changed",
      j.ok,
      j
    );

    expectCheck(
      "099 now free, 105 owned",
      !getMenuItemByCode("099") &&
        getMenuItemByCode("105")?.id === item.id
    );

    /**
     * ----------------------------------------------------------------------
     * K. DUPLICATE CODE
     * ----------------------------------------------------------------------
     */

    console.log("K. Duplicate code rejected");

    const k = await updateMenuItemAction(
      item.id,
      form({
        ...base,
        code: "125",
      })
    );

    expectCheck(
      "duplicate rejected with owner named",
      !k.ok &&
        hasFieldError(k, "code") &&
        (() => {
          if (
            !k ||
            typeof k !== "object"
          ) {
            return false;
          }

          const result = k as {
            fieldErrors?: Record<
              string,
              unknown
            >;
          };

          return (
            typeof result.fieldErrors?.code ===
              "string" &&
            /Butter Naan/.test(
              result.fieldErrors.code
            )
          );
        })(),
      k
    );

    const k2 = await createMenuItemAction(
      form({
        ...base,
        name: "Other",
        code: "105",
      })
    );

    expectCheck(
      "duplicate on create rejected",
      !k2.ok,
      k2
    );

    /**
     * ----------------------------------------------------------------------
     * L. HISTORICAL ORDER SNAPSHOT
     * ----------------------------------------------------------------------
     */

    console.log(
      "L. Historical orders unchanged"
    );

    expectCheck(
      "placed order still code 099 / ₹320 / name",
      placed.lines[0]?.code === "099" &&
        placed.lines[0]?.priceRupees === 320 &&
        placed.lines[0]?.name === "Pepper Chicken"
    );

    await updateMenuItemAction(
      item.id,
      form({
        ...base,
        name: "Pepper Chicken Deluxe",
        code: "105",
        priceRupees: "400",
        category: "Specials",
      })
    );

    expectCheck(
      "rename/reprice/recategorise doesn't touch order line",
      placed.lines[0]?.name ===
        "Pepper Chicken" &&
        placed.lines[0]?.priceRupees === 320 &&
        placed.lines[0]?.category ===
          "Chicken"
    );

    expectCheck(
      "analytics group by itemId, use snapshot category",
      getOrdersByCategory().some(
        (category) =>
          category.category === "Chicken"
      )
    );

    expectCheck(
      "slow-order calc uses snapshot prep (no crash)",
      Array.isArray(
        getSlowActiveOrders()
      )
    );

    /**
     * ----------------------------------------------------------------------
     * REUSE FREED CODE 099
     * ----------------------------------------------------------------------
     */

    const reuse = await createMenuItemAction(
      form({
        ...base,
        name: "Garlic Chicken",
        code: "099",
      })
    );

    expectCheck(
      "freed code 099 reusable by new item",
      reuse.ok,
      reuse
    );

    expectCheck(
      "old order line still resolves to original item, not Garlic Chicken",
      placed.lines[0]?.itemId === item.id
    );

    /**
     * ----------------------------------------------------------------------
     * TOP SELLING
     * ----------------------------------------------------------------------
     */

    {
      const top = getTopSellingItems(50);

      expectCheck(
        "top-selling merges a renamed/recoded item into ONE row (no 'Deluxe' split)",
        top.filter((entry) =>
          entry.name.startsWith(
            "Pepper Chicken"
          )
        ).length === 2 &&
          !top.some(
            (entry) =>
              entry.name ===
              "Pepper Chicken Deluxe"
          ),
        top.filter((entry) =>
          entry.name.startsWith(
            "Pepper"
          )
        )
      );

      const mine = top.find(
        (entry) =>
          entry.qtySold === 2 &&
          entry.name === "Pepper Chicken"
      );

      expectCheck(
        "recreated item counted under its stable id despite rename+recode",
        Boolean(mine),
        top.filter((entry) =>
          entry.name.startsWith(
            "Pepper"
          )
        )
      );
    }

    /**
     * ----------------------------------------------------------------------
     * STALE CODE + VALID ITEM ID
     * ----------------------------------------------------------------------
     */

    const stale =
      await placeCustomerOrder({
        tableId: "t01",
        lines: [
          {
            code: "099",
            itemId: item.id,
            qty: 1,
          },
        ],
      });

    const staleOrderId = getOrderId(
      stale
    );

    const staleOrder = staleOrderId
      ? getOrders().find(
          (order) =>
            order.id === staleOrderId
        )
      : undefined;

    expectCheck(
      "cart with itemId survives code edit (orders the right item)",
      stale.ok &&
        staleOrder?.lines[0]?.name ===
          "Pepper Chicken Deluxe",
      stale
    );

    /**
     * ----------------------------------------------------------------------
     * M/N. TODAY'S SPECIAL
     * ----------------------------------------------------------------------
     */

    console.log(
      "M/N. Today's special"
    );

    await updateMenuItemAction(
      item.id,
      form({
        ...base,
        name: "Pepper Chicken",
        code: "105",
        priceRupees: "300",
        isSpecial: true,
      })
    );

    expectCheck(
      "isSpecial persisted in canonical menu",
      getMenuItemByCode("105")
        ?.isSpecial === true
    );

    /**
     * ----------------------------------------------------------------------
     * O/P. DISCOUNT
     * ----------------------------------------------------------------------
     */

    console.log(
      "O/P. 10% discount"
    );

    await updateMenuItemAction(
      item.id,
      form({
        ...base,
        code: "105",
        priceRupees: "300",
        isSpecial: true,
        discountPercent: "10",
      })
    );

    const d =
      getMenuItemByCode("105");

    if (!d) {
      throw new Error(
        "Discount test item 105 was not found."
      );
    }

    expectCheck(
      "base 300 kept, effective 270",
      d.priceRupees === 300 &&
        getEffectivePrice(d) === 270
    );

    const dOrder =
      await placeCustomerOrder({
        tableId: "t04",
        lines: [
          {
            code: "105",
            qty: 2,
          },
        ],
      });

    const dOrderId =
      getOrderId(dOrder);

    const discountOrder =
      dOrderId
        ? getOrders().find(
            (order) =>
              order.id === dOrderId
          )
        : undefined;

    const dl =
      discountOrder?.lines[0];

    expectCheck(
      "discount order was created",
      Boolean(dl),
      dOrder
    );

    expectCheck(
      "order charged 270, snapshot keeps base 300 + 10%",
      dl?.priceRupees === 270 &&
        dl.basePriceRupees === 300 &&
        dl.discountPercent === 10
    );

    /**
     * ----------------------------------------------------------------------
     * Q. SHARED MENU SOURCE
     * ----------------------------------------------------------------------
     */

    console.log(
      "Q. Kitchen reads same source"
    );

    expectCheck(
      "kitchen/customer/owner share getMenu() (single array)",
      getMenu().find(
        (menuItem) =>
          menuItem.code === "105"
      )?.discountPercent === 10
    );

    /**
     * ----------------------------------------------------------------------
     * SERVER-SIDE VALIDATION
     * ----------------------------------------------------------------------
     */

    console.log(
      "Validation (server-side)"
    );

    type ValidationPatch = Record<
      string,
      string | boolean | File
    >;

    const bad = async (
      patch: ValidationPatch,
      field: string
    ) => {
      const result =
        await createMenuItemAction(
          form({
            ...base,
            code: "555",
            name: "Zed",
            ...patch,
          })
        );

      expectCheck(
        `rejects bad ${field} (${JSON.stringify(
          patch
        )})`,
        !result.ok &&
          hasFieldError(
            result,
            field
          ),
        result
      );
    };

    await bad(
      { name: "  " },
      "name"
    );

    await bad(
      { code: "" },
      "code"
    );

    await bad(
      { code: "12" },
      "code"
    );

    await bad(
      { code: "abc" },
      "code"
    );

    await bad(
      { priceRupees: "-5" },
      "priceRupees"
    );

    await bad(
      { priceRupees: "abc" },
      "priceRupees"
    );

    await bad(
      { priceRupees: "" },
      "priceRupees"
    );

    await bad(
      { prepMinutes: "-1" },
      "prepMinutes"
    );

    await bad(
      { category: "" },
      "category"
    );

    await bad(
      { veg: "" },
      "veg"
    );

    await bad(
      { discountPercent: "101" },
      "discountPercent"
    );

    await bad(
      { discountPercent: "-3" },
      "discountPercent"
    );

    await bad(
      { discountPercent: "5.5" },
      "discountPercent"
    );

    expectCheck(
      "nothing invalid was created",
      !getMenuItemByCode("555")
    );

    const cat =
      await createMenuItemAction(
        form({
          ...base,
          code: "556",
          name: "Cat Test",
          category: "chicken",
        })
      );

    expectCheck(
      "category casing normalised to existing 'Chicken'",
      cat.ok &&
        getMenuItemByCode("556")
          ?.category === "Chicken",
      cat
    );

    /**
     * ----------------------------------------------------------------------
     * IMAGES
     * ----------------------------------------------------------------------
     */

    console.log("Images");

    const png = new File(
      [
        new Uint8Array([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
          0,
          0,
          0,
          0,
        ]),
      ],
      "a.png",
      {
        type: "image/png",
      }
    );

    const im =
      await createMenuItemAction(
        form({
          ...base,
          code: "557",
          name: "Img",
          image: png,
        })
      );

    const imgItem =
      getMenuItemByCode("557");

    expectCheck(
      "image test item created",
      Boolean(imgItem),
      im
    );

    if (!imgItem) {
      throw new Error(
        "Image test item was not created."
      );
    }

    expectCheck(
      "valid PNG stored + url set",
      im.ok &&
        Boolean(imgItem.imageUrl) &&
        Boolean(
          getMenuImage(imgItem.id)
        )
    );

    const txt = new File(
      [
        new TextEncoder().encode(
          "hello"
        ),
      ],
      "a.png",
      {
        type: "image/png",
      }
    );

    const im2 =
      await updateMenuItemAction(
        imgItem.id,
        form({
          ...base,
          code: "557",
          name: "Img",
          image: txt,
        })
      );

    expectCheck(
      "fake image (wrong magic bytes) rejected, old image kept",
      !im2.ok &&
        Boolean(
          getMenuImage(imgItem.id)
        )
    );

    const gif = new File(
      [
        new Uint8Array([
          1,
          2,
          3,
        ]),
      ],
      "a.gif",
      {
        type: "image/gif",
      }
    );

    const im3 =
      await updateMenuItemAction(
        imgItem.id,
        form({
          ...base,
          code: "557",
          name: "Img",
          image: gif,
        })
      );

    expectCheck(
      "unsupported type rejected",
      !im3.ok,
      im3
    );

    const big = new File(
      [
        new Uint8Array(
          600 * 1024
        ),
      ],
      "b.png",
      {
        type: "image/png",
      }
    );

    const im4 =
      await updateMenuItemAction(
        imgItem.id,
        form({
          ...base,
          code: "557",
          name: "Img",
          image: big,
        })
      );

    expectCheck(
      "oversize rejected",
      !im4.ok,
      im4
    );

    const im5 =
      await updateMenuItemAction(
        imgItem.id,
        form({
          ...base,
          code: "557",
          name: "Img",
          removeImage: true,
        })
      );

    expectCheck(
      "remove image works",
      im5.ok &&
        imgItem.imageUrl === null &&
        !getMenuImage(imgItem.id),
      im5
    );

    /**
     * ----------------------------------------------------------------------
     * DELETE SEMANTICS
     * ----------------------------------------------------------------------
     */

    console.log(
      "Delete semantics"
    );

    expectCheck(
      "usage map counts order lines",
      (getMenuItemUsage()[item.id] ?? 0) >= 3
    );

    const delNew =
      await deleteMenuItemAction(
        imgItem.id
      );

    expectCheck(
      "never-ordered item hard-deleted",
      delNew.ok &&
        !getMenu().some(
          (menuItem) =>
            menuItem.id === imgItem.id
        ),
      delNew
    );

    const delUsed =
      await deleteMenuItemAction(
        item.id
      );

    expectCheck(
      "ordered item archived; its order lines untouched",
      delUsed.ok &&
        placed.lines[0]?.name ===
          "Pepper Chicken" &&
        dl?.priceRupees === 270,
      delUsed
    );

    /**
     * Archived item by itemId.
     */

    const reorder =
      await placeCustomerOrder({
        tableId: "t01",
        lines: [
          {
            code: "105",
            itemId: item.id,
            qty: 1,
          },
        ],
      });

    expectCheck(
      "archived item can't be ordered (by id)",
      !reorder.ok,
      reorder
    );

    /**
     * Archived item by code.
     */

    const reorder2 =
      await placeCustomerOrder({
        tableId: "t01",
        lines: [
          {
            code: "105",
            qty: 1,
          },
        ],
      });

    expectCheck(
      "archived item can't be ordered (by code)",
      !reorder2.ok,
      reorder2
    );

    /**
     * ----------------------------------------------------------------------
     * QUANTITY VALIDATION
     * ----------------------------------------------------------------------
     */

    console.log(
      "Quantity validation"
    );

    for (
      const qty of [
        0,
        -1,
        1.5,
        100,
        NaN,
      ]
    ) {
      const result =
        await placeCustomerOrder({
          tableId: "t01",
          lines: [
            {
              code: "125",
              qty,
            },
          ],
        });

      expectCheck(
        `qty ${qty} rejected`,
        !result.ok,
        result
      );
    }

    /**
     * ----------------------------------------------------------------------
     * AUTHORIZATION
     * ----------------------------------------------------------------------
     */

    console.log(
      "Authorization"
    );

    const before =
      getMenu().length;

    for (
      const role of [
        null,
        "kitchen",
        "admin",
      ] as const
    ) {
      setRole(role);

      const cr =
        await createMenuItemAction(
          form({
            ...base,
            code: "700",
            name: "Hax",
          })
        );

      const existing125 =
        getMenuItemByCode("125");

      if (!existing125) {
        throw new Error(
          "Seeded menu item 125 was not found."
        );
      }

      const up =
        await updateMenuItemAction(
          existing125.id,
          form({
            ...base,
            code: "125",
            name: "Hax",
            priceRupees: "1",
          })
        );

      const de =
        await deleteMenuItemAction(
          existing125.id
        );

      expectCheck(
        `role=${role}: create/update/delete all denied`,
        !cr.ok &&
          !up.ok &&
          !de.ok,
        {
          create: cr,
          update: up,
          delete: de,
        }
      );
    }

    expectCheck(
      "no mutation leaked",
      getMenu().length === before &&
        getMenuItemByCode("125")
          ?.name === "Butter Naan" &&
        !getMenuItemByCode("700")
    );

    /**
     * Kitchen is allowed to change availability.
     */

    setRole("kitchen");

    const kt =
      await toggleItemAvailability(
        "125",
        false
      );

    expectCheck(
      "kitchen may still toggle availability (existing behaviour kept)",
      kt.ok,
      kt
    );

    await toggleItemAvailability(
      "125",
      true
    );

    /**
     * Signed-out user cannot change availability.
     */

    setRole(null);

    const nt =
      await toggleItemAvailability(
        "125",
        false
      );

    expectCheck(
      "signed-out cannot toggle",
      !nt.ok,
      nt
    );

    /**
     * ----------------------------------------------------------------------
     * REVALIDATION
     * ----------------------------------------------------------------------
     *
     * The production code calls:
     *
     *   revalidatePath("/owner")
     *   revalidatePath("/owner/menu")
     *   revalidatePath("/kitchen")
     *   revalidatePath("/customer/menu")
     *   revalidatePath("/customer/[tableId]", "page")
     *
     * There is no `revalidated` export from next/cache.
     */

    const revalidatedPaths =
      revalidatePathMock.mock.calls.map(
        ([path]) => path
      );

    expectCheck(
      "all menu surfaces revalidated",
      [
        "/owner",
        "/owner/menu",
        "/kitchen",
        "/customer/menu",
        "/customer/[tableId]",
      ].every((path) =>
        revalidatedPaths.includes(path)
      ),
      revalidatedPaths
    );

    /**
     * ----------------------------------------------------------------------
     * FINAL RESULT
     * ----------------------------------------------------------------------
     */

    console.log(
      `\n${pass} passed, ${fail} failed`
    );

    expect(
      fail,
      `Acceptance test failed with ${fail} failure(s).`
    ).toBe(0);
  });
});