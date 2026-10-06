import { redirect } from "next/navigation";
import { getDemoRole } from "@/server/modules/auth/session";
import { demoLogout } from "@/server/modules/auth/demo-actions";
import { getLeads, getDevices } from "@/server/modules/demo-store/store";

export default async function AdminPage() {
  const role = await getDemoRole();
  if (role !== "admin") {
    redirect("/login");
  }

  const leads = getLeads();
  const devices = getDevices();

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-[var(--color-text-primary)]">Company admin</h1>
        <form action={demoLogout}>
          <button type="submit" className="text-sm text-[var(--color-text-muted)]">
            Sign out
          </button>
        </form>
      </div>

      <section className="mt-8">
        <h2 className="text-sm text-[var(--color-text-muted)]">
          Demo requests ({leads.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-brand)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-normal">Restaurant</th>
                <th className="px-4 py-3 font-normal">Owner</th>
                <th className="px-4 py-3 font-normal">City</th>
                <th className="px-4 py-3 font-normal">Tables</th>
                <th className="px-4 py-3 font-normal">Type</th>
                <th className="px-4 py-3 font-normal">Contact</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-[var(--color-text-muted)]">
                    No demo requests submitted yet. Try the landing page form.
                  </td>
                </tr>
              )}
              {leads
                .slice()
                .reverse()
                .map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {lead.restaurantName}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.ownerName}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.city || "—"}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{lead.tableCount}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {lead.restaurantType}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {lead.phone}
                        {lead.email ? ` · ${lead.email}` : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm text-[var(--color-text-muted)]">Device registry</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {devices.map((device) => (
            <div
              key={device.id}
              className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
            >
              <p className="text-xs text-[var(--color-text-muted)]">{device.id}</p>
              <p
                className={`mt-1 text-sm ${
                  device.online ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                {device.online ? "Online" : "Offline"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {device.batteryPercent}% battery
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
