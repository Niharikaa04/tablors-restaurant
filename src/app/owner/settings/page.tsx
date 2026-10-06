import { requirePermission } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await requirePermission("settings");
  return <SettingsForm initial={getSettings(session.restaurantId)} />;
}
