import { requirePermission } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import { saveSettingsAction } from "./actions";

const input =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500/60";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-white/60">{label}</span>
      {children}
    </label>
  );
}

function Check({
  name,
  label,
  on,
}: {
  name: string;
  label: string;
  on: boolean;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-white">
      <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function OwnerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requirePermission("settings");
  const { saved, error } = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (await getSettings(session.restaurantId)) as any;

  const printer = s.printer ?? {};
  const kitchen = s.kitchen ?? {};
  const payment = s.payment ?? {};

  return (
    <form action={saveSettingsAction} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/60">
          Your restaurant details and configuration
        </p>
      </div>

      {saved && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          Settings saved.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Section title="Restaurant">
        <Field label="Restaurant name">
          <input name="name" defaultValue={s.name ?? ""} required className={input} />
        </Field>

        <Field label="Logo (PNG, JPG or WebP, max 200 KB)">
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={input}
          />
        </Field>

        {s.logoDataUrl && (
          <div className="flex items-center gap-4 md:col-span-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.logoDataUrl}
              alt="Current logo"
              className="h-14 w-auto rounded-md border border-white/10 bg-black/40 p-1"
            />
            <Check name="removeLogo" label="Remove current logo" on={false} />
          </div>
        )}

        <Field label="Address">
          <input name="address" defaultValue={s.address ?? ""} className={input} />
        </Field>
        <Field label="GST number">
          <input
            name="gstNumber"
            defaultValue={s.gstNumber ?? ""}
            placeholder="22AAAAA0000A1Z5"
            className={input}
          />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={s.phone ?? ""} className={input} />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            defaultValue={s.email ?? ""}
            className={input}
          />
        </Field>
        <Field label="Opening hours">
          <input
            name="openingTime"
            type="time"
            defaultValue={s.openingTime ?? "10:00"}
            required
            className={input}
          />
        </Field>
        <Field label="Closing hours">
          <input
            name="closingTime"
            type="time"
            defaultValue={s.closingTime ?? "23:00"}
            required
            className={input}
          />
        </Field>
      </Section>

      <Section title="Tax, currency and language">
        <Field label="GST rate (%)">
          <input
            name="gstRatePercent"
            type="number"
            step="0.01"
            min={0}
            max={50}
            defaultValue={s.gstRatePercent ?? 5}
            className={input}
          />
        </Field>
        <Field label="Service charge (%)">
          <input
            name="serviceChargePercent"
            type="number"
            step="0.01"
            min={0}
            max={30}
            defaultValue={s.serviceChargePercent ?? 0}
            className={input}
          />
        </Field>
        <Field label="Currency">
          <select name="currency" defaultValue={s.currency ?? "INR"} className={input}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AED">AED</option>
          </select>
        </Field>
        <Field label="Language">
          <select name="language" defaultValue={s.language ?? "en"} className={input}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="te">Telugu</option>
          </select>
        </Field>
        <Check
          name="pricesIncludeTax"
          label="Menu prices already include tax"
          on={Boolean(s.pricesIncludeTax)}
        />
      </Section>

      <Section title="Printer">
        <Check name="printerEnabled" label="Enable printer" on={Boolean(printer.enabled)} />
        <Field label="Paper width">
          <select
            name="printerPaperWidthMm"
            defaultValue={String(printer.paperWidthMm ?? 80)}
            className={input}
          >
            <option value="58">58 mm</option>
            <option value="80">80 mm</option>
          </select>
        </Field>
        <Check
          name="autoPrintOnPayment"
          label="Auto-print bill when payment is received"
          on={Boolean(printer.autoPrintOnPayment)}
        />
      </Section>

      <Section title="Kitchen">
        <Field label="Default prep time (minutes)">
          <input
            name="defaultPrepMinutes"
            type="number"
            min={1}
            max={180}
            defaultValue={kitchen.defaultPrepMinutes ?? 15}
            className={input}
          />
        </Field>
        <div className="space-y-3">
          <Check
            name="autoAcceptOrders"
            label="Auto-accept new orders"
            on={Boolean(kitchen.autoAcceptOrders)}
          />
          <Check
            name="soundAlerts"
            label="Sound alerts for new orders"
            on={kitchen.soundAlerts ?? true}
          />
        </div>
      </Section>

      <Section title="Payment">
        <Check name="paymentCash" label="Accept cash" on={payment.cash ?? true} />
        <Check name="paymentQr" label="Accept QR / UPI" on={payment.qr ?? true} />
      </Section>

      <button
        type="submit"
        className="rounded-lg bg-yellow-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-yellow-400"
      >
        Save settings
      </button>
    </form>
  );
}