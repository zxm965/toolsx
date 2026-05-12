import { FetchError } from 'ofetch'

import type { RequestErrorOptions } from './types'

export class RequestError<T = unknown> extends Error {
  status?: number
  data?: T
  aborted?: boolean
  meta?: RequestErrorOptions<T>['meta']

  constructor(message: string, options: RequestErrorOptions<T> = {}) {
    super(message)
    this.name = 'RequestError'
    this.status = options.status
    this.data = options.data
    this.aborted = options.aborted
    this.meta = options.meta
  }
}

function getErrorMessage(data: unknown) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message
  }

  return undefined
}

export function normalizeRequestError(error: unknown) {
  if (error instanceof RequestError) {
    return error
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new RequestError('Request aborted', { aborted: true })
  }

  if (error instanceof FetchError) {
    return new RequestError(
      getErrorMessage(error.data) ?? error.response?.statusText ?? error.message,
      {
        status: error.response?.status,
        data: error.data,
        aborted: error.name === 'AbortError',
        meta: {
          requestId: error.response?.headers.get('x-request-id') ?? undefined,
          timestamp: Date.now()
        }
      }
    )
  }

  if (error instanceof Error) {
    return new RequestError(error.message, { meta: { timestamp: Date.now() } })
  }

  return new RequestError('Request failed', { meta: { timestamp: Date.now() } })
}

export function isRequestError(error: unknown): error is RequestError {
  return error instanceof RequestError
}
