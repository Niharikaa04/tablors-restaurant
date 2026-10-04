"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { RestaurantSettings } from "@/server/modules/demo-store/settings";
import { saveSettingsAction } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d7fe3b] focus:outline-none";
const card = "space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-xs text-zinc-400 ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-200">
      <input type="checkbox" className="h-4 w-4 accent-[#d7fe3b]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function SettingsForm({ initial }: { initial: RestaurantSettings }) {
  const [s, setS] = useState<RestaurantSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof RestaurantSettings>(k: K, v: RestaurantSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 200_000) return setMsg({ ok: false, text: "Logo must be under 200 KB." });
    const r = new FileReader();
    r.onload = () => set("logoDataUrl", String(r.result));
    r.readAsDataURL(file);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveSettingsAction(s);
      setMsg(res.ok ? { ok: true, text: "Settings saved." } : { ok: false, text: res.error });
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Restaurant Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Business details, tax, printers, kitchen and payments.</p>
      </div>

      <Section title="Restaurant profile">
        <Field label="Restaurant name"><input className={input} value={s.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Logo (PNG/JPG/WebP, max 200 KB)">
          <div className="flex items-center gap-3">
            {s.logoDataUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.logoDataUrl} alt="Logo" className="h-10 w-10 rounded object-cover" />}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} className="text-xs text-zinc-400" />
            {s.logoDataUrl && <button type="button" onClick={() => set("logoDataUrl", null)} className="text-xs text-zinc-500 hover:text-red-400">Remove</button>}
          </div>
        </Field>
        <Field label="Address" wide><textarea rows={2} className={input} value={s.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="GST number"><input className={input} placeholder="22AAAAA0000A1Z5" value={s.gstNumber} onChange={(e) => set("gstNumber", e.target.value.toUpperCase())} /></Field>
        <Field label="Phone"><input className={input} value={s.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email"><input type="email" className={input} value={s.email} onChange={(e) => set("email", e.target.value)} /></Field>
      </Section>

      <Section title="Hours">
        <Field label="Opening time"><input type="time" className={input} value={s.openingTime} onChange={(e) => set("openingTime", e.target.value)} /></Field>
        <Field label="Closing time"><input type="time" className={input} value={s.closingTime} onChange={(e) => set("closingTime", e.target.value)} /></Field>
      </Section>

      <Section title="Tax, currency & language">
        <Field label="GST rate (%)"><input type="number" min={0} max={50} step="0.5" className={input} value={s.gstRatePercent} onChange={(e) => set("gstRatePercent", Number(e.target.value))} /></Field>
        <Field label="Service charge (%)"><input type="number" min={0} max={30} step="0.5" className={input} value={s.serviceChargePercent} onChange={(e) => set("serviceChargePercent", Number(e.target.value))} /></Field>
        <Field label="Currency">
          <select className={input} value={s.currency} onChange={(e) => set("currency", e.target.value as RestaurantSettings["currency"])}>
            {["INR", "USD", "EUR", "GBP", "AED"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Language">
          <select className={input} value={s.language} onChange={(e) => set("language", e.target.value as RestaurantSettings["language"])}>
            <option value="en">English</option><option value="hi">हिन्दी</option><option value="te">తెలుగు</option>
          </select>
        </Field>
        <Toggle label="Menu prices already include tax" checked={s.pricesIncludeTax} onChange={(v) => set("pricesIncludeTax", v)} />
      </Section>

      <Section title="Printer settings">
        <Toggle label="Enable bill printer" checked={s.printer.enabled} onChange={(v) => set("printer", { ...s.printer, enabled: v })} />
        <Toggle label="Auto-print bill after payment" checked={s.printer.autoPrintOnPayment} onChange={(v) => set("printer", { ...s.printer, autoPrintOnPayment: v })} />
        <Field label="Paper width">
          <select className={input} value={s.printer.paperWidthMm} onChange={(e) => set("printer", { ...s.printer, paperWidthMm: Number(e.target.value) as 58 | 80 })}>
            <option value={58}>58 mm</option><option value={80}>80 mm</option>
          </select>
        </Field>
      </Section>

      <Section title="Kitchen settings">
        <Toggle label="Auto-accept new orders" checked={s.kitchen.autoAcceptOrders} onChange={(v) => set("kitchen", { ...s.kitchen, autoAcceptOrders: v })} />
        <Toggle label="Sound alerts for new orders" checked={s.kitchen.soundAlerts} onChange={(v) => set("kitchen", { ...s.kitchen, soundAlerts: v })} />
        <Field label="Default prep time (minutes)"><input type="number" min={1} max={180} className={input} value={s.kitchen.defaultPrepMinutes} onChange={(e) => set("kitchen", { ...s.kitchen, defaultPrepMinutes: Number(e.target.value) })} /></Field>
      </Section>

      <Section title="Payment settings">
        <Toggle label="Cash" checked={s.payment.cash} onChange={(v) => set("payment", { ...s.payment, cash: v })} />
        <Toggle label="UPI" checked={s.payment.upi} onChange={(v) => set("payment", { ...s.payment, upi: v })} />
        <Toggle label="Card" checked={s.payment.card} onChange={(v) => set("payment", { ...s.payment, card: v })} />
        <Field label="UPI ID"><input className={input} placeholder="restaurant@bank" value={s.payment.upiId} onChange={(e) => set("payment", { ...s.payment, upiId: e.target.value })} /></Field>
      </Section>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-[#d7fe3b]/30 bg-[#d7fe3b]/10 text-[#d7fe3b]" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{msg.text}</p>
      )}
      <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-[#d7fe3b] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
