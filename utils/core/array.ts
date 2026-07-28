import { isNil } from './type'
import type { RandomSource } from './type'

export type Falsy = false | 0 | 0n | '' | null | undefined
export type NestedArray<T> = readonly (T | NestedArray<T>)[]

export function toArray<T>(value: T | T[] | null | undefined) {
  if (isNil(value)) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

export function unique<T>(array: readonly T[]) {
  return Array.from(new Set(array))
}

export function uniqueBy<T, TKey>(array: readonly T[], getKey: (item: T, index: number) => TKey) {
  const seen = new Set<TKey>()

  return array.filter((item, index) => {
    const key = getKey(item, index)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function compact<T>(array: readonly T[]) {
  return array.filter(Boolean) as Exclude<T, Falsy>[]
}

export function flatten<T>(array: NestedArray<T>, depth = Number.POSITIVE_INFINITY): T[] {
  const result: T[] = []

  const visit = (items: NestedArray<T>, currentDepth: number) => {
    for (const item of items) {
      if (Array.isArray(item) && currentDepth > 0) {
        visit(item, currentDepth - 1)
      } else {
        result.push(item as T)
      }
    }
  }

  visit(array, Math.max(0, depth))

  return result
}

export function intersection<T>(...arrays: readonly (readonly T[])[]) {
  if (!arrays.length) {
    return []
  }

  const [first, ...rest] = arrays
  const sets = rest.map((array) => new Set(array))

  return unique(first).filter((item) => sets.every((set) => set.has(item)))
}

export function difference<T>(array: readonly T[], values: readonly T[]) {
  const excluded = new Set(values)

  return array.filter((item) => !excluded.has(item))
}

export function partition<T, TMatch extends T>(array: readonly T[], predicate: (item: T, index: number) => item is TMatch): [TMatch[], Exclude<T, TMatch>[]]
export function partition<T>(array: readonly T[], predicate: (item: T, index: number) => boolean): [T[], T[]]
export function partition<T>(array: readonly T[], predicate: (item: T, index: number) => boolean): [T[], T[]] {
  const matched: T[] = []
  const unmatched: T[] = []

  array.forEach((item, index) => {
    ;(predicate(item, index) ? matched : unmatched).push(item)
  })

  return [matched, unmatched]
}

export function chunk<T>(array: readonly T[], size: number) {
  if (size <= 0) {
    return []
  }

  const result: T[][] = []

  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size))
  }

  return result
}

export function first<T>(array: readonly T[]) {
  return array[0]
}

export function last<T>(array: readonly T[]) {
  return array.length ? array[array.length - 1] : undefined
}

function normalizeCount(count: number) {
  return Math.max(0, Math.trunc(count))
}

export function take<T>(array: readonly T[], count = 1) {
  return array.slice(0, normalizeCount(count))
}

export function drop<T>(array: readonly T[], count = 1) {
  return array.slice(normalizeCount(count))
}

export function takeRight<T>(array: readonly T[], count = 1) {
  const size = normalizeCount(count)
  return size === 0 ? [] : array.slice(-size)
}

export function dropRight<T>(array: readonly T[], count = 1) {
  const size = normalizeCount(count)
  return size === 0 ? [...array] : array.slice(0, Math.max(0, array.length - size))
}

export function range(end: number): number[]
export function range(start: number, end: number, step?: number): number[]
export function range(startOrEnd: number, end?: number, step?: number) {
  const start = end === undefined ? 0 : startOrEnd
  const limit = end === undefined ? startOrEnd : end
  const increment = step ?? (limit >= start ? 1 : -1)

  if (![start, limit, increment].every(Number.isFinite)) {
    throw new RangeError('range values must be finite numbers')
  }

  if (increment === 0) {
    throw new RangeError('step must not be 0')
  }

  if ((limit > start && increment < 0) || (limit < start && increment > 0)) {
    return []
  }

  const result: number[] = []

  if (increment > 0) {
    for (let value = start; value < limit; value += increment) result.push(value)
  } else {
    for (let value = start; value > limit; value += increment) result.push(value)
  }

  return result
}

export function zip<TArrays extends readonly (readonly unknown[])[]>(...arrays: TArrays) {
  const length = Math.max(0, ...arrays.map((array) => array.length))

  return Array.from({ length }, (_, index) => arrays.map((array) => array[index])) as Array<{
    [K in keyof TArrays]: TArrays[K] extends readonly (infer TItem)[] ? TItem | undefined : never
  }>
}

export function groupBy<T, K extends PropertyKey>(array: readonly T[], getKey: (item: T, index: number) => K) {
  return array.reduce(
    (result, item, index) => {
      const key = getKey(item, index)
      result[key] ??= []
      result[key].push(item)

      return result
    },
    {} as Record<K, T[]>
  )
}

export function keyBy<T, K extends PropertyKey>(array: readonly T[], getKey: (item: T, index: number) => K) {
  return array.reduce(
    (result, item, index) => {
      result[getKey(item, index)] = item
      return result
    },
    {} as Record<K, T>
  )
}

export function sortBy<T>(array: readonly T[], getValue: (item: T) => string | number | Date, order: 'asc' | 'desc' = 'asc') {
  const direction = order === 'asc' ? 1 : -1

  return [...array].sort((a, b) => {
    const left = getValue(a)
    const right = getValue(b)
    const leftValue = left instanceof Date ? left.getTime() : left
    const rightValue = right instanceof Date ? right.getTime() : right

    if (leftValue > rightValue) return direction
    if (leftValue < rightValue) return -direction
    return 0
  })
}

export function shuffle<T>(array: readonly T[], random: RandomSource = Math.random) {
  const result = [...array]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }

  return result
}

export function sample<T>(array: readonly T[], random: RandomSource = Math.random) {
  if (!array.length) {
    return undefined
  }

  return array[Math.floor(random() * array.length)]
}
