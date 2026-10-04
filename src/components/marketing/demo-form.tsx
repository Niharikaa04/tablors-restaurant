"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { restaurantTypes } from "@/server/modules/leads/schema";
import { submitDemoRequest, type SubmitDemoRequestState } from "@/server/modules/leads/actions";

const initialState: SubmitDemoRequestState = { status: "idle" };

function fieldError(state: SubmitDemoRequestState, field: string) {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

// "Cafes" / "Cafe" / "cafes" all become "cafe", so a category card such as
// "Hotels" can be matched to a schema value such as "Hotel".
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/s$/, "");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--mkt-lime)] px-7 py-3 text-sm font-medium text-[var(--mkt-lime-ink)] shadow-[0_0_0_0_transparent] transition-[transform,box-shadow] duration-200 hover:scale-[1.02] hover:shadow-[0_8px_30px_-8px_var(--mkt-lime)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--mkt-lime)]/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:w-auto"
    >
      {pending ? "Sending…" : "Request a free demo"}
      {!pending && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      )}
    </button>
  );
}

const labelClass =
  "mb-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--mkt-text-secondary)]";

const inputBase =
  "block w-full rounded-xl border border-white/15 bg-black/40 px-4 text-sm text-[var(--mkt-text-primary)] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[var(--mkt-text-muted)] hover:border-white/25 focus:border-[var(--mkt-lime)] focus:ring-[3px] focus:ring-[var(--mkt-lime)]/15 aria-[invalid=true]:border-[var(--mkt-danger)]";

const inputClass = inputBase + " h-12";
const textareaClass = inputBase + " min-h-36 resize-y py-3 leading-relaxed";
const selectClass = inputClass + " appearance-none pr-11";

export function DemoForm() {
  const [state, formAction] = useActionState(submitDemoRequest, initialState);
  const [restaurantType, setRestaurantType] = useState("");

  // "Perfect for every table" announces the category the visitor picked.
  // If it matches one of the form's types, select it; otherwise leave the
  // field alone.
  useEffect(() => {
    function onVenue(event: Event) {
      const picked = normalize(String((event as CustomEvent<string>).detail ?? ""));
      if (!picked) return;
      const match =
        restaurantTypes.find((type) => normalize(type) === picked) ??
        restaurantTypes.find((type) => normalize(type).includes(picked));
      if (match) setRestaurantType(match);
    }
    window.addEventListener("tablor:venue", onVenue);
    return () => window.removeEventListener("tablor:venue", onVenue);
  }, []);

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl border border-[var(--mkt-lime)]/40 bg-black/30 p-8 text-center"
      >
        <h3
          className="text-2xl text-[var(--mkt-text-primary)]"
          style={{ fontFamily: "var(--mkt-serif)" }}
        >
          Request received
        </h3>
        <p className="mt-2 text-sm text-[var(--mkt-text-secondary)]">
          We&apos;ll reach out to schedule your demo shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-6">
      {/* Honeypot — hidden from sighted users, present for bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="companyWebsite">Leave this field empty</label>
        <input
          id="companyWebsite"
          name="companyWebsite"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-x-5 gap-y-5 xl:grid-cols-2">
        <div>
          <label htmlFor="restaurantName" className={labelClass}>
            Restaurant name
          </label>
          <input
            id="restaurantName"
            name="restaurantName"
            type="text"
            required
            suppressHydrationWarning
            placeholder="e.g. Spice Villa"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "restaurantName"))}
            aria-describedby="restaurantName-error"
          />
          <p id="restaurantName-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "restaurantName")}
          </p>
        </div>

        <div>
          <label htmlFor="ownerName" className={labelClass}>
            Owner name
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            suppressHydrationWarning
            placeholder="e.g. Ramesh Kumar"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "ownerName"))}
            aria-describedby="ownerName-error"
          />
          <p id="ownerName-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "ownerName")}
          </p>
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            suppressHydrationWarning
            placeholder="e.g. +91 98765 43210"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "phone"))}
            aria-describedby="phone-error"
          />
          <p id="phone-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "phone")}
          </p>
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            suppressHydrationWarning
            placeholder="you@restaurant.com"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "email"))}
            aria-describedby="email-error"
          />
          <p id="email-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "email")}
          </p>
        </div>

        <div>
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            suppressHydrationWarning
            placeholder="e.g. Hyderabad"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "city"))}
            aria-describedby="city-error"
          />
          <p id="city-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "city")}
          </p>
        </div>

        <div>
          <label htmlFor="tableCount" className={labelClass}>
            Number of tables
          </label>
          <input
            id="tableCount"
            name="tableCount"
            type="number"
            min={1}
            required
            suppressHydrationWarning
            placeholder="e.g. 12"
            className={inputClass}
            aria-invalid={Boolean(fieldError(state, "tableCount"))}
            aria-describedby="tableCount-error"
          />
          <p id="tableCount-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "tableCount")}
          </p>
        </div>

        <div className="xl:col-span-2">
          <label htmlFor="restaurantType" className={labelClass}>
            Restaurant type
          </label>
          <div className="relative">
            <select
              id="restaurantType"
              name="restaurantType"
              required
              value={restaurantType}
              onChange={(event) => setRestaurantType(event.target.value)}
              className={
                selectClass +
                (restaurantType === "" ? " text-[var(--mkt-text-muted)]" : "")
              }
              aria-invalid={Boolean(fieldError(state, "restaurantType"))}
              aria-describedby="restaurantType-error"
            >
              <option value="" disabled>
                Select a type
              </option>
              {restaurantTypes.map((type) => (
                <option
                  key={type}
                  value={type}
                  className="bg-[var(--mkt-stage)] text-[var(--mkt-text-primary)]"
                >
                  {type}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mkt-text-secondary)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </div>
          <p id="restaurantType-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
            {fieldError(state, "restaurantType")}
          </p>
        </div>

        <div className="xl:col-span-2">
          <label htmlFor="message" className={labelClass}>
            Message{" "}
            <span className="normal-case tracking-normal text-[var(--mkt-text-muted)]">
              (optional)
            </span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            placeholder="Anything we should know about your restaurant?"
            className={textareaClass}
          />
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-3 text-sm leading-snug text-[var(--mkt-text-secondary)]">
          <input
            type="checkbox"
            name="consent"
            required
            className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded border-white/20 accent-[var(--mkt-lime)] [color-scheme:dark] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--mkt-lime)]/25"
            aria-invalid={Boolean(fieldError(state, "consent"))}
            aria-describedby="consent-error"
          />
          <span>
            I agree to be contacted by Tablor&apos;s about this demo request.
          </span>
        </label>
        <p id="consent-error" className="mt-1.5 text-xs text-[var(--mkt-danger)]">
          {fieldError(state, "consent")}
        </p>
      </div>

      {(state.status === "error" || state.status === "rate_limited") && (
        <p role="alert" className="text-sm text-[var(--mkt-danger)]">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}