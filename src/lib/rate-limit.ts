const attempts = new Map<string, { count: number; reset: number }>();

export function allowAttempt(key: string, limit = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.reset <= now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  current.count++;
  return current.count <= limit;
}
