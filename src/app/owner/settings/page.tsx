import { requirePermission } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";

function labelFromKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export default async function OwnerSettingsPage() {
  const session = await requirePermission("overview");
  const settings = await getSettings(session.restaurantId);

  // Show every simple value (text, number, yes/no) that exists in settings,
  // so this page works without me needing to know your exact field names.
  const rows = Object.entries(settings).filter(([, value]) =>
    ["string", "number", "boolean"].includes(typeof value),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/60">
          Your restaurant details and configuration
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Restaurant</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-white/60">No settings found yet.</p>
        ) : (
          <dl className="divide-y divide-white/10">
            {rows.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-3"
              >
                <dt className="text-sm text-white/60">{labelFromKey(key)}</dt>
                <dd className="text-sm font-medium text-white">
                  {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}