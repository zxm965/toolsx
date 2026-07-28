import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createAbortGroup,
  createLimiter,
  debounce,
  filterAsync,
  mapAsync,
  memoize,
  memoizeAsync,
  poll,
  promisePool,
  raceWithSignal,
  retry,
  sleep,
  throttle,
  timeout,
  tryCatch,
  withResolvers
} from '../utils'

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
    let jitterAttempts = 0
    await expect(
      retry(
        async () => {
          jitterAttempts += 1
          if (jitterAttempts === 1) throw new Error('retry with jitter')
          return 'jittered'
        },
        { delay: 1, jitter: true, random: () => 0, retries: 1 }
      )
    ).resolves.toBe('jittered')
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

  it('groups cancellation and races promises with signals', async () => {
    const external = new AbortController()
    const group = createAbortGroup(external.signal)
    const pending = raceWithSignal(new Promise(() => {}), group.signal)
    external.abort(new Error('stop'))
    await expect(pending).rejects.toThrow('stop')
    expect(group.signal.aborted).toBe(true)
    await expect(raceWithSignal(Promise.resolve('ok'))).resolves.toBe('ok')

    const aborted = new AbortController()
    aborted.abort()
    await expect(raceWithSignal(Promise.resolve('late'), aborted.signal)).rejects.toMatchObject({ name: 'AbortError' })

    const added = new AbortController()
    const dynamicGroup = createAbortGroup()
    dynamicGroup.add(added.signal)
    added.abort('dynamic')
    expect(dynamicGroup.signal.aborted).toBe(true)
  })

  it('polls until a condition matches', async () => {
    let value = 0
    await expect(
      poll(() => ++value, {
        interval: 0,
        maxAttempts: 3,
        until: (result) => result === 3
      })
    ).resolves.toBe(3)

    await expect(poll(() => 1, { maxAttempts: 1, until: () => false })).rejects.toThrow('max attempts')
    await expect(poll(() => 1, { maxAttempts: 0, until: () => true })).rejects.toThrow(RangeError)
    await expect(poll(() => 1, { timeout: -1, until: () => true })).rejects.toThrow(RangeError)
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

  it('reuses concurrency limiters and supports async collections', async () => {
    const limiter = createLimiter(1)
    const calls: number[] = []
    const first = limiter(async () => {
      calls.push(1)
      await Promise.resolve()
      return 1
    })
    const second = limiter(() => {
      calls.push(2)
      return 2
    })

    expect(limiter.activeCount).toBe(1)
    expect(limiter.pendingCount).toBe(1)
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2])
    expect(calls).toEqual([1, 2])
    await expect(mapAsync([1, 2, 3], async (value) => value * 2, { concurrency: 2 })).resolves.toEqual([2, 4, 6])
    await expect(filterAsync([1, 2, 3, 4], async (value) => value % 2 === 0, { concurrency: 2 })).resolves.toEqual([2, 4])
    expect(() => createLimiter(0)).toThrow(RangeError)

    let release!: () => void
    const queuedLimiter = createLimiter(1)
    const active = queuedLimiter(() => new Promise<void>((resolve) => (release = resolve)))
    const queued = queuedLimiter(() => 'queued')
    queuedLimiter.clearQueue(new Error('cleared'))
    await expect(queued).rejects.toThrow('cleared')
    release()
    await active
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
