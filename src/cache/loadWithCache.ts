import { dataCache } from "./dataCache";

export async function loadWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = dataCache.get<T>(key, ttlMs);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  dataCache.set(key, fresh);
  return fresh;
}
