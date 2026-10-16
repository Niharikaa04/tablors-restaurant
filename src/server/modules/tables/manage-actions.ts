"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/server/modules/auth/session";
import {
  renameRestaurantTable,
  reserveRestaurantTable,
  setTableStatus,
} from "@/server/modules/demo-store/store";

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);

  return typeof raw === "string" ? raw.trim() : "";
}

function refresh(tableId: string): void {
  revalidatePath("/owner");
  revalidatePath("/owner/tables");
  revalidatePath(`/owner/tables/${tableId}`);
}

/** redirect() throws internally, so call it as the last statement of a branch. */
function back(tableId: string, notice: string): never {
  refresh(tableId);
  redirect(`/owner/tables/${tableId}?notice=${notice}`);
}

export async function renameTableAction(formData: FormData): Promise<void> {
  await requirePermission("tables");

  const tableId = readText(formData, "tableId");

  if (tableId === "") {
    return redirect("/owner/tables");
  }

  const result = renameRestaurantTable(tableId, readText(formData, "label"));

  if (!result.ok) {
    if (result.reason === "not-found") {
      return redirect("/owner/tables");
    }

    return back(
      tableId,
      result.reason === "duplicate-label" ? "rename-duplicate" : "rename-invalid"
    );
  }

  return back(tableId, "renamed");
}

export async function reserveTableAction(formData: FormData): Promise<void> {
  await requirePermission("tables");

  const tableId = readText(formData, "tableId");

  if (tableId === "") {
    return redirect("/owner/tables");
  }

  const result = reserveRestaurantTable(tableId);

  if (!result.ok) {
    if (result.reason === "not-found") {
      return redirect("/owner/tables");
    }

    return back(tableId, "cannot-reserve");
  }

  return back(tableId, "reserved");
}

export async function releaseTableAction(formData: FormData): Promise<void> {
  await requirePermission("tables");

  const tableId = readText(formData, "tableId");

  if (tableId === "") {
    return redirect("/owner/tables");
  }

  const result = setTableStatus(tableId, "available");

  if (!result.ok) {
    if (result.reason === "not-found") {
      return redirect("/owner/tables");
    }

    return back(tableId, "cannot-release");
  }

  return back(tableId, "released");
}