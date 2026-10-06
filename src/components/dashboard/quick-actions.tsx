import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Grid,
  Smartphone,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const actions: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/owner/orders", label: "Orders", icon: ClipboardList },
  { href: "/owner/tables", label: "Tables", icon: Grid },
  { href: "/owner/billing", label: "Billing", icon: CreditCard },
  { href: "/owner/devices", label: "Devices", icon: Smartphone },
  { href: "/owner/reports", label: "Reports", icon: BarChart3 },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-3.5 py-2 text-xs font-medium text-[var(--ov-text-secondary)] transition-colors hover:border-[var(--ov-accent)]/40 hover:text-[var(--ov-text)]"
        >
          <action.icon className="h-3.5 w-3.5" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
