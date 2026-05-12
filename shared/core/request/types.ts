import type { FetchOptions, FetchRequest, FetchResponse, MappedResponseType, ResponseType } from 'ofetch'

import type { RequestError } from './errors'

export type { FetchOptions, FetchRequest, FetchResponse, MappedResponseType, ResponseType }

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
export type TokenValue = string | null | undefined
export type TokenGetter = () => TokenValue | Promise<TokenValue>

export interface RequestOptions<R extends ResponseType = 'json', T = unknown, TResult = MappedResponseType<R, T>> extends FetchOptions<R> {
  transform?: (data: MappedResponseType<R, T>) => TResult | Promise<TResult>
  validateResponse?: (
    data: MappedResponseType<R, T>,
    response: FetchResponse<MappedResponseType<R, T>>
  ) => boolean | string | RequestError | void | Promise<boolean | string | RequestError | void>
}

export interface RequestMeta {
  requestId?: string
  timestamp: number
  url?: string
  method?: string
}

export interface RequestErrorOptions<T = unknown> {
  status?: number
  data?: T
  aborted?: boolean
  meta?: RequestMeta
  cause?: unknown
}

export interface RequestSuccess<T> {
  response: T
  headers: Headers
  status?: number
  error: null
}

export interface RequestFailure<TError extends RequestError = RequestError> {
  response: null
  headers: Headers | null
  status?: number
  error: TError
}

export type RequestResult<T, TError extends RequestError = RequestError> = RequestSuccess<T> | RequestFailure<TError>

export interface RequestHookContext<R extends ResponseType = ResponseType> {
  url: FetchRequest
  options: FetchOptions<R>
}

export interface ResponseHookContext<T = unknown, R extends ResponseType = ResponseType> extends RequestHookContext<R> {
  response: FetchResponse<T>
  data: T
}

export interface RequestErrorHookContext<R extends ResponseType = ResponseType> extends RequestHookContext<R> {
  error: RequestError
}

export interface RequestAuthOptions {
  header?: string
  type?: string
}

export interface CreateRequestOptions extends Omit<FetchOptions<ResponseType>, 'headers' | 'onRequest' | 'onRequestError' | 'onResponse' | 'onResponseError'> {
  getToken?: TokenGetter
  headers?: HeadersInit
  auth?: false | RequestAuthOptions
  onRequest?: <R extends ResponseType>(context: RequestHookContext<R>) => FetchOptions<R> | void | Promise<FetchOptions<R> | void>
  onResponse?: <T = unknown, R extends ResponseType = ResponseType>(context: ResponseHookContext<T, R>) => void | Promise<void>
  onError?: <R extends ResponseType = ResponseType>(context: RequestErrorHookContext<R>) => void | Promise<void>
}

export interface AbortableRequest<T> {
  controller: AbortController
  abort: (reason?: unknown) => void
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

export interface RequestInstance {
  <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ): Promise<RequestResult<TResult>>
  raw: <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options?: FetchOptions<R>
  ) => Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>>
  get: RequestShortcut
  post: RequestShortcut
  put: RequestShortcut
  patch: RequestShortcut
  delete: RequestShortcut
  head: RequestShortcut
  options: RequestShortcut
  withAbort: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => AbortableRequest<RequestResult<TResult>>
  abortable: {
    get: AbortableRequestShortcut
    post: AbortableRequestShortcut
    put: AbortableRequestShortcut
    patch: AbortableRequestShortcut
    delete: AbortableRequestShortcut
    head: AbortableRequestShortcut
    options: AbortableRequestShortcut
  }
  createAbortController: () => AbortController
  isAbortError: (error: unknown) => boolean
}
