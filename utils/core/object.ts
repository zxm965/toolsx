import { isPlainObject } from './type'

export function pick<T extends Record<PropertyKey, any>, K extends keyof T>(object: T, keys: readonly K[]) {
  return keys.reduce(
    (result, key) => {
      if (key in object) {
        result[key] = object[key]
      }

      return result
    },
    {} as Pick<T, K>
  )
}

export function omit<T extends Record<PropertyKey, any>, K extends keyof T>(object: T, keys: readonly K[]) {
  const keySet = new Set<PropertyKey>(keys)
  const result = { ...object }

  for (const key of Reflect.ownKeys(result)) {
    if (keySet.has(key)) {
      delete result[key as keyof typeof result]
    }
  }

  return result as Omit<T, K>
}

export function deepMerge<T extends Record<string, any>, U extends Record<string, any>>(target: T, source: U): T & U {
  const result: Record<string, any> = { ...target }

  Object.entries(source).forEach(([key, value]) => {
    const currentValue = result[key]

    result[key] = isPlainObject(currentValue) && isPlainObject(value) ? deepMerge(currentValue, value) : value
  })

  return result as T & U
}

export function get<T = unknown>(object: unknown, path: string | readonly PropertyKey[], defaultValue?: T): T | undefined {
  const keys = typeof path === 'string' ? path.split('.').filter(Boolean) : path
  let current: any = object

  for (const key of keys) {
    if (current == null || !(key in Object(current))) {
      return defaultValue
    }

    current = current[key as keyof typeof current]
  }

  return current as T
}

export function set<T extends Record<PropertyKey, any>>(object: T, path: string | readonly PropertyKey[], value: unknown) {
  const keys = typeof path === 'string' ? path.split('.').filter(Boolean) : [...path]

  if (!keys.length) {
    return object
  }

  let current: Record<PropertyKey, any> = object

  keys.slice(0, -1).forEach((key) => {
    if (!isPlainObject(current[key])) {
      current[key] = {}
    }

    current = current[key]
  })

  current[keys[keys.length - 1]] = value

  return object
}

export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}
