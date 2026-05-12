import type { RequestAuthOptions, RequestFailure, RequestResult, RequestSuccess, TokenValue } from './types'

export type QueryValue = string | number | boolean | Date | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

export function mergeHeaders(source?: HeadersInit, extra?: HeadersInit) {
  const headers = new Headers(source)
  const append = new Headers(extra)

  append.forEach((value, key) => {
    headers.set(key, value)
  })

  return headers
}

export function omitHeaders(source: HeadersInit | undefined, names: string[]) {
  const headers = new Headers(source)

  for (const name of names) {
    headers.delete(name)
  }

  return headers
}

export function headersToObject(headers?: HeadersInit) {
  const result: Record<string, string> = {}

  new Headers(headers).forEach((value, key) => {
    result[key] = value
  })

  return result
}

export function getHeader(headers: HeadersInit | null | undefined, name: string) {
  return headers ? new Headers(headers).get(name) : null
}

export function createAuthorizationHeader(token: TokenValue, auth: false | RequestAuthOptions = {}) {
  if (!token || auth === false) {
    return undefined
  }

  const header = auth.header ?? 'Authorization'
  const type = auth.type ?? 'Bearer'
  const value = type ? `${type} ${token}` : token

  return { [header]: value }
}

function normalizeQueryValue(value: QueryValue) {
  if (value === null || value === undefined) {
    return undefined
  }

  return value instanceof Date ? value.toISOString() : String(value)
}

export function createQueryString(params: QueryParams = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    const values = Array.isArray(value) ? value : [value]

    for (const item of values) {
      const normalizedValue = normalizeQueryValue(item)

      if (normalizedValue !== undefined) {
        searchParams.append(key, normalizedValue)
      }
    }
  })

  return searchParams.toString()
}

export function appendQuery(url: string, params: QueryParams = {}) {
  const queryString = createQueryString(params)

  if (!queryString) {
    return url
  }

  const [path, hash = ''] = url.split('#')
  const separator = path.includes('?') ? '&' : '?'
  const nextUrl = `${path}${separator}${queryString}`

  return hash ? `${nextUrl}#${hash}` : nextUrl
}

export function mergeSignals(...signals: (AbortSignal | null | undefined)[]) {
  const validSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal))

  if (validSignals.length <= 1) {
    return validSignals[0]
  }

  const controller = new AbortController()
  const abort = (event: Event) => controller.abort((event.target as AbortSignal).reason)

  for (const signal of validSignals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }

    signal.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

export function createTimeoutSignal(timeout?: number, reason: unknown = new DOMException('Request timeout', 'TimeoutError')) {
  if (!timeout || timeout <= 0) {
    return undefined
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(reason), timeout)

  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })

  return controller.signal
}

export function createRequestId(prefix = 'req') {
  const random = Math.random().toString(36).slice(2, 10)

  return `${prefix}_${Date.now().toString(36)}_${random}`
}

export function isRequestSuccess<T>(result: RequestResult<T>): result is RequestSuccess<T> {
  return result.error === null
}

export function isRequestFailure<T>(result: RequestResult<T>): result is RequestFailure {
  return result.error !== null
}

export function mapRequestResult<T, TResult>(result: RequestResult<T>, transform: (response: T) => TResult): RequestResult<TResult> {
  if (isRequestFailure(result)) {
    return result
  }

  return {
    response: transform(result.response),
    headers: result.headers,
    status: result.status,
    error: null
  }
}

export async function unwrapRequestResult<T>(request: Promise<RequestResult<T>> | RequestResult<T>) {
  const { response, error } = await request

  if (error) {
    throw error
  }

  return response
}
