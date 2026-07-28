import type { AnyFunction, RandomSource } from './type'

export type Awaitable<T> = T | PromiseLike<T>

export interface DebounceOptions {
  leading?: boolean
  maxWait?: number
  trailing?: boolean
}

export interface ThrottleOptions {
  leading?: boolean
  trailing?: boolean
}

export interface ControlledFunction<TResult> {
  cancel: () => void
  flush: () => TResult | undefined
  pending: () => boolean
}

export type DebouncedFunction<T extends AnyFunction> = ((...args: Parameters<T>) => ReturnType<T> | undefined) & ControlledFunction<ReturnType<T>>
export type ThrottledFunction<T extends AnyFunction> = DebouncedFunction<T>

export interface RetryContext {
  attempt: number
  retriesLeft: number
  signal?: AbortSignal
}

export interface RetryOptions {
  delay?: number | ((context: RetryContext & { error: unknown }) => number)
  factor?: number
  jitter?: boolean | ((delay: number, context: RetryContext & { error: unknown }) => number)
  maxDelay?: number
  random?: RandomSource
  retries?: number
  shouldRetry?: (error: unknown, context: RetryContext) => boolean | Promise<boolean>
  signal?: AbortSignal
}

export interface PromisePoolOptions {
  signal?: AbortSignal
}

export interface AsyncCollectionOptions extends PromisePoolOptions {
  concurrency?: number
}

export interface PollContext {
  attempt: number
  elapsed: number
  signal: AbortSignal
}

export interface PollOptions<T> {
  interval?: number | ((context: PollContext & { value: T }) => number)
  maxAttempts?: number
  signal?: AbortSignal
  timeout?: number
  until: (value: T, context: PollContext) => boolean | Promise<boolean>
}

export interface AbortGroup {
  abort: (reason?: unknown) => void
  add: (signal: AbortSignal | null | undefined) => () => void
  controller: AbortController
  signal: AbortSignal
}

export interface ConcurrencyLimiter {
  <T>(task: () => Awaitable<T>, signal?: AbortSignal): Promise<T>
  readonly activeCount: number
  clearQueue: (reason?: unknown) => void
  readonly pendingCount: number
}

export interface MemoizedFunction<T extends AnyFunction, TKey> {
  (...args: Parameters<T>): ReturnType<T>
  cache: Map<TKey, ReturnType<T>>
  clear: () => void
  delete: (key: TKey) => boolean
}

export interface MemoizeOptions<T extends AnyFunction, TKey> {
  cache?: Map<TKey, ReturnType<T>>
  resolver?: (...args: Parameters<T>) => TKey
}

export interface MemoizeAsyncOptions<T extends (...args: never[]) => Promise<unknown>, TKey> {
  cacheRejected?: boolean
  resolver?: (...args: Parameters<T>) => TKey
  ttl?: number
}

export interface MemoizeAsyncCacheEntry<TPromise extends Promise<unknown>> {
  expiresAt: number
  promise: TPromise
}

export type MemoizedAsyncFunction<T extends (...args: never[]) => Promise<unknown>, TKey> = T & {
  cache: Map<TKey, MemoizeAsyncCacheEntry<ReturnType<T>>>
  clear: () => void
  delete: (key: TKey) => boolean
}

function createAbortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) {
    return signal.reason
  }

  return new DOMException('Operation aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError(signal)
  }
}

