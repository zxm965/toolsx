import type {
  FetchOptions,
  FetchRequest,
  FetchResponse,
  MappedResponseType,
  ResponseType
} from 'ofetch'

import type { RequestError } from './errors'

export type { FetchOptions, FetchRequest, FetchResponse, MappedResponseType, ResponseType }

export type TokenValue = string | null | undefined
export type TokenGetter = () => TokenValue | Promise<TokenValue>

export interface RequestOptions<
  R extends ResponseType = 'json',
  T = unknown,
  TResult = MappedResponseType<R, T>
> extends FetchOptions<R> {
  transform?: (data: MappedResponseType<R, T>) => TResult | Promise<TResult>
}

export interface RequestMeta {
  requestId?: string
  timestamp: number
}

export interface RequestErrorOptions<T = unknown> {
  status?: number
  data?: T
  aborted?: boolean
  meta?: RequestMeta
}

export type RequestResult<T, TError extends RequestError = RequestError> =
  | { response: T; headers: Headers; error: null }
  | { response: null; headers: Headers | null; error: TError }

export interface CreateRequestOptions {
  baseURL?: string
  timeout?: number
  getToken?: TokenGetter
  headers?: HeadersInit
  onRequest?: <R extends ResponseType>(
    request: FetchRequest,
    options: FetchOptions<R>
  ) => FetchOptions<R> | void | Promise<FetchOptions<R> | void>
}

export interface AbortableRequest<T> {
  controller: AbortController
  abort: () => void
  promise: Promise<T>
}

export interface RequestInstance {
  <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ): Promise<RequestResult<TResult>>
  raw: <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options?: FetchOptions<R>
  ) => Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>>
  get: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => Promise<RequestResult<TResult>>
  post: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => Promise<RequestResult<TResult>>
  put: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => Promise<RequestResult<TResult>>
  patch: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => Promise<RequestResult<TResult>>
  delete: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => Promise<RequestResult<TResult>>
  withAbort: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => AbortableRequest<RequestResult<TResult>>
  abortable: {
    get: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
      url: FetchRequest,
      options?: RequestOptions<R, T, TResult>
    ) => AbortableRequest<RequestResult<TResult>>
    post: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
      url: FetchRequest,
      options?: RequestOptions<R, T, TResult>
    ) => AbortableRequest<RequestResult<TResult>>
    put: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
      url: FetchRequest,
      options?: RequestOptions<R, T, TResult>
    ) => AbortableRequest<RequestResult<TResult>>
    patch: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
      url: FetchRequest,
      options?: RequestOptions<R, T, TResult>
    ) => AbortableRequest<RequestResult<TResult>>
    delete: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
      url: FetchRequest,
      options?: RequestOptions<R, T, TResult>
    ) => AbortableRequest<RequestResult<TResult>>
  }
  createAbortController: () => AbortController
  isAbortError: (error: unknown) => boolean
}
