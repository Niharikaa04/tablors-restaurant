import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPotsPinVerified } from "@/server/modules/auth/pots-session";

const NAV = [
  ["Pots", "/owner/pots"], ["Salary", "/owner/pots/salary"], ["Suppliers", "/owner/pots/suppliers"], ["GST", "/owner/pots/gst"],
  ["Profit", "/owner/pots/profit"], ["Approvals", "/owner/pots/approvals"], ["Transactions", "/owner/pots/transactions"],
  ["Rules", "/owner/pots/rules"], ["Loyalty", "/owner/pots/loyalty"], ["Reports", "/owner/pots/reports"], ["Team", "/owner/pots/team"],
] as const;

/** Server-side PIN gate for every route under /owner/pots, plus the section navigation and the sandbox label. */
export default async function PotsLayout({ children }: { children: ReactNode }) {
  if (!(await getPotsPinVerified())) redirect("/owner/pots-pin");
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2 text-xs">
        {NAV.map(([label, href]) => <Link key={href} href={href} className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300 transition-colors hover:border-zinc-600">{label}</Link>)}
      </nav>
      <p className="rounded-lg border border-amber-900/50 px-3 py-1.5 text-xs text-amber-400">Prototype mode — payments and payouts are simulated. No real money moves.</p>
      {children}
    </div>
  );
}
