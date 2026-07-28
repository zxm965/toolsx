export function safeJsonParse<T = unknown>(value: string, fallback?: T): T | undefined {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function safeJsonStringify(value: unknown, fallback = '') {
  try {
    return JSON.stringify(value)
  } catch {
    return fallback
  }
}

function normalizeStableJson(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value

  if (ancestors.has(value)) {
    throw new TypeError('Converting circular structure to JSON')
  }

  const toJSON = 'toJSON' in value && typeof value.toJSON === 'function' ? value.toJSON() : value
  if (toJSON !== value) return normalizeStableJson(toJSON, ancestors)

  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = normalizeStableJson(item, ancestors)
        return normalized === undefined || typeof normalized === 'function' || typeof normalized === 'symbol' ? null : normalized
      })
    }

    const result: Record<string, unknown> = {}

    for (const key of Object.keys(value).sort()) {
      const normalized = normalizeStableJson((value as Record<string, unknown>)[key], ancestors)
      if (normalized !== undefined && typeof normalized !== 'function' && typeof normalized !== 'symbol') result[key] = normalized
    }

    return result
  } finally {
    ancestors.delete(value)
  }
}

export function stableJsonStringify(value: unknown) {
  return JSON.stringify(normalizeStableJson(value, new WeakSet()))
}
