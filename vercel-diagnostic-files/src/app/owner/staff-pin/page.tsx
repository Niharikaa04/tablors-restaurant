import { requirePermission } from "@/server/modules/auth/session";
import { StaffPinForm } from "./staff-pin-form";

export default async function StaffPinPage() {
  await requirePermission("staff");
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <StaffPinForm />
    </div>
  );
}