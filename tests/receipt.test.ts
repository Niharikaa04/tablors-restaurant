import { describe, expect, it } from "vitest";

import { buildReceipt } from "@/server/modules/billing/receipt";

const bill = {
  id: "b1",
  orderId: "o1",
  subtotalPaise: 39700,
  gstPaise: 1985,
  discountPaise: 2000,
  serviceChargePaise: 500,
  totalPaise: 40185,
  paidAt: null as Date | null,
  paymentMethod: null as "cash" | "qr" | null,
};

const items = [
  { code: "101", nameSnapshot: "Paneer Tikka", qty: 2, pricePaise: 18000 },
  { code: "205", nameSnapshot: "Masala Dosa", qty: 3, pricePaise: 1233 },
];

describe("buildReceipt", () => {
  it("lists every item with qty, unit price and an integer-exact line total", () => {
    const r = buildReceipt({
      bill,
      items,
      payments: [],
      tableLabel: "Table 05",
      orderPlacedAt: new Date("2026-10-18T10:00:00Z"),
    });

    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]).toMatchObject({ name: "Paneer Tikka", qty: 2, unitRupees: 180, lineRupees: 360 });
    // 3 x 12.33 = 36.99 (integer paise maths, no 36.989999… drift)
    expect(r.lines[1].lineRupees).toBe(36.99);
    expect(r.itemCount).toBe(5);
    expect(r.tableLabel).toBe("Table 05");
  });

  it("takes subtotal, discount, service charge, GST and total from the stored bill", () => {
    const r = buildReceipt({ bill, items, payments: [], tableLabel: "T", orderPlacedAt: new Date() });
    expect(r.subtotalRupees).toBe(397);
    expect(r.discountRupees).toBe(20);
    expect(r.serviceChargeRupees).toBe(5);
    expect(r.gstRupees).toBe(19.85);
    expect(r.totalRupees).toBe(401.85);
    expect(r.status).toBe("unpaid");
    expect(r.paidAt).toBeNull();
  });

  it("reports partial then paid status with method, reference and timestamp", () => {
    const first = new Date("2026-10-18T10:05:00Z");
    const second = new Date("2026-10-18T10:07:00Z");

    const partial = buildReceipt({
      bill,
      items,
      payments: [{ method: "cash", amountPaise: 10000, transactionId: null, createdAt: first }],
      tableLabel: "T",
      orderPlacedAt: first,
    });
    expect(partial.status).toBe("partial");
    expect(partial.paidRupees).toBe(100);

    const paid = buildReceipt({
      bill: { ...bill, paidAt: second, paymentMethod: "qr" },
      items,
      payments: [
        { method: "qr", amountPaise: 30185, transactionId: "UTR123456", createdAt: second },
        { method: "cash", amountPaise: 10000, transactionId: null, createdAt: first },
      ],
      tableLabel: "T",
      orderPlacedAt: first,
    });
    expect(paid.status).toBe("paid");
    expect(paid.paidRupees).toBe(401.85);
    expect(paid.paymentMethod).toBe("qr");
    expect(paid.paymentReference).toBe("UTR123456");
    expect(paid.paidAt).toBe(second.getTime());
    // payments are returned oldest first
    expect(paid.payments.map((p) => p.method)).toEqual(["cash", "qr"]);
  });
});
