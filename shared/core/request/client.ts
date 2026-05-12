import { FetchError, ofetch } from 'ofetch'

import { RequestError, normalizeRequestError } from './errors'
import type {
  CreateRequestOptions,
  FetchRequest,
  FetchResponse,
  MappedResponseType,
  RequestOptions,
  RequestResult,
  RequestInstance,
  ResponseType
} from './types'
import { mergeHeaders, mergeSignals } from './utils'

const defaultConfig: CreateRequestOptions = {
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
}

function resolveMethodOptions<R extends ResponseType, T = unknown, TResult = MappedResponseType<R, T>>(
  method: string,
  options?: RequestOptions<R, T, TResult>
) {
  return { ...options, method } satisfies RequestOptions<R, T, TResult>
}

async function applyTransform<R extends ResponseType, T = unknown, TResult = MappedResponseType<R, T>>(
  data: MappedResponseType<R, T>,
  options?: RequestOptions<R, T, TResult>
) {
  if (!options?.transform) {
    return data as TResult
  }

  return await options.transform(data)
}

function getErrorHeaders(error: unknown) {
  return error instanceof FetchError ? (error.response?.headers ?? null) : null
}

export function createRequestClient(config: CreateRequestOptions = {}): RequestInstance {
  const mergedConfig: CreateRequestOptions = {
    ...defaultConfig,
    ...config,
    headers: mergeHeaders(defaultConfig.headers, config.headers)
  }

  const client = ofetch.create({
    baseURL: mergedConfig.baseURL,
    timeout: mergedConfig.timeout,
    headers: mergedConfig.headers,
    retry: 0
  })

  const request = (async <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options: RequestOptions<R, T, TResult> = {}
  ) => {
    try {
      const token = await mergedConfig.getToken?.()
      const nextOptions = (await mergedConfig.onRequest?.(url, options)) ?? options
      const headers = mergeHeaders(nextOptions.headers, token ? { Authorization: `Bearer ${token}` } : undefined)
      const rawResponse = await client.raw<T, R>(url, { ...nextOptions, headers })
      const data = rawResponse._data as MappedResponseType<R, T>
      const response = await applyTransform<R, T, TResult>(data, options)

      return { response, headers: rawResponse.headers, error: null }
    } catch (error) {
      return {
        response: null,
        headers: getErrorHeaders(error),
        error: normalizeRequestError(error)
      }
    }
  }) as RequestInstance

  request.raw = async <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options: RequestOptions<R, T> = {}
  ): Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>> => {
    try {
      const token = await mergedConfig.getToken?.()
      const nextOptions = (await mergedConfig.onRequest?.(url, options)) ?? options
      const headers = mergeHeaders(nextOptions.headers, token ? { Authorization: `Bearer ${token}` } : undefined)

      const response = await client.raw<T, R>(url, { ...nextOptions, headers })

      return { response, headers: response.headers, error: null }
    } catch (error) {
      return {
        response: null,
        headers: getErrorHeaders(error),
        error: normalizeRequestError(error)
      }
    }
  }

  request.createAbortController = () => new AbortController()
  request.isAbortError = (error: unknown) => error instanceof RequestError && error.aborted === true
  request.withAbort = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => {
    const controller = new AbortController()

    return {
      controller,
      abort: () => controller.abort(),
      promise: request<T, R, TResult>(url, {
        ...options,
        signal: mergeSignals(options?.signal, controller.signal)
      })
    }
  }

  request.get = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => request<T, R, TResult>(url, resolveMethodOptions('GET', options))
  request.post = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => request<T, R, TResult>(url, resolveMethodOptions('POST', options))
  request.put = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => request<T, R, TResult>(url, resolveMethodOptions('PUT', options))
  request.patch = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => request<T, R, TResult>(url, resolveMethodOptions('PATCH', options))
  request.delete = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => request<T, R, TResult>(url, resolveMethodOptions('DELETE', options))

  request.abortable = {
    get: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions('GET', options)),
    post: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions('POST', options)),
    put: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions('PUT', options)),
    patch: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions('PATCH', options)),
    delete: <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions('DELETE', options))
  }

  return request
}

export let request = createRequestClient()

export function setRequestClient(nextRequest: RequestInstance) {
  request = nextRequest

  return request
}
