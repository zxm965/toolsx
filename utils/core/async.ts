import type { AnyFunction } from './type'

export type DebouncedFunction<T extends AnyFunction> = ((...args: Parameters<T>) => void) & { cancel: () => void }
export type ThrottledFunction<T extends AnyFunction> = ((...args: Parameters<T>) => void) & { cancel: () => void }

export const noop = () => {}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function tryCatch<T, TError = unknown>(promise: Promise<T>) {
  try {
    return [await promise, null] as const
  } catch (error) {
    return [null, error as TError] as const
  }
}

export async function retry<T>(fn: () => Promise<T>, times = 3, delay = 0) {
  let lastError: unknown

  for (let attempt = 0; attempt < times; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (delay > 0 && attempt < times - 1) {
        await sleep(delay)
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

export function debounce<T extends AnyFunction>(fn: T, wait = 0): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = ((...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, wait)
  }) as DebouncedFunction<T>

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return debounced
}

export function throttle<T extends AnyFunction>(fn: T, wait = 0): ThrottledFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined

  const run = () => {
    if (!lastArgs) {
      timer = undefined
      return
    }

    const args = lastArgs
    lastArgs = undefined
    fn(...args)
    timer = setTimeout(run, wait)
  }

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args

    if (!timer) {
      run()
    }
  }) as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = undefined
    lastArgs = undefined
  }

  return throttled
}
