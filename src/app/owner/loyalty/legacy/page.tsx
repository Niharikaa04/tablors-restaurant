import { requirePermission } from "@/server/modules/auth/session";
import { LiveRefresh } from "@/components/live/live-refresh";
import {
  describeOffer,
  getRupeesPerPoint,
  isLive,
  listMembers,
  listMessages,
  listOffers,
  maskPhone,
  todayISO,
} from "@/server/modules/loyalty/store";
import {
  addTestVisitAction,
  createOfferAction,
  sendOfferAction,
  toggleOfferAction,
} from "../actions";

const input =
  "h-11 w-full rounded-lg border border-zinc-700 bg-black px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#d7fe3b]";
const button =
  "h-11 rounded-lg bg-[#d7fe3b] px-5 text-sm font-semibold text-black transition hover:opacity-90";
const card = "rounded-xl border border-zinc-800 bg-zinc-950 p-5";

function noticeText(code: string | undefined): { ok: boolean; text: string } | null {
  if (!code) return null;
  if (code.startsWith("queued-")) {
    const n = Number(code.slice(7));
    return {
      ok: true,
      text:
        n > 0
          ? `${n} message${n === 1 ? "" : "s"} queued (demo, not actually sent).`
          : "No new messages: no members who agreed to offers, or already queued.",
    };
  }
  const map: Record<string, { ok: boolean; text: string }> = {
    "offer-created": { ok: true, text: "Offer created." },
    "visit-added": { ok: true, text: "Visit recorded." },
    "invalid-offer": {
      ok: false,
      text: "Check the offer: title, value (percent max 100) and dates.",
    },
    "invalid-phone": { ok: false, text: "Enter a valid 10-digit mobile number." },
    denied: { ok: false, text: "You don't have access to loyalty." },
  };
  return map[code] ?? null;
}

export default async function LoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const session = await requirePermission("loyalty");
  const { notice: raw } = await searchParams;
  const notice = noticeText(Array.isArray(raw) ? raw[0] : raw);

  const rid = session.restaurantId;
  const members = await listMembers(rid);
  const offers = await listOffers(rid);
  const messages = await listMessages(rid);
  const today = todayISO();
  const rupeesPerPoint = await getRupeesPerPoint(rid);

  return (
    <div className="space-y-8">
      <LiveRefresh intervalMs={10000} />
      <div>
        <h1 className="text-3xl font-medium tracking-tight text-zinc-50">Loyalty</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Members are added by mobile number. Earn 1 point per ₹{rupeesPerPoint} spent.
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.ok
              ? "border-[#d7fe3b]/40 bg-[#d7fe3b]/5 text-[#d7fe3b]"
              : "border-red-500/40 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ["Members", members.length],
          ["Agreed to offers", members.filter((m) => m.consent).length],
          ["Live offers", offers.filter((o) => isLive(o, today)).length],
          ["Points issued", members.reduce((s, m) => s + m.points, 0)],
        ].map(([label, value]) => (
          <div key={label} className={card}>
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-medium text-zinc-50">{value}</p>
          </div>
        ))}
      </div>

      {/* Offers */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium text-zinc-50">Offers</h2>

        <form action={createOfferAction} className={`${card} grid gap-3 sm:grid-cols-6`}>
          <input name="title" required placeholder="Offer title" className={`${input} sm:col-span-3`} />
          <select name="kind" className={`${input} sm:col-span-1`} defaultValue="percent">
            <option value="percent">% off</option>
            <option value="fixed">₹ off</option>
          </select>
          <input name="value" type="number" min={1} required placeholder="Value" className={`${input} sm:col-span-1`} />
          <input name="minBillRupees" type="number" min={0} defaultValue={0} placeholder="Min bill ₹" className={`${input} sm:col-span-1`} />
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Starts
            <input name="startsOn" type="date" required defaultValue={today} className={`${input} mt-1`} />
          </label>
          <label className="text-xs text-zinc-400 sm:col-span-2">
            Ends
            <input name="endsOn" type="date" required defaultValue={today} className={`${input} mt-1`} />
          </label>
          <div className="flex items-end sm:col-span-2">
            <button type="submit" className={`${button} w-full`}>Create offer</button>
          </div>
        </form>

        {offers.length === 0 ? (
          <p className="text-sm text-zinc-500">No offers yet.</p>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => (
              <div key={o.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
                <div>
                  <p className="font-medium text-zinc-100">{o.title}</p>
                  <p className="text-xs text-zinc-400">
                    {describeOffer(o)} · {o.startsOn} to {o.endsOn} ·{" "}
                    <span className={isLive(o, today) ? "text-[#d7fe3b]" : "text-zinc-500"}>
                      {isLive(o, today) ? "Live" : o.active ? "Not in date range" : "Paused"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={sendOfferAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button type="submit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-[#d7fe3b] hover:text-[#d7fe3b]">
                      Message members
                    </button>
                  </form>
                  <form action={toggleOfferAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="active" value={String(!o.active)} />
                    <button type="submit" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-[#d7fe3b] hover:text-[#d7fe3b]">
                      {o.active ? "Pause" : "Resume"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium text-zinc-50">Members</h2>

        <form action={addTestVisitAction} className={`${card} grid gap-3 sm:grid-cols-6`}>
          <input name="phone" required placeholder="Mobile number" className={`${input} sm:col-span-2`} />
          <input name="total" type="number" min={0} required placeholder="Order total ₹" className={`${input} sm:col-span-2`} />
          <label className="flex items-center gap-2 text-xs text-zinc-300 sm:col-span-1">
            <input name="consent" type="checkbox" /> Agrees to offers
          </label>
          <button type="submit" className={`${button} sm:col-span-1`}>Add visit</button>
          <p className="text-xs text-zinc-500 sm:col-span-6">
            Test form. Once the customer screen is connected, visits are added automatically.
          </p>
        </form>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Visits</th>
                <th className="px-4 py-3 font-medium">Spend</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Offers</th>
                <th className="px-4 py-3 font-medium">Last visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No members yet.
                  </td>
                </tr>
              )}
              {members.map((m) => (
                <tr key={m.phone}>
                  <td className="px-4 py-3 text-zinc-100">{maskPhone(m.phone)}</td>
                  <td className="px-4 py-3 text-zinc-300">{m.visits}</td>
                  <td className="px-4 py-3 text-zinc-300">₹{m.totalSpendRupees.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-zinc-300">{m.points}</td>
                  <td className="px-4 py-3 text-zinc-300">{m.consent ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(m.lastVisitAt).toLocaleDateString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Messages */}
      <section className="space-y-4">
        <h2 className="text-xl font-medium text-zinc-50">Messages</h2>
        <p className="text-xs text-zinc-500">
          No SMS or WhatsApp provider is connected, so messages are only queued here, not sent.
        </p>
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages yet.</p>
        ) : (
          <div className="space-y-2">
            {messages.slice(0, 20).map((m) => (
              <div key={m.id} className={card}>
                <p className="text-xs text-zinc-400">
                  To {maskPhone(m.phone)} · Queued (demo, not sent)
                </p>
                <p className="mt-1 text-sm text-zinc-200">{m.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}