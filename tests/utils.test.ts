import { describe, expect, it, vi } from 'vitest'

import {
  average,
  camelCase,
  capitalize,
  chunk,
  clamp,
  clone,
  compact,
  compactObject,
  compose,
  constant,
  deepFreeze,
  deepEqual,
  deepMerge,
  defaults,
  difference,
  drop,
  dropRight,
  escapeHtml,
  escapeRegExp,
  first,
  flatten,
  get,
  groupBy,
  has,
  identity,
  intersection,
  invert,
  isBoolean,
  isDefined,
  isEmpty,
  isFiniteNumber,
  isFunction,
  isNil,
  isNumber,
  isObject,
  isPlainObject,
  isString,
  kebabCase,
  keyBy,
  last,
  mapKeys,
  mapValues,
  mask,
  noop,
  omit,
  once,
  partition,
  pascalCase,
  pipe,
  pick,
  randomInt,
  randomString,
  range,
  roundTo,
  safeJsonParse,
  safeJsonStringify,
  sample,
  set,
  shuffle,
  snakeCase,
  sortBy,
  stableJsonStringify,
  sum,
  take,
  takeRight,
  toArray,
  trim,
  truncate,
  unique,
  uniqueBy,
  unset,
  zip
} from '../utils'

describe('array utilities', () => {
  it('normalizes and filters arrays', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(1)).toEqual([1])
    expect(toArray([1, 2])).toEqual([1, 2])
    expect(unique([1, 1, 2])).toEqual([1, 2])
    expect(uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], (item) => item.id)).toEqual([{ id: 1 }, { id: 2 }])
    expect(compact([0, 1, false, 'ok', null, undefined])).toEqual([1, 'ok'])
    expect(flatten([1, [2, [3]]])).toEqual([1, 2, 3])
    expect(flatten([1, [2, [3]]], 1)).toEqual([1, 2, [3]])
  })

  it('supports set-like and grouping operations', () => {
    expect(intersection([1, 2, 2, 3], [2, 3], [2])).toEqual([2])
    expect(intersection()).toEqual([])
    expect(difference([1, 2, 3], [2])).toEqual([1, 3])
    expect(partition([1, 2, 3, 4], (value) => value % 2 === 0)).toEqual([
      [2, 4],
      [1, 3]
    ])
    expect(groupBy(['a', 'bb', 'c'], (value) => value.length)).toEqual({ 1: ['a', 'c'], 2: ['bb'] })
    expect(keyBy([{ id: 'a', value: 1 }], (item) => item.id)).toEqual({ a: { id: 'a', value: 1 } })
  })

  it('chunks, sorts and samples without mutating input', () => {
    const input = [3, 1, 2]
    expect(chunk(input, 2)).toEqual([[3, 1], [2]])
    expect(chunk(input, 0)).toEqual([])
    expect(first(input)).toBe(3)
    expect(first([])).toBeUndefined()
    expect(last(input)).toBe(2)
    expect(last([])).toBeUndefined()
    expect(sortBy(input, (value) => value)).toEqual([1, 2, 3])
    expect(sortBy(input, (value) => value, 'desc')).toEqual([3, 2, 1])
    expect(input).toEqual([3, 1, 2])
    expect(shuffle([1, 2, 3], () => 0)).toEqual([2, 3, 1])
    expect(sample([1, 2, 3], () => 0.5)).toBe(2)
    expect(sample([])).toBeUndefined()
    expect(take(input, 2)).toEqual([3, 1])
    expect(drop(input, 2)).toEqual([2])
    expect(takeRight(input, 2)).toEqual([1, 2])
    expect(dropRight(input, 2)).toEqual([3])
    expect(range(3)).toEqual([0, 1, 2])
    expect(range(3, 0)).toEqual([3, 2, 1])
    expect(range(0, 5, 2)).toEqual([0, 2, 4])
    expect(range(0, 5, -1)).toEqual([])
    expect(() => range(0, 1, 0)).toThrow(RangeError)
    expect(() => range(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(zip([1, 2], ['a'])).toEqual([
      [1, 'a'],
      [2, undefined]
    ])
  })
})

