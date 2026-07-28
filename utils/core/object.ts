import { isPlainObject } from './type'

const unsafeKeys = new Set<PropertyKey>(['__proto__', 'constructor', 'prototype'])

function assertSafeKey(key: PropertyKey) {
  if (unsafeKeys.has(key)) {
    throw new Error(`Unsafe object path segment: ${String(key)}`)
  }
}

function normalizePath(path: string | readonly PropertyKey[]) {
  const keys = typeof path === 'string' ? path.split('.').filter(Boolean) : [...path]
  keys.forEach(assertSafeKey)
  return keys
}

export function pick<T extends object, K extends keyof T>(object: T, keys: readonly K[]) {
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

export function omit<T extends object, K extends keyof T>(object: T, keys: readonly K[]) {
  const keySet = new Set<PropertyKey>(keys)
  const result = { ...object }

  for (const key of Reflect.ownKeys(result)) {
    if (keySet.has(key)) {
      delete result[key as keyof typeof result]
    }
  }

  return result as Omit<T, K>
}

export function deepMerge<T extends object, U extends object>(target: T, source: U): T & U {
  const result = { ...target } as Record<PropertyKey, unknown>

  Reflect.ownKeys(source).forEach((key) => {
    assertSafeKey(key)
    const value = source[key as keyof U]
    const currentValue = result[key]

    result[key] = isPlainObject(currentValue) && isPlainObject(value) ? deepMerge(currentValue, value) : value
  })

  return result as T & U
}

export function get<T = unknown>(object: unknown, path: string | readonly PropertyKey[], defaultValue?: T): T | undefined {
  const keys = normalizePath(path)
  let current: unknown = object

  for (const key of keys) {
    if (current == null || !(key in Object(current))) {
      return defaultValue
    }

    current = (current as Record<PropertyKey, unknown>)[key]
  }

  return current as T
}

export function has(object: unknown, path: string | readonly PropertyKey[]) {
  const marker = Symbol('missing')
  return get(object, path, marker) !== marker
}

export function set<T extends object>(object: T, path: string | readonly PropertyKey[], value: unknown) {
  const keys = normalizePath(path)

  if (!keys.length) {
    return object
  }

  let current = object as Record<PropertyKey, unknown>

  keys.slice(0, -1).forEach((key) => {
    if (!isPlainObject(current[key])) {
      current[key] = {}
    }

    current = current[key] as Record<PropertyKey, unknown>
  })

  current[keys[keys.length - 1]] = value

  return object
}

export function unset(object: object, path: string | readonly PropertyKey[]) {
  const keys = normalizePath(path)

  if (!keys.length) {
    return false
  }

  let current = object as Record<PropertyKey, unknown>

  for (const key of keys.slice(0, -1)) {
    if (!isPlainObject(current[key])) {
      return false
    }

    current = current[key]
  }

  return Reflect.deleteProperty(current, keys[keys.length - 1])
}

export function mapValues<T extends object, TResult>(object: T, transform: (value: T[keyof T], key: keyof T) => TResult) {
  const result = {} as { [K in keyof T]: TResult }

  for (const key of Reflect.ownKeys(object) as (keyof T)[]) {
    result[key] = transform(object[key], key)
  }

  return result
}

export function mapKeys<T extends object, K extends PropertyKey>(object: T, transform: (value: T[keyof T], key: keyof T) => K) {
  const result = {} as Record<K, T[keyof T]>

  for (const key of Reflect.ownKeys(object) as (keyof T)[]) {
    result[transform(object[key], key)] = object[key]
  }

  return result
}

function compareMaps(left: Map<unknown, unknown>, right: Map<unknown, unknown>, seen: WeakMap<object, object>) {
  if (left.size !== right.size) return false

  const unmatched = [...right.entries()]

  return [...left.entries()].every(([leftKey, leftValue]) => {
    const index = unmatched.findIndex(([rightKey, rightValue]) => deepEqualInternal(leftKey, rightKey, seen) && deepEqualInternal(leftValue, rightValue, seen))

    if (index < 0) return false
    unmatched.splice(index, 1)
    return true
  })
}

function compareSets(left: Set<unknown>, right: Set<unknown>, seen: WeakMap<object, object>) {
  if (left.size !== right.size) return false

  const unmatched = [...right]

  return [...left].every((leftValue) => {
    const index = unmatched.findIndex((rightValue) => deepEqualInternal(leftValue, rightValue, seen))

    if (index < 0) return false
    unmatched.splice(index, 1)
    return true
  })
}

function deepEqualInternal(left: unknown, right: unknown, seen: WeakMap<object, object>): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false
  if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false

  const seenRight = seen.get(left)
  if (seenRight) return seenRight === right
  seen.set(left, right)

  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime()
  if (left instanceof RegExp && right instanceof RegExp) return left.source === right.source && left.flags === right.flags
  if (left instanceof Map && right instanceof Map) return compareMaps(left, right, seen)
  if (left instanceof Set && right instanceof Set) return compareSets(left, right, seen)

  if (ArrayBuffer.isView(left) && ArrayBuffer.isView(right)) {
    const leftBytes = new Uint8Array(left.buffer, left.byteOffset, left.byteLength)
    const rightBytes = new Uint8Array(right.buffer, right.byteOffset, right.byteLength)
    return leftBytes.length === rightBytes.length && leftBytes.every((value, index) => value === rightBytes[index])
  }

  const leftKeys = Reflect.ownKeys(left)
  const rightKeys = Reflect.ownKeys(right)

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqualInternal(left[key as keyof typeof left], right[key as keyof typeof right], seen)
    )
  )
}

export function deepEqual(left: unknown, right: unknown) {
  return deepEqualInternal(left, right, new WeakMap())
}

export function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}
