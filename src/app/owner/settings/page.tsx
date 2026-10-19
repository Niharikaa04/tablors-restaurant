import { requirePermission } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import { SettingsForm } from "./settings-form";

export default async function OwnerSettingsPage() {
  const session = await requirePermission("settings");
  const settings = await getSettings(session.restaurantId);
  return <SettingsForm initial={settings} />;
}