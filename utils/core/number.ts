import type { RandomSource } from './type'

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function randomInt(min: number, max: number, random: RandomSource = Math.random) {
  const lower = Math.ceil(min)
  const upper = Math.floor(max)

  return Math.floor(random() * (upper - lower + 1)) + lower
}

export function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function average(values: readonly number[]) {
  return values.length ? sum(values) / values.length : Number.NaN
}

export function roundTo(value: number, precision = 0) {
  if (!Number.isInteger(precision)) throw new RangeError('precision must be an integer')

  const factor = 10 ** precision
  if (!Number.isFinite(factor) || factor === 0) return value

  return Math.round((value + Number.EPSILON) * factor) / factor
}
