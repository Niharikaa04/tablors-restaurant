import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getBillByOrderIdDb } from "@/server/modules/billing/db-billing";
import { getMenuDb } from "@/server/modules/data/menu-db";
import { getTableByIdDb } from "@/server/modules/data/tables-db";
import { getOrderFromDb } from "@/server/modules/orders/db-orders";
import { getFeedbackByOrderId } from "@/server/modules/feedback/store";
import { TableBanner } from "@/components/customer/table-banner";
import { TableNotFound } from "@/components/customer/table-not-found";
import { CartProvider } from "@/components/customer/cart-context";
import { OrderCompletedPanel } from "@/components/customer/order-completed-panel";
import { TablorDevice } from "@/components/customer/tablor-device";

export const dynamic = "force-dynamic";

export default async function CustomerTableMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { tableId } = await params;
  const { order: trackedOrderId } = await searchParams;
  // Table and menu don't depend on each other: fetch together.
  const [table, menu] = await Promise.all([
    getTableByIdDb(DEMO_RESTAURANT_ID, tableId),
    getMenuDb(DEMO_RESTAURANT_ID),
  ]);

  if (!table) {
    return (
      <div>
        <TableNotFound tableId={tableId} />
      </div>
    );
  }

  // If the customer is currently tracking a specific order (set via the
  // ?order= param right after placing it), check THAT exact order's bill —
  // never the table's "current" order, since the same table can be reused
  // by a different customer once this one is paid up.
  if (trackedOrderId) {
    const trackedOrder = await getOrderFromDb(DEMO_RESTAURANT_ID, trackedOrderId);

    if (trackedOrder && trackedOrder.tableId === tableId) {
      const bill = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, trackedOrderId);
      const isPaid = Boolean(bill?.paymentMethod && bill?.paidAt);

      if (isPaid) {
        const feedback = await getFeedbackByOrderId(trackedOrderId);

        return (
          <div>
            <TableBanner table={table} />
            <div className="mt-6">
              <OrderCompletedPanel
                orderId={trackedOrderId}
                tableId={tableId}
                feedbackSubmitted={Boolean(feedback)}
              />
            </div>
          </div>
        );
      }
    }
  }

  return (
    <CartProvider>
      <div>
        <TableBanner table={table} />

        <div className="mt-4">
          <TablorDevice
            tableId={table.id}
            tableLabel={table.label.replace(/[^0-9]/g, "") || table.label}
            items={menu}
            initialTrackedOrderId={trackedOrderId ?? null}
          />
        </div>
      </div>
    </CartProvider>
  );
}