type RateLimitBucket = { startedAtMs: number; count: number };

const memoryStore = new Map<string, RateLimitBucket>();

export function enforceRateLimit(key: string, windowMs: number, maxRequests: number) {
  const now = Date.now();
  const bucket = memoryStore.get(key);
  if (!bucket || now - bucket.startedAtMs >= windowMs) {
    memoryStore.set(key, { startedAtMs: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= maxRequests) {
    const retryAfterMs = Math.max(0, windowMs - (now - bucket.startedAtMs));
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
