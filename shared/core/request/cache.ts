import type { RequestCacheAdapter, RequestCacheEntry } from './types'

export function createMemoryRequestCache(initialEntries: readonly (readonly [string, RequestCacheEntry])[] = []): RequestCacheAdapter {
  const entries = new Map<string, RequestCacheEntry>(initialEntries)

  return {
    clear: () => entries.clear(),
    delete: (key) => entries.delete(key),
    get: (key) => entries.get(key),
    has: (key) => entries.has(key),
    keys: () => [...entries.keys()],
    set: (key, entry) => entries.set(key, entry),
    get size() {
      return entries.size
    }
  }
}
