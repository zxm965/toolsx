import { isNil } from './type'

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

export function last<T>(array: readonly T[]) {
  return array.length ? array[array.length - 1] : undefined
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

export function shuffle<T>(array: readonly T[], random: () => number = Math.random) {
  const result = [...array]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }

  return result
}

export function sample<T>(array: readonly T[], random: () => number = Math.random) {
  if (!array.length) {
    return undefined
  }

  return array[Math.floor(random() * array.length)]
}
