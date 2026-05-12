import { isNil } from './type'

export function toArray<T>(value: T | T[] | null | undefined) {
  if (isNil(value)) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

export function unique<T>(array: readonly T[]) {
  return Array.from(new Set(array))
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