describe('object utilities', () => {
  it('selects, maps and mutates explicit paths', () => {
    const source = { id: 1, name: 'Tom', password: 'secret' }
    expect(pick(source, ['id', 'name'])).toEqual({ id: 1, name: 'Tom' })
    expect(omit(source, ['password'])).toEqual({ id: 1, name: 'Tom' })
    expect(mapValues({ a: 1, b: 2 }, (value) => value * 2)).toEqual({ a: 2, b: 4 })
    expect(mapKeys({ firstName: 'Tom' }, (_, key) => String(key).toUpperCase())).toEqual({ FIRSTNAME: 'Tom' })
    expect(defaults({ enabled: false, name: undefined }, { enabled: true, name: 'toolsx' })).toEqual({ enabled: false, name: 'toolsx' })
    expect(compactObject({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null })
    expect(invert({ a: 'one', b: 'two' })).toEqual({ one: 'a', two: 'b' })

    const target: { user?: { profile?: { name?: string } } } = {}
    set(target, 'user.profile.name', 'Jerry')
    expect(get(target, 'user.profile.name')).toBe('Jerry')
    expect(get(target, 'user.missing', 'fallback')).toBe('fallback')
    expect(has(target, 'user.profile.name')).toBe(true)
    expect(unset(target, 'user.profile.name')).toBe(true)
    expect(has(target, 'user.profile.name')).toBe(false)
  })

  it('deep merges objects and blocks unsafe paths', () => {
    expect(deepMerge({ theme: { color: 'red' }, enabled: true }, { theme: { size: 12 } })).toEqual({
      enabled: true,
      theme: { color: 'red', size: 12 }
    })
    expect(() => set({}, '__proto__.polluted', true)).toThrow('Unsafe object path segment')
    expect(() => deepMerge({}, JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow('Unsafe object path segment')
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('compares nested and cyclic values', () => {
    const left: { name: string; self?: unknown } = { name: 'toolsx' }
    const right: { name: string; self?: unknown } = { name: 'toolsx' }
    left.self = left
    right.self = right

    expect(deepEqual(left, right)).toBe(true)
    expect(deepEqual(new Set([{ id: 1 }]), new Set([{ id: 1 }]))).toBe(true)
    expect(deepEqual(new Map([[{ id: 1 }, new Date(0)]]), new Map([[{ id: 1 }, new Date(0)]]))).toBe(true)
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(deepEqual(/a/gi, /a/g)).toBe(false)
    expect(clone({ nested: { value: 1 } })).toEqual({ nested: { value: 1 } })

    const frozen = deepFreeze({ nested: { value: 1 } })
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.nested)).toBe(true)
  })
})

describe('string, number, json and type utilities', () => {
  it('converts and protects strings', () => {
    expect(capitalize('tools')).toBe('Tools')
    expect(camelCase('helloWorld value')).toBe('helloWorldValue')
    expect(pascalCase('hello-world')).toBe('HelloWorld')
    expect(kebabCase('helloWorld')).toBe('hello-world')
    expect(snakeCase('helloWorld')).toBe('hello_world')
    expect(trim('--value--', '-')).toBe('value')
    expect(truncate('123456', 4)).toBe('123…')
    expect(truncate('123', 1, '...')).toBe('.')
    expect(escapeHtml('<a title="x">&</a>')).toBe('&lt;a title=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
    expect(escapeRegExp('a+b?')).toBe('a\\+b\\?')
    expect(mask('13800138000', 3, 4)).toBe('138****8000')
    expect(randomString(4, 'ab', () => 0)).toBe('aaaa')
    expect(() => randomString(-1)).toThrow(RangeError)
  })

  it('handles numbers and json safely', () => {
    expect(clamp(12, 0, 10)).toBe(10)
    expect(randomInt(2, 4, () => 0)).toBe(2)
    expect(sum([1, 2, 3])).toBe(6)
    expect(average([1, 2, 3])).toBe(2)
    expect(average([])).toBeNaN()
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(safeJsonParse<{ ok: boolean }>('bad', { ok: false })).toEqual({ ok: false })
    expect(safeJsonStringify({ ok: true })).toBe('{"ok":true}')
    expect(stableJsonStringify({ z: 1, nested: { b: 2, a: 1 }, a: 2 })).toBe('{"a":2,"nested":{"a":1,"b":2},"z":1}')
    const circular: { self?: unknown } = {}
    circular.self = circular
    expect(safeJsonStringify(circular, 'fallback')).toBe('fallback')
    expect(() => stableJsonStringify(circular)).toThrow(TypeError)
  })

  it('provides type guards and empty checks', () => {
    expect(isNumber(Number.NaN)).toBe(true)
    expect(isFiniteNumber(Number.NaN)).toBe(false)
    expect(isString('x')).toBe(true)
    expect(isBoolean(false)).toBe(true)
    expect(isFunction(() => {})).toBe(true)
    expect(isObject({})).toBe(true)
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isNil(null)).toBe(true)
    expect([1, null, undefined].filter(isDefined)).toEqual([1])
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty(new Map())).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty(0)).toBe(false)
  })
})

describe('function utilities', () => {
  it('provides composition, constants and single execution', () => {
    const calculate = pipe(
      (value: number) => value + 1,
      (value) => String(value)
    )
    const reverseCalculate = compose(
      (value: number) => value * 2,
      (value: string) => Number(value)
    )
    const called = vi.fn((value: number) => value * 2)
    const single = once(called)

    expect(calculate(1)).toBe('2')
    expect(reverseCalculate('3')).toBe(6)
    expect(identity('value')).toBe('value')
    expect(constant(42)()).toBe(42)
    expect(single(2)).toBe(4)
    expect(single(3)).toBe(4)
    expect(single.called()).toBe(true)
    expect(called).toHaveBeenCalledOnce()
    expect(noop()).toBeUndefined()

    const receiver = {
      factor: 3,
      multiply: once(function (this: { factor: number }, value: number) {
        return this.factor * value
      })
    }
    expect(receiver.multiply(2)).toBe(6)

    const failure = new Error('once failed')
    const failed = once(() => {
      throw failure
    })
    expect(() => failed()).toThrow(failure)
    expect(() => failed()).toThrow(failure)
  })
})
