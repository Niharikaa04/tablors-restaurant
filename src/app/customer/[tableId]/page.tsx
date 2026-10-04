import { getMenu, getTableById, getBillByOrderId, getOrder } from "@/server/modules/demo-store/store";
import { getFeedbackByOrderId } from "@/server/modules/feedback/store";
import { TableBanner } from "@/components/customer/table-banner";
import { TableNotFound } from "@/components/customer/table-not-found";
import { CartProvider } from "@/components/customer/cart-context";
import { OrderCompletedPanel } from "@/components/customer/order-completed-panel";
import { TablorDevice } from "@/components/customer/tablor-device";

export default async function CustomerTableMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { tableId } = await params;
  const { order: trackedOrderId } = await searchParams;
  const table = getTableById(tableId);

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
    const trackedOrder = getOrder(trackedOrderId);

    if (trackedOrder && trackedOrder.tableId === tableId) {
      const bill = getBillByOrderId(trackedOrderId);
      const isPaid = Boolean(bill?.paymentMethod && bill?.paidAt);

      if (isPaid) {
        const feedback = getFeedbackByOrderId(trackedOrderId);

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

  const menu = getMenu();

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