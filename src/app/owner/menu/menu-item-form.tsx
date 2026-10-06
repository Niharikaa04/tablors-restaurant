"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import {
  createMenuItemAction,
  updateMenuItemAction,
} from "@/server/modules/menu/actions";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  IMAGE_ALLOWED_TYPES,
  ITEM_CODE_HINT,
  NAME_MAX,
  formatRupees,
  getEffectivePrice,
  validateImageFile,
  validateMenuInput,
  type MenuFieldErrors,
  type MenuFormField,
  type MenuFormValues,
} from "@/lib/menu-shared";

const NEW_CATEGORY = "__new__";

const inputClass =
  "w-full rounded-[var(--radius-brand)] border bg-[var(--color-surface-0)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus-visible:border-[var(--color-radium-500)]";

function fieldBorder(error?: string) {
  return error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]";
}

function toValues(item: MenuItem | null): MenuFormValues {
  if (!item) {
    return {
      name: "",
      code: "",
      description: "",
      priceRupees: "",
      category: "",
      veg: "",
      prepMinutes: "",
      available: true,
      isSpecial: false,
      discountPercent: "",
    };
  }
  return {
    name: item.name,
    code: item.code,
    description: item.description,
    priceRupees: String(item.priceRupees),
    category: item.category,
    veg: item.veg ? "veg" : "non-veg",
    prepMinutes: String(item.prepMinutes),
    available: item.available,
    isSpecial: item.isSpecial,
    discountPercent: item.discountPercent > 0 ? String(item.discountPercent) : "",
  };
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs text-[var(--color-text-secondary)]">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function MenuItemForm({
  item,
  allItems,
  onClose,
  onSaved,
}: {
  /** null = add mode */
  item: MenuItem | null;
  /** every active item, for the unique-code check + category list */
  allItems: MenuItem[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isEdit = item !== null;
  const [values, setValues] = useState<MenuFormValues>(() => toValues(item));
  const [touched, setTouched] = useState<Set<MenuFormField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState<MenuFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(allItems.map((m) => m.category))),
    [allItems]
  );
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    item && categories.includes(item.category) ? "existing" : categories.length === 0 ? "new" : "existing"
  );

  // Image state: a newly chosen file, or a request to remove the current one.
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escape to close + lock background scroll while the drawer is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, saving]);

  const validation = useMemo(
    () =>
      validateMenuInput(
        values,
        allItems.map((m) => ({ id: m.id, code: m.code, name: m.name })),
        categories,
        item?.id ?? null
      ),
    [values, allItems, categories, item]
  );

  const clientErrors: MenuFieldErrors = validation.ok ? {} : validation.errors;
  const errorFor = (field: MenuFormField): string | undefined => {
    if (field === "image") return imageError ?? serverErrors.image;
    // Server-reported errors show until that field is edited again.
    if (serverErrors[field]) return serverErrors[field];
    if (submitted || touched.has(field)) return clientErrors[field];
    return undefined;
  };

  function set<K extends keyof MenuFormValues>(key: K, value: MenuFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in serverErrors) {
      setServerErrors((prev) => {
        const next = { ...prev };
        delete next[key as MenuFormField];
        return next;
      });
    }
  }
  const touch = (field: MenuFormField) =>
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));

  // Who owns the code being typed? Shown live, before submit.
  const codeOwner = useMemo(() => {
    const code = values.code.trim();
    if (!code) return null;
    const owner = allItems.find((m) => m.code === code && m.id !== item?.id);
    return owner ?? null;
  }, [values.code, allItems, item]);
  const codeChanged = isEdit && item !== null && values.code.trim() !== item.code;

  const effectivePreview = useMemo(() => {
    const price = /^\d+$/.test(values.priceRupees.trim()) ? Number(values.priceRupees) : null;
    if (price === null) return null;
    const d = values.discountPercent.trim() === "" ? 0 : Number(values.discountPercent);
    if (!Number.isInteger(d) || d < 0 || d > 100) return null;
    return { base: price, discount: d, effective: getEffectivePrice({ priceRupees: price, discountPercent: d }) };
  }, [values.priceRupees, values.discountPercent]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) return;
    const problem = validateImageFile(picked);
    if (problem) {
      setImageError(problem);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImageError(null);
    setFile(picked);
    setRemoveImage(false);
  }

  function clearImage() {
    setFile(null);
    setImageError(null);
    if (fileRef.current) fileRef.current.value = "";
    if (item?.imageUrl) setRemoveImage(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    setServerErrors({});

    if (!validation.ok || imageError) {
      setFormError("Please fix the highlighted fields.");
      return;
    }

    const fd = new FormData();
    fd.set("name", values.name);
    fd.set("code", values.code);
    fd.set("description", values.description);
    fd.set("priceRupees", values.priceRupees);
    fd.set("category", values.category);
    fd.set("veg", values.veg);
    fd.set("prepMinutes", values.prepMinutes);
    fd.set("available", String(values.available));
    fd.set("isSpecial", String(values.isSpecial));
    fd.set("discountPercent", values.discountPercent);
    if (file) fd.set("image", file);
    if (removeImage && !file) fd.set("removeImage", "true");

    setSaving(true);
    try {
      const result = item
        ? await updateMenuItemAction(item.id, fd)
        : await createMenuItemAction(fd);
      if (result.ok) {
        onSaved(result.message);
      } else {
        setServerErrors(result.fieldErrors ?? {});
        setFormError(result.error);
      }
    } catch {
      setFormError("Couldn't save the item. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const currentImage = file ? filePreview : removeImage ? null : (item?.imageUrl ?? null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close form"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 bg-black/70"
      />

      <form
        onSubmit={onSubmit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-form-title"
        className="relative flex h-full w-full max-w-lg flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-1)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 id="menu-form-title" className="text-lg text-[var(--color-text-primary)]">
            {isEdit ? "Edit menu item" : "Add menu item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <Field label="Item code" htmlFor="mf-code" error={errorFor("code")} hint={ITEM_CODE_HINT}>
              <input
                id="mf-code"
                inputMode="numeric"
                maxLength={3}
                value={values.code}
                onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))}
                onBlur={() => touch("code")}
                placeholder="099"
                aria-invalid={Boolean(errorFor("code"))}
                className={`${inputClass} ${fieldBorder(errorFor("code"))}`}
              />
            </Field>
            <Field label="Item name" htmlFor="mf-name" error={errorFor("name")}>
              <input
                id="mf-name"
                maxLength={NAME_MAX + 20}
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => touch("name")}
                placeholder="Pepper Chicken"
                aria-invalid={Boolean(errorFor("name"))}
                className={`${inputClass} ${fieldBorder(errorFor("name"))}`}
              />
            </Field>
          </div>

          {codeOwner && !errorFor("code") && (
            <p className="-mt-2 text-xs text-[var(--color-danger)]">
              Code {codeOwner.code} belongs to “{codeOwner.name}”.
            </p>
          )}
          {codeChanged && !codeOwner && (
            <p className="-mt-2 rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
              Changing the code from {item?.code} to {values.code.trim() || "…"} changes what guests
              enter on the device. Past orders keep the code they were placed with.
            </p>
          )}

          <Field
            label="Description (optional)"
            htmlFor="mf-desc"
            error={errorFor("description")}
            hint={`${values.description.trim().length}/${DESCRIPTION_MAX}`}
          >
            <textarea
              id="mf-desc"
              rows={2}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              onBlur={() => touch("description")}
              placeholder="Juicy pepper chicken cooked with freshly ground spices."
              className={`${inputClass} resize-none ${fieldBorder(errorFor("description"))}`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)" htmlFor="mf-price" error={errorFor("priceRupees")}>
              <input
                id="mf-price"
                inputMode="numeric"
                value={values.priceRupees}
                onChange={(e) => set("priceRupees", e.target.value)}
                onBlur={() => touch("priceRupees")}
                placeholder="280"
                aria-invalid={Boolean(errorFor("priceRupees"))}
                className={`${inputClass} ${fieldBorder(errorFor("priceRupees"))}`}
              />
            </Field>
            <Field label="Prep time (min)" htmlFor="mf-prep" error={errorFor("prepMinutes")}>
              <input
                id="mf-prep"
                inputMode="numeric"
                value={values.prepMinutes}
                onChange={(e) => set("prepMinutes", e.target.value)}
                onBlur={() => touch("prepMinutes")}
                placeholder="15"
                aria-invalid={Boolean(errorFor("prepMinutes"))}
                className={`${inputClass} ${fieldBorder(errorFor("prepMinutes"))}`}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="mf-category" error={errorFor("category")}>
              {categoryMode === "existing" ? (
                <select
                  id="mf-category"
                  value={values.category}
                  onChange={(e) => {
                    if (e.target.value === NEW_CATEGORY) {
                      setCategoryMode("new");
                      set("category", "");
                    } else set("category", e.target.value);
                  }}
                  onBlur={() => touch("category")}
                  aria-invalid={Boolean(errorFor("category"))}
                  className={`${inputClass} ${fieldBorder(errorFor("category"))}`}
                >
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={NEW_CATEGORY}>+ New category…</option>
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    id="mf-category"
                    autoFocus={categories.length > 0}
                    maxLength={CATEGORY_MAX + 10}
                    value={values.category}
                    onChange={(e) => set("category", e.target.value)}
                    onBlur={() => touch("category")}
                    placeholder="New category name"
                    aria-invalid={Boolean(errorFor("category"))}
                    className={`${inputClass} ${fieldBorder(errorFor("category"))}`}
                  />
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryMode("existing");
                        set("category", item && categories.includes(item.category) ? item.category : "");
                      }}
                      className="shrink-0 rounded-[var(--radius-brand)] border border-[var(--color-border)] px-2.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-gold-500)]"
                    >
                      List
                    </button>
                  )}
                </div>
              )}
            </Field>

            <Field label="Type" error={errorFor("veg")}>
              <div
                role="radiogroup"
                aria-label="Veg or Non-Veg"
                className={`flex overflow-hidden rounded-[var(--radius-brand)] border ${fieldBorder(errorFor("veg"))}`}
              >
                {(
                  [
                    ["veg", "Veg"],
                    ["non-veg", "Non-Veg"],
                  ] as const
                ).map(([val, label]) => {
                  const active = values.veg === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        set("veg", val);
                        touch("veg");
                      }}
                      className={`flex-1 px-3 py-2 text-sm transition-colors ${
                        active
                          ? val === "veg"
                            ? "bg-[var(--color-radium-500)] text-[#05120a]"
                            : "bg-[var(--color-danger)] text-[#1a0505]"
                          : "bg-[var(--color-surface-0)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Discount % (optional)"
              htmlFor="mf-discount"
              error={errorFor("discountPercent")}
              hint="Leave blank for no discount."
            >
              <input
                id="mf-discount"
                inputMode="numeric"
                value={values.discountPercent}
                onChange={(e) => set("discountPercent", e.target.value)}
                onBlur={() => touch("discountPercent")}
                placeholder="10"
                aria-invalid={Boolean(errorFor("discountPercent"))}
                className={`${inputClass} ${fieldBorder(errorFor("discountPercent"))}`}
              />
            </Field>
            <div className="flex flex-col justify-center rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-muted)]">Guests pay</span>
              {effectivePreview ? (
                <span className="mt-0.5 text-sm text-[var(--color-text-primary)]">
                  {effectivePreview.discount > 0 && (
                    <s className="mr-1.5 text-xs text-[var(--color-text-muted)]">
                      {formatRupees(effectivePreview.base)}
                    </s>
                  )}
                  {formatRupees(effectivePreview.effective)}
                </span>
              ) : (
                <span className="mt-0.5 text-sm text-[var(--color-text-muted)]">—</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={values.available}
                onChange={(e) => set("available", e.target.checked)}
                className="h-4 w-4 accent-[var(--color-radium-500)]"
              />
              Available
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={values.isSpecial}
                onChange={(e) => set("isSpecial", e.target.checked)}
                className="h-4 w-4 accent-[var(--color-radium-500)]"
              />
              Today&apos;s special
            </label>
          </div>

          <Field
            label="Food image (optional)"
            error={errorFor("image")}
            hint="JPEG, PNG or WebP, up to 512 KB. Demo storage: images are held in server memory and clear on restart, like the rest of the demo data."
          >
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)]">
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob preview / our own image route
                  <img src={currentImage} alt="Food preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-[var(--color-text-muted)]" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_ALLOWED_TYPES.join(",")}
                  onChange={onPickFile}
                  className="sr-only"
                  id="mf-image"
                />
                <label
                  htmlFor="mf-image"
                  className="cursor-pointer rounded-[var(--radius-brand)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:border-[var(--color-gold-500)]"
                >
                  {currentImage ? "Replace image" : "Choose image"}
                </label>
                {currentImage && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-brand)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                )}
              </div>
            </div>
          </Field>
        </div>

        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {formError && (
            <p role="alert" className="mb-3 text-sm text-[var(--color-danger)]">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-gold-500)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[var(--radius-brand)] bg-[var(--color-radium-500)] px-4 py-2 text-sm font-medium text-[#05120a] transition-colors hover:bg-[var(--color-radium-600)] disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Add item"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
