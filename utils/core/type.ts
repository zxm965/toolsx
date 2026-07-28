export type AnyFunction = (...args: never[]) => unknown

const objectToString = Object.prototype.toString

export const isNumber = (value: unknown): value is number => typeof value === 'number'
export const isFiniteNumber = (value: unknown): value is number => Number.isFinite(value)
export const isString = (value: unknown): value is string => typeof value === 'string'
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const isFunction = <T extends AnyFunction = AnyFunction>(value: unknown): value is T => typeof value === 'function'
export const isObject = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null
export const isPlainObject = (value: unknown): value is Record<PropertyKey, unknown> => objectToString.call(value) === '[object Object]'
export const isNil = (value: unknown): value is null | undefined => value === null || value === undefined
export const isDefined = <T>(value: T | null | undefined): value is T => !isNil(value)

export function isEmpty(value: unknown) {
  if (isNil(value)) {
    return true
  }

  if (isString(value) || Array.isArray(value)) {
    return value.length === 0
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0
  }

  return false
}
