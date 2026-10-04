import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { getDevices, getMenu, getTodayOverview } from "@/server/modules/demo-store/store";

export function AttentionPanel() {
  const overview = getTodayOverview();
  const unavailableCount = getMenu().filter((m) => !m.available).length;
  const offlineCount = getDevices().filter((d) => !d.online).length;

  const items = [
    overview.newOrders > 0 && {
      key: "new-orders",
      text: `${overview.newOrders} new order${overview.newOrders === 1 ? "" : "s"} waiting`,
      href: "/owner/orders",
      cta: "View orders",
    },
    overview.readyOrders > 0 && {
      key: "ready-orders",
      text: `${overview.readyOrders} order${overview.readyOrders === 1 ? "" : "s"} ready for service`,
      href: "/owner/orders",
      cta: "View orders",
    },
    offlineCount > 0 && {
      key: "devices-offline",
      text: `${offlineCount} device${offlineCount === 1 ? "" : "s"} offline`,
      href: "/owner/devices",
      cta: "Check device",
    },
    unavailableCount > 0 && {
      key: "items-unavailable",
      text: `${unavailableCount} menu item${unavailableCount === 1 ? "" : "s"} unavailable`,
      href: "/owner/menu",
      cta: "Manage menu",
    },
  ].filter(Boolean) as { key: string; text: string; href: string; cta: string }[];

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] px-5 py-4">
        <span
          className="h-2 w-2 rounded-full bg-[var(--ov-accent)]"
          style={{ boxShadow: "0 0 8px var(--ov-accent)" }}
        />
        <p className="text-sm text-[var(--ov-text-secondary)]">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--ov-gold)]/25 bg-[var(--ov-surface)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ov-text)]">
        <AlertCircle className="h-4 w-4 text-[var(--ov-gold)]" />
        Needs your attention
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group flex items-center justify-between gap-2 rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-3.5 py-2.5 text-xs text-[var(--ov-text-secondary)] transition-colors hover:border-[var(--ov-gold)]/40 hover:text-[var(--ov-text)]"
          >
            {item.text}
            <span className="flex shrink-0 items-center gap-1 text-[var(--ov-gold)]">
              {item.cta}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
