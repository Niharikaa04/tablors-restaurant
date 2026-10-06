"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import {
  deleteMenuItemAction,
  toggleItemAvailability,
} from "@/server/modules/menu/actions";
import { formatRupees, getEffectivePrice } from "@/lib/menu-shared";
import { MenuItemForm } from "./menu-item-form";

type StatusFilter = "all" | "available" | "unavailable";
type DietFilter = "all" | "veg" | "non-veg";

type Notice = { kind: "success" | "error"; text: string };

const selectClass =
  "rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-radium-500)]";

const btnBase =
  "inline-flex items-center gap-1 rounded-[var(--radius-brand)] border border-[var(--color-border)] px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60";
const smallBtn = `${btnBase} text-[var(--color-text-primary)] hover:border-[var(--color-gold-500)]`;
const dangerBtn = `${btnBase} text-[var(--color-text-primary)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]`;

export function MenuManager({
  items,
  usage,
  initialCategory,
}: {
  items: MenuItem[];
  /** MenuItem.id → number of historical order lines that reference it */
  usage: Record<string, number>;
  initialCategory: string | null;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [diet, setDiet] = useState<DietFilter>("all");
  const [specialOnly, setSpecialOnly] = useState(false);

  const [form, setForm] = useState<{ item: MenuItem | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const filtersActive =
    search.trim() !== "" || category !== "all" || status !== "all" || diet !== "all" || specialOnly;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (status === "available" && !item.available) return false;
      if (status === "unavailable" && item.available) return false;
      if (diet === "veg" && !item.veg) return false;
      if (diet === "non-veg" && item.veg) return false;
      if (specialOnly && !item.isSpecial) return false;
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, category, status, diet, specialOnly]);

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setStatus("all");
    setDiet("all");
    setSpecialOnly(false);
  }

  function toggleAvailability(item: MenuItem) {
    setTogglingId(item.id);
    startTransition(async () => {
      const result = await toggleItemAvailability(item.code, !item.available);
      setTogglingId(null);
      if (!result.ok) setNotice({ kind: "error", text: result.error });
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteMenuItemAction(deleteTarget.id);
      setNotice(
        result.ok
          ? { kind: "success", text: result.message }
          : { kind: "error", text: result.error }
      );
    } catch {
      setNotice({ kind: "error", text: "Couldn't delete the item. Please try again." });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const isEmpty = items.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-[var(--color-text-primary)]">Menu</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Marking an item unavailable here removes it from every table device
            immediately — no need to touch the hardware.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ item: null })}
          className="inline-flex items-center gap-2 rounded-[var(--radius-brand)] bg-[var(--color-radium-500)] px-4 py-2 text-sm font-medium text-[#05120a] transition-colors hover:bg-[var(--color-radium-600)]"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      {notice && (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-4 flex items-start justify-between gap-3 rounded-[var(--radius-brand)] border px-3.5 py-2.5 text-sm ${
            notice.kind === "error"
              ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
              : "border-[var(--color-radium-500)]/40 bg-[var(--color-radium-500)]/10 text-[var(--color-radium-500)]"
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isEmpty && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, code or category"
              aria-label="Search menu items"
              className={`${selectClass} w-full pl-8`}
            />
          </div>

          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {/* keeps a ?category= deep link valid even if it has no items */}
            {category !== "all" && !categories.includes(category) && (
              <option value={category}>{category}</option>
            )}
          </select>

          <select
            aria-label="Filter by availability"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={selectClass}
          >
            <option value="all">Any status</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </select>

          <select
            aria-label="Filter by Veg or Non-Veg"
            value={diet}
            onChange={(e) => setDiet(e.target.value as DietFilter)}
            className={selectClass}
          >
            <option value="all">Veg &amp; Non-Veg</option>
            <option value="veg">Veg</option>
            <option value="non-veg">Non-Veg</option>
          </select>

          <button
            type="button"
            aria-pressed={specialOnly}
            onClick={() => setSpecialOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-[var(--radius-brand)] border px-3 py-2 text-sm transition-colors ${
              specialOnly
                ? "border-[var(--color-radium-500)] bg-[var(--color-radium-500)]/10 text-[var(--color-radium-500)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-500)]"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            Today&apos;s special
          </button>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 py-2 text-sm text-[var(--color-gold-500)] underline underline-offset-2"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-[var(--color-text-muted)]" aria-live="polite">
            {visible.length} of {items.length} items
          </span>
        </div>
      )}

      {initialCategory && category === initialCategory && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Showing category from link.{" "}
          <Link href="/owner/menu" className="underline underline-offset-2">
            Reset
          </Link>
        </p>
      )}

      {isEmpty ? (
        <div className="mt-6 rounded-[var(--radius-brand)] border border-dashed border-[var(--color-border)] px-6 py-14 text-center">
          <p className="text-base text-[var(--color-text-primary)]">Your menu is empty.</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add your first menu item.</p>
          <button
            type="button"
            onClick={() => setForm({ item: null })}
            className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-brand)] bg-[var(--color-radium-500)] px-4 py-2 text-sm font-medium text-[#05120a] hover:bg-[var(--color-radium-600)]"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-brand)] border border-[var(--color-border)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No menu items found.</p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-sm text-[var(--color-gold-500)] underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tablet / desktop: table */}
          <div className="mt-4 hidden overflow-x-auto rounded-[var(--radius-brand)] border border-[var(--color-border)] md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-normal">Code</th>
                  <th className="px-4 py-3 font-normal">Item</th>
                  <th className="px-4 py-3 font-normal">Category</th>
                  <th className="px-4 py-3 font-normal">Price</th>
                  <th className="px-4 py-3 font-normal">Prep time</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 font-normal">Special</th>
                  <th className="px-4 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    id={item.code}
                    className="scroll-mt-6 border-b border-[var(--color-border)] last:border-0 target:bg-[var(--color-gold-500)]/10"
                  >
                    <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      <div className="flex items-center gap-3">
                        {item.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- served by our own /api/menu-image route
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <div>
                            {item.name}
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                              {item.veg ? "Veg" : "Non-veg"}
                            </span>
                          </div>
                          {item.description && (
                            <p className="mt-0.5 max-w-xs truncate text-xs text-[var(--color-text-muted)]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.category}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                      <PriceCell item={item} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                      {item.prepMinutes} min
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.available ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                        }
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.isSpecial ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-gold-500)]">
                          <Star className="h-3 w-3" /> Special
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={togglingId === item.id}
                          onClick={() => toggleAvailability(item)}
                          className={smallBtn}
                        >
                          {item.available ? "Mark unavailable" : "Mark available"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ item })}
                          aria-label={`Edit ${item.name}`}
                          className={smallBtn}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Delete ${item.name}`}
                          className={dangerBtn}
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards, no horizontal overflow */}
          <ul className="mt-4 space-y-3 md:hidden">
            {visible.map((item) => (
              <li
                key={item.id}
                id={`m-${item.code}`}
                className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4"
              >
                <div className="flex items-start gap-3">
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- served by our own /api/menu-image route
                    <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--color-text-primary)]">
                      <span className="mr-2 tabular-nums text-[var(--color-text-secondary)]">
                        {item.code}
                      </span>
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {item.veg ? "Veg" : "Non-veg"} · {item.category} · {item.prepMinutes} min
                    </p>
                    {item.description && (
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-sm text-[var(--color-text-secondary)]">
                    <PriceCell item={item} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={
                      item.available ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                    }
                  >
                    {item.available ? "Available" : "Unavailable"}
                  </span>
                  {item.isSpecial && (
                    <span className="inline-flex items-center gap-1 text-[var(--color-gold-500)]">
                      <Star className="h-3 w-3" /> Special
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={togglingId === item.id}
                    onClick={() => toggleAvailability(item)}
                    className={smallBtn}
                  >
                    {item.available ? "Mark unavailable" : "Mark available"}
                  </button>
                  <button type="button" onClick={() => setForm({ item })} className={smallBtn}>
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    className={dangerBtn}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {form && (
        <MenuItemForm
          // remount when switching between items so state never leaks
          key={form.item?.id ?? "new"}
          item={form.item}
          allItems={items}
          onClose={() => setForm(null)}
          onSaved={(text) => {
            setForm(null);
            setNotice({ kind: "success", text });
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cancel delete"
            onClick={() => !deleting && setDeleteTarget(null)}
            className="absolute inset-0 bg-black/70"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-desc"
            className="relative w-full max-w-md rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6"
          >
            <h2 id="delete-title" className="text-lg text-[var(--color-text-primary)]">
              Delete this menu item?
            </h2>
            <div id="delete-desc" className="mt-2 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <p>
                <span className="text-[var(--color-text-primary)]">
                  {deleteTarget.code} · {deleteTarget.name}
                </span>{" "}
                will be removed from the menu on every table device.
              </p>
              <p>Existing historical orders will remain unchanged.</p>
              {(usage[deleteTarget.id] ?? 0) > 0 && (
                <p className="text-[var(--color-text-muted)]">
                  This item appears in {usage[deleteTarget.id]} past order line
                  {usage[deleteTarget.id] === 1 ? "" : "s"}, so it will be archived (hidden and
                  un-orderable) rather than erased, and its code becomes free to reuse.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                autoFocus
                className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-gold-500)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-[var(--radius-brand)] bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[#1a0505] hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceCell({ item }: { item: MenuItem }) {
  const effective = getEffectivePrice(item);
  if (item.discountPercent > 0) {
    return (
      <span>
        <s className="mr-1.5 text-xs text-[var(--color-text-muted)]">{formatRupees(item.priceRupees)}</s>
        {formatRupees(effective)}
        <span className="ml-1.5 text-xs text-[var(--color-radium-500)]">{item.discountPercent}% off</span>
      </span>
    );
  }
  return <span>{formatRupees(item.priceRupees)}</span>;
}
