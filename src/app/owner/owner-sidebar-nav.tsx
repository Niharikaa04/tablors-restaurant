"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Grid,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Smartphone,
  Star,
  Tag,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  {
    href: "/owner",
    label: "Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/owner/menu",
    label: "Menu",
    icon: UtensilsCrossed,
  },
  {
    href: "/owner/tables",
    label: "Tables",
    icon: Grid,
  },
  {
    href: "/owner/orders",
    label: "Orders",
    icon: ClipboardList,
  },
  {
    href: "/owner/billing",
    label: "Billing",
    icon: CreditCard,
  },
  {
    href: "/owner/pots",
    label: "Financial pots",
    icon: Wallet,
  },
  {
    href: "/owner/devices",
    label: "Devices",
    icon: Smartphone,
  },
  {
    href: "/owner/reservations",
    label: "Reservations",
    icon: CalendarDays,
  },
  {
    href: "/owner/notifications",
    label: "Notifications",
    icon: Bell,
  },
  {
    href: "/owner/offers",
    label: "Offers & Promotions",
    icon: Tag,
  },
  {
    href: "/owner/staff",
    label: "Staff",
    icon: Users,
  },
  {
    href: "/owner/reports",
    label: "Reports",
    icon: BarChart3,
  },
  {
    href: "/owner/feedback",
    label: "Feedback",
    icon: Star,
  },
  {
    href: "/owner/support",
    label: "Support",
    icon: LifeBuoy,
  },
  {
    href: "/owner/subscription",
    label: "Subscription",
    icon: CreditCard,
  },
  {
    href: "/owner/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function OwnerSidebarNav({
  allowedHrefs,
}: {
  allowedHrefs?: string[];
}) {
  const pathname = usePathname();

  const visibleItems = allowedHrefs
    ? navItems.filter((item) => allowedHrefs.includes(item.href))
    : navItems;

  return (
    <nav className="mt-6 flex gap-1 overflow-x-auto pb-2 scrollbar-none md:flex-col md:overflow-x-visible md:pb-0">
      {visibleItems.map((item) => {
        const Icon = item.icon;

        const isActive =
          item.href === "/owner"
            ? pathname === "/owner"
            : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`group flex items-center space-x-3 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? "bg-[#d7fe3b]/10 text-[#d7fe3b] shadow-[0_0_16px_-4px_#d7fe3b]"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-[#d7fe3b]"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive
                  ? "text-[#d7fe3b]"
                  : "text-zinc-400 group-hover:text-[#d7fe3b]"
              }`}
            />

            <span>{item.label}</span>

            {isActive && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d7fe3b]"
                style={{
                  boxShadow: "0 0 8px #d7fe3b",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}