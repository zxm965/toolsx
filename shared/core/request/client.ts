import { FetchError, ofetch } from 'ofetch'

import { RequestError, normalizeRequestError } from './errors'
import type {
  CreateRequestOptions,
  FetchOptions,
  FetchRequest,
  FetchResponse,
  MappedResponseType,
  RequestFailure,
  RequestInstance,
  RequestMethod,
  RequestOptions,
  RequestResult,
  ResponseType
} from './types'
import { createAuthorizationHeader, mergeHeaders, mergeSignals } from './utils'

const defaultConfig: CreateRequestOptions = {
  timeout: 15_000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  retry: 0
}

function resolveMethodOptions<R extends ResponseType, T = unknown, TResult = MappedResponseType<R, T>>(
  method: RequestMethod,
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

async function validateResponse<R extends ResponseType, T = unknown, TResult = MappedResponseType<R, T>>(
  data: MappedResponseType<R, T>,
  response: FetchResponse<MappedResponseType<R, T>>,
  options?: RequestOptions<R, T, TResult>
) {
  const validationResult = await options?.validateResponse?.(data, response)

  if (validationResult === false) {
    throw new RequestError('Response validation failed', { status: response.status, data })
  }

  if (typeof validationResult === 'string') {
    throw new RequestError(validationResult, { status: response.status, data })
  }

  if (validationResult instanceof RequestError) {
    throw validationResult
  }
}

function getErrorHeaders(error: unknown) {
  return error instanceof FetchError ? (error.response?.headers ?? null) : null
}

function getErrorStatus(error: unknown) {
  return error instanceof FetchError ? error.response?.status : undefined
}

function createFailure(error: unknown): RequestFailure {
  const normalizedError = normalizeRequestError(error)

  return {
    response: null,
    headers: getErrorHeaders(error),
    status: getErrorStatus(error) ?? normalizedError.status,
    error: normalizedError
  }
}

function createSuccess<T>(response: T, headers: Headers, status?: number): RequestResult<T> {
  return { response, headers, status, error: null }
}

async function runHook(callback: (() => void | Promise<void>) | undefined) {
  try {
    await callback?.()
  } catch {
    // Hooks are observability/extension points and should not replace the original request result.
  }
}

async function resolveRequestOptions<R extends ResponseType>(url: FetchRequest, options: FetchOptions<R>, config: CreateRequestOptions) {
  const token = await config.getToken?.()
  const hookOptions = (await config.onRequest?.({ url, options })) ?? options
  const headers = mergeHeaders(hookOptions.headers, createAuthorizationHeader(token, config.auth))

  return { ...hookOptions, headers }
}

export function createRequestClient(config: CreateRequestOptions = {}): RequestInstance {
  const mergedConfig: CreateRequestOptions = {
    ...defaultConfig,
    ...config,
    headers: mergeHeaders(defaultConfig.headers, config.headers)
  }

  const { auth: _auth, getToken: _getToken, onError: _onError, onRequest: _onRequest, onResponse: _onResponse, ...fetchConfig } = mergedConfig
  const client = ofetch.create(fetchConfig)

  const request = (async <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options: RequestOptions<R, T, TResult> = {}
  ) => {
    try {
      const { transform: _transform, validateResponse: _validateResponse, ...fetchOptions } = options
      const nextOptions = await resolveRequestOptions(url, fetchOptions, mergedConfig)
      const rawResponse = await client.raw<T, R>(url, nextOptions)
      const data = rawResponse._data as MappedResponseType<R, T>
      const typedResponse = rawResponse as FetchResponse<MappedResponseType<R, T>>
      await validateResponse(data, typedResponse, options)
      await runHook(() => mergedConfig.onResponse?.({ url, options: nextOptions, response: typedResponse, data }))
      const response = await applyTransform<R, T, TResult>(data, options)

      return createSuccess(response, rawResponse.headers, rawResponse.status)
    } catch (error) {
      const result = createFailure(error)
      await runHook(() => mergedConfig.onError?.({ url, options, error: result.error }))

      return result
    }
  }) as RequestInstance

  request.raw = async <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options: FetchOptions<R> = {}
  ): Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>> => {
    try {
      const nextOptions = await resolveRequestOptions(url, options, mergedConfig)
      const response = await client.raw<T, R>(url, nextOptions)
      const typedResponse = response as FetchResponse<MappedResponseType<R, T>>
      await runHook(() => mergedConfig.onResponse?.({ url, options: nextOptions, response: typedResponse, data: typedResponse._data }))

      return createSuccess(typedResponse, response.headers, response.status)
    } catch (error) {
      const result = createFailure(error)
      await runHook(() => mergedConfig.onError?.({ url, options, error: result.error }))

      return result
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
      abort: (reason?: unknown) => controller.abort(reason),
      promise: request<T, R, TResult>(url, {
        ...options,
        signal: mergeSignals(options?.signal, controller.signal)
      })
    }
  }

  const createShortcut =
    (method: RequestMethod) =>
    <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request<T, R, TResult>(url, resolveMethodOptions(method, options))

  const createAbortableShortcut =
    (method: RequestMethod) =>
    <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(url: FetchRequest, options?: RequestOptions<R, T, TResult>) =>
      request.withAbort<T, R, TResult>(url, resolveMethodOptions(method, options))

  request.get = createShortcut('GET')
  request.post = createShortcut('POST')
  request.put = createShortcut('PUT')
  request.patch = createShortcut('PATCH')
  request.delete = createShortcut('DELETE')
  request.head = createShortcut('HEAD')
  request.options = createShortcut('OPTIONS')

  request.abortable = {
    get: createAbortableShortcut('GET'),
    post: createAbortableShortcut('POST'),
    put: createAbortableShortcut('PUT'),
    patch: createAbortableShortcut('PATCH'),
    delete: createAbortableShortcut('DELETE'),
    head: createAbortableShortcut('HEAD'),
    options: createAbortableShortcut('OPTIONS')
  }
  return request
}
