import { requirePermission } from "@/server/modules/auth/session";
import { getDevices } from "@/server/modules/demo-store/store";
import { PLANS, PLAN_ORDER, deviceLimit, getSubscription, monthlyRupees } from "@/server/modules/demo-store/subscription";
import { SubscriptionManager } from "./subscription-manager";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" });

export default async function SubscriptionPage() {
  const session = await requirePermission("subscription");
  const sub = getSubscription(session.restaurantId);

  return (
    <SubscriptionManager
      planId={sub.plan}
      planName={PLANS[sub.plan].name}
      renewalLabel={dateFmt.format(new Date(sub.renewalDate))}
      monthlyRupees={monthlyRupees(sub)}
      devicesUsed={getDevices().length}
      deviceLimit={deviceLimit(sub)}
      plans={PLAN_ORDER.map((id) => ({ id, ...PLANS[id] }))}
      payments={sub.payments.map((p) => ({
        id: p.id,
        invoiceNo: p.invoiceNo,
        dateLabel: dateFmt.format(new Date(p.paidAt)),
        description: p.description,
        amountRupees: p.amountRupees,
        status: p.status,
      }))}
    />
  );
}
