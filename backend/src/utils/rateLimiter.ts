export function createRateLimiter() {
  const state = new Map<string, { count: number; resetAt: number }>();

  return {
    allow(key: string, max = 10, windowMs = 10000) {
      const now = Date.now();
      const s = state.get(key) ?? { count: 0, resetAt: now + windowMs };
      if (now > s.resetAt) {
        s.count = 0;
        s.resetAt = now + windowMs;
      }
      s.count += 1;
      state.set(key, s);
      return s.count <= max;
    }
  };
}
