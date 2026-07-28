import { afterEach, describe, expect, it, vi } from 'vitest'

import { debounce, memoize, memoizeAsync, promisePool, retry, sleep, throttle, timeout, tryCatch, withResolvers } from '../utils'

afterEach(() => {
  vi.useRealTimers()
})

describe('async utilities', () => {
  it('sleeps and supports cancellation', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = sleep(100, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    const completed = sleep(10)
    await vi.advanceTimersByTimeAsync(10)
    await expect(completed).resolves.toBeUndefined()
  })

  it('converts promise errors into tuples', async () => {
    await expect(tryCatch(Promise.resolve(1))).resolves.toEqual([1, null])
    const error = new Error('failed')
    await expect(tryCatch(Promise.reject(error))).resolves.toEqual([null, error])
  })

  it('retries with legacy and configured options', async () => {
    let attempts = 0
    await expect(
      retry(async () => {
        attempts += 1
        if (attempts < 3) throw new Error('retry')
        return 'ok'
      }, 3)
    ).resolves.toBe('ok')
    expect(attempts).toBe(3)

    const shouldRetry = vi.fn().mockReturnValue(false)
    await expect(retry(async () => Promise.reject(new Error('stop')), { retries: 4, shouldRetry })).rejects.toThrow('stop')
    expect(shouldRetry).toHaveBeenCalledOnce()
    await expect(retry(async () => 'never', 0)).rejects.toThrow(RangeError)
  })

  it('times out and exposes promise resolvers', async () => {
    vi.useFakeTimers()
    const timed = timeout(new Promise(() => {}), 20, 'too slow')
    const timedExpectation = expect(timed).rejects.toThrow('too slow')
    await vi.advanceTimersByTimeAsync(20)
    await timedExpectation

    const deferred = withResolvers<number>()
    deferred.resolve(42)
    await expect(deferred.promise).resolves.toBe(42)
  })
})

describe('controlled functions', () => {
  it('debounces with leading, trailing, pending and flush controls', () => {
    vi.useFakeTimers()
    const callback = vi.fn((value: number) => value * 2)
    const controlled = debounce(callback, 100, { leading: true, trailing: true })

    expect(controlled(2)).toBe(4)
    expect(controlled.pending()).toBe(true)
    controlled(3)
    expect(callback).toHaveBeenCalledOnce()
    expect(controlled.flush()).toBe(6)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(controlled.pending()).toBe(false)
    controlled(4)
    controlled.cancel()
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('throttles repeated calls and honors max wait', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const controlled = throttle(callback, 50)
    controlled('a')
    controlled('b')
    expect(callback).toHaveBeenCalledWith('a')
    vi.advanceTimersByTime(50)
    expect(callback).toHaveBeenLastCalledWith('b')
  })
})

describe('concurrency and memoization', () => {
  it('limits concurrent promise workers and preserves order', async () => {
    let active = 0
    let maxActive = 0
    const values = await promisePool(
      [1, 2, 3, 4],
      async (value) => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active -= 1
        return value * 2
      },
      2
    )

    expect(values).toEqual([2, 4, 6, 8])
    expect(maxActive).toBe(2)
    await expect(promisePool([1], async (value) => value, 0)).rejects.toThrow(RangeError)
  })

  it('memoizes synchronous and asynchronous work', async () => {
    const sync = vi.fn((value: number) => value * 2)
    const memoized = memoize(sync)
    expect(memoized(2)).toBe(4)
    expect(memoized(2)).toBe(4)
    expect(sync).toHaveBeenCalledOnce()
    expect(memoized.delete(2)).toBe(true)
    memoized(2)
    memoized.clear()

    const asyncWork = vi.fn(async (value: number) => value * 3)
    const asyncMemoized = memoizeAsync(asyncWork)
    expect(await Promise.all([asyncMemoized(2), asyncMemoized(2)])).toEqual([6, 6])
    expect(asyncWork).toHaveBeenCalledOnce()

    const rejected = memoizeAsync(async () => Promise.reject(new Error('bad')))
    await expect(rejected()).rejects.toThrow('bad')
    expect(rejected.cache.size).toBe(0)
  })
})