export function sleep(ms: number, signal?: AbortSignal) {
  throwIfAborted(signal)

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        signal?.removeEventListener('abort', abort)
        resolve()
      },
      Math.max(0, ms)
    )

    const abort = () => {
      clearTimeout(timer)
      reject(createAbortError(signal))
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

export async function tryCatch<T, TError = unknown>(promise: Promise<T>) {
  try {
    return [await promise, null] as const
  } catch (error) {
    return [null, error as TError] as const
  }
}

export async function retry<T>(fn: (context: RetryContext) => Promise<T>, options?: RetryOptions): Promise<T>
export async function retry<T>(fn: (context: RetryContext) => Promise<T>, times?: number, delay?: number): Promise<T>
export async function retry<T>(fn: (context: RetryContext) => Promise<T>, timesOrOptions: number | RetryOptions = 3, legacyDelay = 0): Promise<T> {
  const legacy = typeof timesOrOptions === 'number'
  const options = legacy ? { delay: legacyDelay, retries: timesOrOptions - 1 } : timesOrOptions
  const retries = Math.max(0, options.retries ?? 2)
  const maxAttempts = retries + 1

  if (legacy && timesOrOptions <= 0) {
    throw new RangeError('times must be greater than 0')
  }

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const context: RetryContext = { attempt, retriesLeft: maxAttempts - attempt, signal: options.signal }
    throwIfAborted(options.signal)

    try {
      return await fn(context)
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts || (options.shouldRetry && !(await options.shouldRetry(error, context)))) {
        throw error
      }

      const delayContext = { ...context, error }
      const baseDelay = typeof options.delay === 'function' ? options.delay(delayContext) : (options.delay ?? 0) * Math.pow(options.factor ?? 1, attempt - 1)
      const cappedDelay = Math.min(Math.max(0, baseDelay), options.maxDelay ?? Number.POSITIVE_INFINITY)
      const wait =
        typeof options.jitter === 'function'
          ? options.jitter(cappedDelay, delayContext)
          : options.jitter
            ? (options.random ?? Math.random)() * cappedDelay
            : cappedDelay

      if (wait > 0) {
        await sleep(wait, options.signal)
      }
    }
  }

  throw lastError
}

export function timeout<T>(promise: Promise<T>, ms: number, message = 'Operation timeout') {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

export function withResolvers<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

export function raceWithSignal<T>(promise: PromiseLike<T>, signal?: AbortSignal) {
  if (!signal) return Promise.resolve(promise)
  if (signal.aborted) return Promise.reject(createAbortError(signal))

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(createAbortError(signal))
    signal.addEventListener('abort', abort, { once: true })

    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
  })
}

export function createAbortGroup(...signals: (AbortSignal | null | undefined)[]): AbortGroup {
  const controller = new AbortController()
  const cleanups = new Set<() => void>()

  const clear = () => {
    cleanups.forEach((cleanup) => cleanup())
    cleanups.clear()
  }

  controller.signal.addEventListener('abort', clear, { once: true })

  const add = (signal: AbortSignal | null | undefined) => {
    if (!signal || controller.signal.aborted) return () => {}

    if (signal.aborted) {
      controller.abort(signal.reason)
      return () => {}
    }

    const abort = () => controller.abort(signal.reason)
    const cleanup = () => {
      signal.removeEventListener('abort', abort)
      cleanups.delete(cleanup)
    }

    signal.addEventListener('abort', abort, { once: true })
    cleanups.add(cleanup)
    return cleanup
  }

  signals.forEach(add)

  return {
    abort: (reason?: unknown) => controller.abort(reason),
    add,
    controller,
    signal: controller.signal
  }
}

interface LimiterQueueEntry<T> {
  reject: (reason?: unknown) => void
  resolve: (value: T | PromiseLike<T>) => void
  signal?: AbortSignal
  task: () => Awaitable<T>
  unsubscribe?: () => void
}

