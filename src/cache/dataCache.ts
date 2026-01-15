type CacheEntry<T> = {
  data: T;
  ts: number;
};

class DataCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string, ttlMs: number): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.ts > ttlMs;
    if (isExpired) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T) {
    this.store.set(key, { data, ts: Date.now() });
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  invalidateMany(keys: string[]) {
    keys.forEach((k) => this.store.delete(k));
  }

  clear() {
    this.store.clear();
  }
}

export const dataCache = new DataCache();
