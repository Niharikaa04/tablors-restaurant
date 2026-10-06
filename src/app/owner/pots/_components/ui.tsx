import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export const inputCls = "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--radium-green)]";
export const labelCls = "block text-xs font-medium uppercase tracking-wider text-zinc-400";
export const btnCls = "rounded-lg border border-[var(--radium-green)]/40 px-3 py-2 text-sm font-medium text-[var(--radium-green)] transition-colors hover:bg-[var(--radium-green)]/10";
export const btnMuted = "rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700";
export const cardCls = "rounded-xl border border-zinc-800 bg-zinc-950 p-5";

export function Back({ href = "/owner/pots", label = "Back to Pots" }: { href?: string; label?: string }) {
  return <Link href={href} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"><ArrowLeft className="h-4 w-4" /> {label}</Link>;
}
export function Header({ title, sub }: { title: string; sub?: string }) {
  return <div><h1 className="text-2xl font-bold tracking-tight text-zinc-100">{title}</h1>{sub ? <p className="mt-1 text-sm text-zinc-400">{sub}</p> : null}</div>;
}
/** Shows the result of the last server action. "error:<msg>" is red, anything else green. */
export function Notice({ code }: { code?: string }) {
  if (!code) return null;
  const err = code.startsWith("error:");
  return <p className={`rounded-lg border px-3 py-2 text-sm ${err ? "border-red-900 text-red-400" : "border-zinc-800 text-[var(--radium-green)]"}`}>{err ? code.slice(6) : code === "done" ? "Done." : code}</p>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1"><span className={labelCls}>{label}</span>{children}</label>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className={cardCls}><h2 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h2>{children}</section>;
}
export const SANDBOX = "Sandbox: payments and payouts are simulated. No real money moves.";
export const when = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
export const statusCls = (s: string) => s === "SUCCESS" || s === "COMPLETED" || s === "PAID" ? "text-[var(--radium-green)]" : s === "FAILED" || s === "PARTIALLY_FAILED" || s === "CANCELLED" ? "text-red-400" : "text-amber-400";