export function createLimiter(concurrency: number): ConcurrencyLimiter {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new RangeError('concurrency must be a positive integer')
  }

  let activeCount = 0
  const queue: LimiterQueueEntry<unknown>[] = []

  const runNext = () => {
    while (activeCount < concurrency && queue.length) {
      const entry = queue.shift()!
      entry.unsubscribe?.()

      if (entry.signal?.aborted) {
        entry.reject(createAbortError(entry.signal))
        continue
      }

      activeCount += 1
      Promise.resolve()
        .then(entry.task)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          activeCount -= 1
          runNext()
        })
    }
  }

  const limit = (<T>(task: () => Awaitable<T>, signal?: AbortSignal) => {
    if (signal?.aborted) return Promise.reject(createAbortError(signal))

    return new Promise<T>((resolve, reject) => {
      const entry: LimiterQueueEntry<T> = { reject, resolve, signal, task }

      if (signal) {
        const abort = () => {
          const index = queue.indexOf(entry as LimiterQueueEntry<unknown>)
          if (index >= 0) queue.splice(index, 1)
          reject(createAbortError(signal))
        }
        signal.addEventListener('abort', abort, { once: true })
        entry.unsubscribe = () => signal.removeEventListener('abort', abort)
      }

      queue.push(entry as LimiterQueueEntry<unknown>)
      runNext()
    })
  }) as ConcurrencyLimiter

  Object.defineProperties(limit, {
    activeCount: { get: () => activeCount },
    pendingCount: { get: () => queue.length }
  })

  limit.clearQueue = (reason = new Error('Concurrency limiter queue cleared')) => {
    const entries = queue.splice(0)
    entries.forEach((entry) => {
      entry.unsubscribe?.()
      entry.reject(reason)
    })
  }

  return limit
}

export async function poll<T>(fn: (context: PollContext) => Awaitable<T>, options: PollOptions<T>) {
  const { maxAttempts, timeout: timeoutDuration } = options

  if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || maxAttempts <= 0)) {
    throw new RangeError('maxAttempts must be a positive integer')
  }
  if (timeoutDuration !== undefined && (!Number.isFinite(timeoutDuration) || timeoutDuration < 0)) {
    throw new RangeError('timeout must be a non-negative finite number')
  }

  const startedAt = Date.now()
  const group = createAbortGroup(options.signal)
  const timer = timeoutDuration === undefined ? undefined : setTimeout(() => group.abort(new Error('Polling timed out')), timeoutDuration)

  try {
    for (let attempt = 1; ; attempt += 1) {
      const context: PollContext = { attempt, elapsed: Math.max(0, Date.now() - startedAt), signal: group.signal }
      const value = await raceWithSignal(Promise.resolve(fn(context)), group.signal)

      if (await raceWithSignal(Promise.resolve(options.until(value, context)), group.signal)) return value
      if (maxAttempts !== undefined && attempt >= maxAttempts) throw new Error('Polling reached max attempts')

      const interval = typeof options.interval === 'function' ? options.interval({ ...context, value }) : (options.interval ?? 0)
      if (!Number.isFinite(interval) || interval < 0) throw new RangeError('poll interval must be a non-negative finite number')
      if (interval > 0) await sleep(interval, group.signal)
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function debounce<T extends AnyFunction>(fn: T, wait = 0, options: DebounceOptions = {}): DebouncedFunction<T> {
  const { leading = false, maxWait, trailing = true } = options
  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: unknown
  let result: ReturnType<T> | undefined

  const invoke = () => {
    if (!lastArgs) return result

    const args = lastArgs
    const thisArg = lastThis
    lastArgs = undefined
    lastThis = undefined
    result = fn.apply(thisArg, args) as ReturnType<T>
    return result
  }

  const clearTimers = () => {
    if (timer) clearTimeout(timer)
    if (maxTimer) clearTimeout(maxTimer)
    timer = undefined
    maxTimer = undefined
  }

  const finish = () => {
    timer = undefined
    if (trailing) invoke()
    if (maxTimer) clearTimeout(maxTimer)
    maxTimer = undefined
  }

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    const shouldInvokeLeading = leading && !timer
    lastArgs = args
    // oxlint-disable-next-line typescript/no-this-alias -- Debounce must preserve the caller's dynamic receiver until invocation.
    lastThis = this

    if (timer) clearTimeout(timer)
    timer = setTimeout(finish, Math.max(0, wait))

    if (maxWait !== undefined && maxWait >= 0 && !maxTimer) {
      maxTimer = setTimeout(() => {
        if (timer) clearTimeout(timer)
        timer = undefined
        maxTimer = undefined
        invoke()
      }, maxWait)
    }

    if (shouldInvokeLeading) invoke()

    return result
  } as DebouncedFunction<T>

  debounced.cancel = () => {
    clearTimers()
    lastArgs = undefined
    lastThis = undefined
  }
  debounced.flush = () => {
    if (!timer && !maxTimer) return result
    clearTimers()
    return trailing ? invoke() : result
  }
  debounced.pending = () => Boolean(timer || maxTimer)

  return debounced
}

export function throttle<T extends AnyFunction>(fn: T, wait = 0, options: ThrottleOptions = {}): ThrottledFunction<T> {
  return debounce(fn, wait, {
    leading: options.leading ?? true,
    maxWait: wait,
    trailing: options.trailing ?? true
  })
}

export async function promisePool<T, TResult>(
  items: readonly T[],
  worker: (item: T, index: number, signal?: AbortSignal) => Promise<TResult>,
  concurrency = Number.POSITIVE_INFINITY,
  options: PromisePoolOptions = {}
) {
  if (concurrency <= 0) {
    throw new RangeError('concurrency must be greater than 0')
  }

  const results = Array.from({ length: items.length }) as TResult[]
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      throwIfAborted(options.signal)
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index], index, options.signal)
    }
  }

  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, runWorker))

  return results
}

