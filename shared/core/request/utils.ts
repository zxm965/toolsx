import type { RequestResult } from './types'

export function mergeHeaders(source?: HeadersInit, extra?: HeadersInit) {
  const headers = new Headers(source)
  const append = new Headers(extra)

  append.forEach((value, key) => {
    headers.set(key, value)
  })

  return headers
}

export function mergeSignals(...signals: (AbortSignal | null | undefined)[]) {
  const validSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal))

  if (validSignals.length <= 1) {
    return validSignals[0]
  }

  const controller = new AbortController()
  const abort = () => controller.abort()

  for (const signal of validSignals) {
    if (signal.aborted) {
      abort()
      break
    }

    signal.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

export async function unwrapRequestResult<T>(request: Promise<RequestResult<T>>) {
  const { response, error } = await request

  if (error) {
    throw error
  }

  return response
}
