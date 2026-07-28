import type { FetchOptions, FetchRequest, FetchResponse, MappedResponseType, ResponseType } from 'ofetch'

import type { RequestError } from './errors'

export type { FetchOptions, FetchRequest, FetchResponse, MappedResponseType, ResponseType }

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type TokenValue = string | null | undefined
export type TokenGetter = () => TokenValue | Promise<TokenValue>
export type RequestProgressPhase = 'upload' | 'download'

export interface RequestProgress {
  done: boolean
  loaded: number
  percent?: number
  phase: RequestProgressPhase
  total?: number
}

export type RequestProgressHandler = (progress: RequestProgress) => void

export interface RequestRetryContext {
  attempt: number
  error: RequestError
  method: RequestMethod
  retriesLeft: number
  status?: number
  url: FetchRequest
}

export interface RequestRetryOptions {
  delay?: number | ((context: RequestRetryContext) => number)
  factor?: number
  jitter?: boolean | ((delay: number, context: RequestRetryContext) => number)
  maxDelay?: number
  methods?: readonly RequestMethod[]
  onRetry?: (context: RequestRetryContext & { delay: number }) => void | Promise<void>
  retries?: number
  shouldRetry?: (context: RequestRetryContext) => boolean | Promise<boolean>
  statusCodes?: readonly number[]
}

export interface ResponseCacheOptions {
  invalidateOnMutation?: boolean
  methods?: readonly RequestMethod[]
  ttl?: number
}

export interface RequestOptions<R extends ResponseType = 'json', T = unknown, TResult = MappedResponseType<R, T>> extends FetchOptions<R> {
  cacheKey?: string
  dedupe?: boolean
  dedupeKey?: string
  onDownloadProgress?: RequestProgressHandler
  onUploadProgress?: RequestProgressHandler
  responseCache?: boolean | ResponseCacheOptions
  retryPolicy?: false | RequestRetryOptions
  skipAuthRefresh?: boolean
  transform?: (data: MappedResponseType<R, T>) => TResult | Promise<TResult>
  validateResponse?: (
    data: MappedResponseType<R, T>,
    response: FetchResponse<MappedResponseType<R, T>>
  ) => boolean | string | RequestError | void | Promise<boolean | string | RequestError | void>
}

export interface RawRequestOptions<R extends ResponseType = 'json'> extends FetchOptions<R> {
  onDownloadProgress?: RequestProgressHandler
  onUploadProgress?: RequestProgressHandler
}

export interface RequestMeta {
  attempts: number
  deduped?: boolean
  duration: number
  fromCache?: boolean
  method: RequestMethod
  requestId: string
  timestamp: number
  url: string
}

export interface RequestErrorOptions<T = unknown> {
  aborted?: boolean
  cause?: unknown
  data?: T
  meta?: Partial<RequestMeta>
  status?: number
}

export interface RequestSuccess<T> {
  error: null
  headers: Headers
  meta: RequestMeta
  response: T
  status?: number
}

export interface RequestFailure<TError extends RequestError = RequestError> {
  error: TError
  headers: Headers | null
  meta: RequestMeta
  response: null
  status?: number
}

export type RequestResult<T, TError extends RequestError = RequestError> = RequestSuccess<T> | RequestFailure<TError>

export interface RequestHookContext<R extends ResponseType = ResponseType> {
  options: FetchOptions<R>
  requestId: string
  url: FetchRequest
}

export interface ResponseHookContext<T = unknown, R extends ResponseType = ResponseType> extends RequestHookContext<R> {
  data: T
  response: FetchResponse<T>
}

export interface RequestErrorHookContext<R extends ResponseType = ResponseType> extends RequestHookContext<R> {
  error: RequestError
  meta: RequestMeta
}

export interface RequestAuthOptions {
  header?: string
  type?: string
}

export interface TokenRefreshContext {
  error: RequestError
  failedToken: TokenValue
  requestId: string
  url: FetchRequest
}

export interface RequestTrace extends RequestMeta {
  error?: RequestError
  status?: number
}

export interface RequestMiddlewareContext {
  options: RequestOptions<ResponseType, unknown, unknown>
  requestId: string
  url: FetchRequest
}

export type RequestMiddleware = (context: RequestMiddlewareContext, next: () => Promise<RequestResult<unknown>>) => Promise<RequestResult<unknown>>

export interface CreateRequestOptions extends Omit<FetchOptions<ResponseType>, 'headers' | 'onRequest' | 'onRequestError' | 'onResponse' | 'onResponseError'> {
  auth?: false | RequestAuthOptions
  concurrency?: number
  dedupe?: boolean
  fetch?: typeof globalThis.fetch
  getToken?: TokenGetter
  headers?: HeadersInit
  middlewares?: readonly RequestMiddleware[]
  onError?: <R extends ResponseType = ResponseType>(context: RequestErrorHookContext<R>) => void | Promise<void>
  onRequest?: <R extends ResponseType>(context: RequestHookContext<R>) => FetchOptions<R> | void | Promise<FetchOptions<R> | void>
  onResponse?: <T = unknown, R extends ResponseType = ResponseType>(context: ResponseHookContext<T, R>) => void | Promise<void>
  onTrace?: (trace: RequestTrace) => void | Promise<void>
  refreshToken?: (context: TokenRefreshContext) => TokenValue | Promise<TokenValue>
  requestIdHeader?: false | string
  responseCache?: false | ResponseCacheOptions
  retryPolicy?: false | RequestRetryOptions
  shouldRefreshToken?: (context: TokenRefreshContext) => boolean | Promise<boolean>
}

export interface AbortableRequest<T> {
  abort: (reason?: unknown) => void
  controller: AbortController
  promise: Promise<T>
}

export type RequestShortcut = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
  url: FetchRequest,
  options?: RequestOptions<R, T, TResult>
) => Promise<RequestResult<TResult>>

export type AbortableRequestShortcut = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
  url: FetchRequest,
  options?: RequestOptions<R, T, TResult>
) => AbortableRequest<RequestResult<TResult>>

export interface RequestCacheController {
  clear: () => void
  delete: (key: string) => boolean
  has: (key: string) => boolean
  keys: () => string[]
  readonly size: number
}

export interface RequestInstance {
  <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ): Promise<RequestResult<TResult>>
  abortable: {
    delete: AbortableRequestShortcut
    get: AbortableRequestShortcut
    head: AbortableRequestShortcut
    options: AbortableRequestShortcut
    patch: AbortableRequestShortcut
    post: AbortableRequestShortcut
    put: AbortableRequestShortcut
  }
  cache: RequestCacheController
  createAbortController: () => AbortController
  delete: RequestShortcut
  get: RequestShortcut
  head: RequestShortcut
  invalidateCache: <R extends ResponseType = 'json'>(url: FetchRequest, options?: RequestOptions<R>) => Promise<boolean>
  isAbortError: (error: unknown) => boolean
  options: RequestShortcut
  patch: RequestShortcut
  post: RequestShortcut
  put: RequestShortcut
  raw: <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options?: RawRequestOptions<R>
  ) => Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>>
  use: (middleware: RequestMiddleware) => () => void
  withAbort: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => AbortableRequest<RequestResult<TResult>>
}
