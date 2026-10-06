import { rateLimitConfig } from "@/lib/config";

/**
 * In-memory sliding-window rate limiter.
 *
 * IMPORTANT: this is a Phase-1 placeholder suitable for a single
 * server instance in development. It resets on server restart and
 * does not coordinate across multiple instances. Before production
 * deployment (Phase 7 — security hardening), replace with a shared
 * store (e.g. Redis) so limits hold across restarts and horizontal
 * scaling. Tracked as a VAPT item: rate limiting / DoS resilience.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  {
    maxRequests = rateLimitConfig.demoFormPerHour,
    windowSeconds = 3600,
  }: { maxRequests?: number; windowSeconds?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxRequests - existing.count };
}
