"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { TablorLogo } from "@/components/brand/tablor-logo";
import { demoLogin, type DemoLoginState } from "@/server/modules/auth/demo-actions";

const initialState: DemoLoginState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-6 py-2.5 text-sm font-medium text-[#0a0a0a] disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(demoLogin, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-0)] px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8">
        <TablorLogo size="lg" href="/" priority />
        <h1 className="mt-4 text-xl text-[var(--color-text-primary)]">Sign in</h1>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="text-sm text-[var(--color-text-secondary)]">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="mt-1.5 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-gold-500)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-[var(--color-text-secondary)]">
              Password
            </label>
            <div className="mt-1.5" style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                style={{ display: "block", width: "100%", boxSizing: "border-box", paddingRight: "3rem" }}
                className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] py-2.5 pl-4 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-gold-500)]"
              />
              {/* Inside the box, right edge: 👁️ = show the password, 🙈 = hide it again. */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontSize: "1.15rem",
                  lineHeight: 1,
                }}
              >
                <span aria-hidden="true">{showPassword ? "🙈" : "👁️"}</span>
              </button>
            </div>
          </div>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}