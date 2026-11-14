interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export class SlidingWindowRateLimiter {
  private readonly store = new Map<string, RateLimitRecord>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    record.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      retryAfterSeconds: 0,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}
