/**
 * Central, typed configuration surface for Tablor's.
 *
 * Rule (see docs/requirements-source.md, Section 18):
 * No pricing, contact details, or business rules may be hardcoded
 * anywhere else in the codebase. Everything configurable/unconfirmed
 * lives here or in the database, sourced from env vars.
 */

function required(name: string, value: string | undefined, fallback = ""): string {
  return value ?? fallback;
}

export const appConfig = {
  env: process.env.NODE_ENV ?? "development",
  appUrl: required("APP_URL", process.env.APP_URL, "http://localhost:3000"),
  displayTimezone: required(
    "APP_TIMEZONE_DISPLAY",
    process.env.APP_TIMEZONE_DISPLAY,
    "Asia/Kolkata"
  ),
} as const;

export const authConfig = {
  sessionCookieName: required(
    "SESSION_COOKIE_NAME",
    process.env.SESSION_COOKIE_NAME,
    "tablors_session"
  ),
  pin: {
    maxAttempts: Number(process.env.PIN_MAX_ATTEMPTS ?? 5),
    lockoutMinutes: Number(process.env.PIN_LOCKOUT_MINUTES ?? 15),
  },
} as const;

export const deviceConfig = {
  // Protocol (HTTPS/MQTT/WebSocket) is an open decision — see docs/open-decisions.md
  heartbeatIntervalSeconds: Number(
    process.env.DEVICE_HEARTBEAT_INTERVAL_SECONDS ?? 30
  ),
  offlineThresholdSeconds: Number(
    process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS ?? 90
  ),
} as const;

export const rateLimitConfig = {
  windowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60),
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30),
  demoFormPerHour: Number(process.env.DEMO_FORM_RATE_LIMIT_PER_HOUR ?? 5),
} as const;

/**
 * Placeholder public business info. Left blank intentionally —
 * do not invent phone numbers, emails, or pricing. Populate from
 * env/config once confirmed by the business team.
 */
/**
 * Demo values from the Tablor's product brochure. The phone number is a
 * visible placeholder pattern, so these are used ONLY outside production
 * (this repo is the demo build). Production must set the env vars below.
 */
const demoContact =
  process.env.NODE_ENV === "production"
    ? { phone: "", email: "", website: "" }
    : { phone: "+91 12345 67890", email: "info@tablors.com", website: "www.tablors.com" };

export const publicContact = {
  phone: process.env.PUBLIC_CONTACT_PHONE ?? demoContact.phone,
  email: process.env.PUBLIC_CONTACT_EMAIL ?? demoContact.email,
  website: process.env.PUBLIC_CONTACT_WEBSITE ?? demoContact.website,
  supportUrl: process.env.PUBLIC_SUPPORT_URL ?? "",
} as const;

/** Company address — no address exists in the project yet, so nothing is shown until set. */
export const publicCompany = {
  name: process.env.PUBLIC_COMPANY_NAME ?? "Tablor's",
  addressLine: process.env.PUBLIC_COMPANY_ADDRESS_LINE ?? "",
  cityStatePin: process.env.PUBLIC_COMPANY_CITY_STATE_PIN ?? "",
  country: process.env.PUBLIC_COMPANY_COUNTRY ?? "",
} as const;

/** Social profile URLs — each icon renders only when its URL is set. */
export const publicSocials = [
  { key: "linkedin", label: "LinkedIn", url: process.env.PUBLIC_SOCIAL_LINKEDIN ?? "" },
  { key: "instagram", label: "Instagram", url: process.env.PUBLIC_SOCIAL_INSTAGRAM ?? "" },
  { key: "facebook", label: "Facebook", url: process.env.PUBLIC_SOCIAL_FACEBOOK ?? "" },
  { key: "x", label: "X", url: process.env.PUBLIC_SOCIAL_X ?? "" },
  { key: "youtube", label: "YouTube", url: process.env.PUBLIC_SOCIAL_YOUTUBE ?? "" },
] as const;

export const financialPotsConfig = {
  enabled: process.env.FINANCIAL_POTS_ENABLED === "true",
} as const;
