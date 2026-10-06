import { getPotsRuntime } from "@/server/modules/pots/runtime";
import { ACTION_LABEL, BASE_PERMISSIONS, can, type Action } from "@/server/modules/pots/permissions";
import { formatINR } from "@/server/modules/pots/money";
import type { ActorRole } from "@/server/modules/pots/support";
import { Back, Header, Section } from "../_components/ui";

export const dynamic = "force-dynamic";
const ROLES = Object.keys(BASE_PERMISSIONS) as ActorRole[];

export default function TeamPage() {
  const lim = getPotsRuntime().payouts.limits;
  const actions = Object.keys(ACTION_LABEL) as Action[];
  return (
    <div className="space-y-6">
      <Back /><Header title="Team & permissions" sub="What each role can do by default, and the limits and approvals that protect payouts." />
      <Section title="Roles">
        <div className="overflow-x-auto"><table className="w-full text-left text-xs text-zinc-400">
          <thead className="text-zinc-500"><tr><th className="py-2">Action</th>{ROLES.map((r) => <th key={r} className="text-center">{r}</th>)}</tr></thead>
          <tbody>{actions.map((a) => <tr key={a} className="border-t border-zinc-900"><td className="py-2 text-zinc-300">{ACTION_LABEL[a]}</td>{ROLES.map((r) => <td key={r} className="text-center">{can(r, a) ? "✓" : "—"}</td>)}</tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-zinc-500">Staff can only see their own salary / payment status.</p>
      </Section>
      <Section title="Limits & approvals">
        <ul className="space-y-1 text-sm text-zinc-300">
          <li>Step-up required for payouts at or above {formatINR(lim.highRiskThreshold)}</li>
          <li>Profit withdrawals, rule changes, salary batches, bank-destination changes and refunds above the threshold always need step-up</li>
          <li>Per-transaction limit {formatINR(lim.perTransactionLimit)} · daily limit {formatINR(lim.dailyLimit)}</li>
          <li>Second approver (maker-checker): {lim.requireSecondApproval ? "on" : "off"}</li>
        </ul>
      </Section>
    </div>
  );
}
