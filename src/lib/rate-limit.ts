/**
 * Sliding-window in-memory rate limiter (MVP). Per-process: behind several instances swap this for
 * Redis/Upstash by keeping the same signature.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()) {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    const oldest = hits[0] ?? now;
    return { limited: true as const, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { limited: false as const, retryAfterSec: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
