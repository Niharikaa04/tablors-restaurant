/**
 * Pure receipt maths. No database or server-only imports, so it is unit-tested
 * directly. Money is integer paise internally; rupees are derived at the edge.
 * Every figure comes from stored order_items / bills / payments rows, never from
 * anything the browser sends.
 */

export type ReceiptItemRow = {
  code: string;
  nameSnapshot: string;
  qty: number;
  pricePaise: number;
};

export type ReceiptBillRow = {
  id: string;
  orderId: string;
  subtotalPaise: number;
  gstPaise: number;
  discountPaise: number;
  serviceChargePaise: number;
  totalPaise: number;
  paidAt: Date | null;
  paymentMethod: "cash" | "qr" | null;
};

export type ReceiptPaymentRow = {
  method: "cash" | "qr";
  amountPaise: number;
  transactionId: string | null;
  createdAt: Date;
};

export type ReceiptLine = {
  code: string;
  name: string;
  qty: number;
  unitRupees: number;
  lineRupees: number;
};

export type BillReceipt = {
  billId: string;
  orderId: string;
  tableLabel: string;
  orderPlacedAt: number;
  lines: ReceiptLine[];
  itemCount: number;
  subtotalRupees: number;
  discountRupees: number;
  serviceChargeRupees: number;
  gstRupees: number;
  totalRupees: number;
  paidRupees: number;
  status: "unpaid" | "partial" | "paid";
  paymentMethod: "cash" | "qr" | null;
  paymentReference: string | null;
  paidAt: number | null;
  payments: {
    method: "cash" | "qr";
    amountRupees: number;
    reference: string | null;
    paidAt: number;
  }[];
};

const rupees = (paise: number): number => paise / 100;

export function buildReceipt(input: {
  bill: ReceiptBillRow;
  items: ReceiptItemRow[];
  payments: ReceiptPaymentRow[];
  tableLabel: string;
  orderPlacedAt: Date;
}): BillReceipt {
  const { bill } = input;

  const lines: ReceiptLine[] = input.items.map((item) => ({
    code: item.code,
    name: item.nameSnapshot,
    qty: item.qty,
    unitRupees: rupees(item.pricePaise),
    // qty * paise in integers, then converted: no floating-point drift.
    lineRupees: rupees(item.qty * item.pricePaise),
  }));

  const paidPaise = input.payments.reduce((sum, p) => sum + p.amountPaise, 0);
  const sorted = [...input.payments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  const last = sorted[sorted.length - 1] ?? null;

  const status: BillReceipt["status"] =
    bill.paidAt !== null ? "paid" : paidPaise > 0 ? "partial" : "unpaid";

  return {
    billId: bill.id,
    orderId: bill.orderId,
    tableLabel: input.tableLabel,
    orderPlacedAt: input.orderPlacedAt.getTime(),
    lines,
    itemCount: lines.reduce((sum, l) => sum + l.qty, 0),
    subtotalRupees: rupees(bill.subtotalPaise),
    discountRupees: rupees(bill.discountPaise),
    serviceChargeRupees: rupees(bill.serviceChargePaise),
    gstRupees: rupees(bill.gstPaise),
    totalRupees: rupees(bill.totalPaise),
    paidRupees: rupees(paidPaise),
    status,
    paymentMethod: bill.paymentMethod,
    paymentReference: last?.transactionId ?? null,
    paidAt: bill.paidAt ? bill.paidAt.getTime() : null,
    payments: sorted.map((p) => ({
      method: p.method,
      amountRupees: rupees(p.amountPaise),
      reference: p.transactionId,
      paidAt: p.createdAt.getTime(),
    })),
  };
}
