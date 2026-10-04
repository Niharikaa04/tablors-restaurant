"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDemoRole } from "@/server/modules/auth/session";
import {
  createRestaurantTable,
  removeRestaurantTable,
} from "@/server/modules/demo-store/store";

export async function createTableAction(
  formData: FormData
): Promise<void> {
  const role = await getDemoRole();

  // Only the restaurant owner can create tables.
  if (role !== "owner") {
    return;
  }

  const value = formData.get("label");

  const label =
    typeof value === "string"
      ? value.trim()
      : "";

  const result =
    createRestaurantTable(label);

  if (!result.ok) {
    return;
  }

  revalidatePath("/owner/tables");
  revalidatePath("/owner");
}

export async function removeTableAction(
  formData: FormData
): Promise<void> {
  const role = await getDemoRole();

  // Only the restaurant owner can remove tables.
  if (role !== "owner") {
    return;
  }

  const value = formData.get("tableId");

  const tableId =
    typeof value === "string"
      ? value.trim()
      : "";

  if (!tableId) {
    return;
  }

  const result = removeRestaurantTable(tableId);

  if (!result.ok) {
    return;
  }

  revalidatePath("/owner/tables");
  revalidatePath("/owner");

  // redirect() throws internally, so it must be the last statement.
  redirect("/owner/tables");
}