export function mapAsync<T, TResult>(
  items: readonly T[],
  mapper: (item: T, index: number, signal?: AbortSignal) => Awaitable<TResult>,
  options: AsyncCollectionOptions = {}
) {
  return promisePool(items, async (item, index, signal) => await mapper(item, index, signal), options.concurrency, options)
}

export async function filterAsync<T>(
  items: readonly T[],
  predicate: (item: T, index: number, signal?: AbortSignal) => Awaitable<boolean>,
  options: AsyncCollectionOptions = {}
) {
  const matches = await mapAsync(items, predicate, options)
  return items.filter((_, index) => matches[index])
}

function defaultMemoizeResolver(args: readonly unknown[]) {
  return args[0]
}

export function memoize<T extends AnyFunction, TKey = Parameters<T>[0]>(fn: T, options: MemoizeOptions<T, TKey> = {}): MemoizedFunction<T, TKey> {
  const cache = options.cache ?? new Map<TKey, ReturnType<T>>()
  const resolver = options.resolver ?? ((...args: Parameters<T>) => defaultMemoizeResolver(args) as TKey)

  const memoized = ((...args: Parameters<T>) => {
    const key = resolver(...args)

    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>
    }

    const result = fn(...args) as ReturnType<T>
    cache.set(key, result)
    return result
  }) as MemoizedFunction<T, TKey>

  memoized.cache = cache
  memoized.clear = () => cache.clear()
  memoized.delete = (key) => cache.delete(key)

  return memoized
}

export function memoizeAsync<T extends (...args: never[]) => Promise<unknown>, TKey = Parameters<T>[0]>(fn: T, options: MemoizeAsyncOptions<T, TKey> = {}) {
  const cache = new Map<TKey, MemoizeAsyncCacheEntry<ReturnType<T>>>()
  const resolver = options.resolver ?? ((...args: Parameters<T>) => defaultMemoizeResolver(args) as TKey)

  const memoized = ((...args: Parameters<T>) => {
    const key = resolver(...args)
    const cached = cache.get(key)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise
    }

    const promise = fn(...args) as ReturnType<T>
    cache.set(key, { expiresAt: options.ttl === undefined ? Number.POSITIVE_INFINITY : Date.now() + Math.max(0, options.ttl), promise })

    if (!options.cacheRejected) {
      promise.catch(() => cache.delete(key))
    }

    return promise
  }) as unknown as MemoizedAsyncFunction<T, TKey>

  memoized.cache = cache
  memoized.clear = () => cache.clear()
  memoized.delete = (key) => cache.delete(key)

  return memoized
}
