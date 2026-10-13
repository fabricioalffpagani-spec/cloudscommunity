type CachedFeed = { value: unknown; storedAt: number };

const feeds = new Map<string, CachedFeed>();
const MAX_AGE_MS = 30_000;

export function getCachedFeed<T>(key: string): T | null {
  if (!key) return null;
  const entry = feeds.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > MAX_AGE_MS) {
    feeds.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheFeed<T>(key: string, value: T) {
  if (!key) return;
  feeds.set(key, { value, storedAt: Date.now() });
}
