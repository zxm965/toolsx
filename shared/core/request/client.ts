import { FetchError, ofetch } from 'ofetch'

import { createMemoryRequestCache } from './cache'
import { RequestSemaphore } from './concurrency'
import { RequestError, normalizeRequestError } from './errors'
import { createProgressFetch } from './progress'
import type {
  CreateRequestOptions,
  FetchOptions,
  FetchRequest,
  FetchResponse,
  MappedResponseType,
  RawRequestOptions,
  RequestFailure,
  RequestCacheAdapter,
  RequestInstance,
  RequestMeta,
  RequestMethod,
  RequestMiddleware,
  RequestMiddlewareContext,
  RequestOptions,
  RequestResult,
  RequestRetryContext,
  RequestRetryOptions,
  RequestSuccess,
  ResponseCacheOptions,
  ResponseType,
  TokenRefreshContext,
  TokenValue
} from './types'
import { createAuthorizationHeader, createRequestId, getHeader, mergeHeaders, mergeSignals } from './utils'

interface RefreshState {
  failedToken: TokenValue
  token: TokenValue
}

const retryStatusCodes = [408, 409, 425, 429, 500, 502, 503, 504]
const retryMethods: RequestMethod[] = ['GET', 'HEAD', 'OPTIONS']
const mutationMethods = new Set<RequestMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])

const defaultRetryPolicy: RequestRetryOptions = {
  delay: 250,
  factor: 2,
  jitter: true,
  maxDelay: 3_000,
  methods: retryMethods,
  retries: 2,
  statusCodes: retryStatusCodes
}

const defaultCacheOptions: Required<Omit<ResponseCacheOptions, 'adapter'>> = {
  invalidateOnMutation: true,
  methods: ['GET'],
  ttl: 30_000
}

const defaultConfig: CreateRequestOptions = {
  dedupe: true,
  headers: { Accept: 'application/json' },
  requestIdHeader: 'x-request-id',
  responseCache: false,
  retry: 0,
  retryPolicy: defaultRetryPolicy,
  timeout: 15_000
}

function normalizeMethod(method?: string): RequestMethod {
  return (method?.toUpperCase() ?? 'GET') as RequestMethod
}

function requestUrlToString(url: FetchRequest) {
  if (typeof url === 'string') return url
  if (url instanceof URL) return url.href
  return url.url
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
  return options?.transform ? await options.transform(data) : (data as TResult)
}

async function validateResponse<R extends ResponseType, T = unknown, TResult = MappedResponseType<R, T>>(
  data: MappedResponseType<R, T>,
  response: FetchResponse<MappedResponseType<R, T>>,
  options?: RequestOptions<R, T, TResult>
) {
  const validationResult = await options?.validateResponse?.(data, response)

  if (validationResult === false) throw new RequestError('Response validation failed', { data, status: response.status })
  if (typeof validationResult === 'string') throw new RequestError(validationResult, { data, status: response.status })
  if (validationResult instanceof RequestError) throw validationResult
}

function getErrorHeaders(error: unknown) {
  return error instanceof FetchError ? (error.response?.headers ?? null) : null
}

function getErrorStatus(error: unknown) {
  return error instanceof FetchError ? error.response?.status : undefined
}

function createMeta(url: FetchRequest, method: RequestMethod, requestId: string, timestamp: number, attempts = 0): RequestMeta {
  return {
    attempts,
    duration: Math.max(0, Date.now() - timestamp),
    method,
    requestId,
    timestamp,
    url: requestUrlToString(url)
  }
}

function createFailure(error: unknown, meta: RequestMeta): RequestFailure {
  const normalizedError = normalizeRequestError(error)
  const status = getErrorStatus(error) ?? normalizedError.status
  normalizedError.meta = { ...normalizedError.meta, ...meta }

  return {
    error: normalizedError,
    headers: getErrorHeaders(error),
    meta,
    response: null,
    status
  }
}

function createSuccess<T>(response: T, headers: Headers, meta: RequestMeta, status?: number): RequestSuccess<T> {
  return { error: null, headers, meta, response, status }
}

function cloneResult<T>(result: RequestResult<T>): RequestResult<T> {
  if (result.error) {
    return { ...result, headers: result.headers ? new Headers(result.headers) : null, meta: { ...result.meta } }
  }

  return { ...result, headers: new Headers(result.headers), meta: { ...result.meta } }
}

function ensureResultMeta<T>(result: RequestResult<T>, fallback: RequestMeta): RequestResult<T> {
  const meta = result.meta ? { ...fallback, ...result.meta } : fallback

  if (result.error) {
    result.error.meta = { ...result.error.meta, ...meta }
    return { ...result, meta }
  }

  return { ...result, meta }
}

async function runHook(callback: (() => void | Promise<void>) | undefined) {
  try {
    await callback?.()
  } catch {
    // Observability hooks must not replace the original request result.
  }
}

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof URLSearchParams) return value.toString()
  if (value instanceof FormData)
    return JSON.stringify([...value.entries()].map(([key, entry]) => [key, typeof entry === 'string' ? entry : `${entry.name}:${entry.size}`]))
  if (value instanceof Blob) return `[Blob:${value.type}:${value.size}]`
  if (value instanceof ArrayBuffer) return `[ArrayBuffer:${value.byteLength}]`
  if (ArrayBuffer.isView(value)) return `[ArrayBufferView:${value.byteLength}]`
  if (seen.has(value)) return '[Circular]'

  seen.add(value)

  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item, seen)).join(',')}]`

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key], seen)}`)
    .join(',')}}`
}

function hashString(value: string) {
  let hash = 5381
  for (const character of value) hash = (hash * 33) ^ character.charCodeAt(0)
  return (hash >>> 0).toString(36)
}

function createRequestKey(url: FetchRequest, options: RequestOptions<ResponseType, unknown, unknown>, token: TokenValue, baseURL?: string) {
  const method = normalizeMethod(options.method)
  const query = options.query ?? options.params
  const tokenScope = token ? hashString(token) : 'anonymous'

  return [method, baseURL ?? '', requestUrlToString(url), stableSerialize(query), stableSerialize(options.body), tokenScope].join('|')
}

function getRequestId<R extends ResponseType>(url: FetchRequest, options: FetchOptions<R>, config: CreateRequestOptions) {
  const header = config.requestIdHeader === false ? undefined : (config.requestIdHeader ?? 'x-request-id')
  const existing = header ? (getHeader(options.headers, header) ?? getHeader(config.headers, header)) : null

  return existing ?? createRequestId(typeof url === 'string' ? 'req' : 'request')
}

function resolveRetryPolicy(options: RequestOptions<ResponseType, unknown, unknown>, config: CreateRequestOptions) {
  if (options.retryPolicy === false || (options.retryPolicy === undefined && config.retryPolicy === false)) return false

  const configured = options.retryPolicy ?? config.retryPolicy ?? defaultRetryPolicy
  const nativeRetry = options.retry ?? config.retry
  const nativeDelay = options.retryDelay ?? config.retryDelay
  const nativeStatusCodes = options.retryStatusCodes ?? config.retryStatusCodes

  return {
    ...defaultRetryPolicy,
    ...configured,
    ...(typeof nativeRetry === 'number' && nativeRetry > 0 ? { retries: nativeRetry } : {}),
    ...(nativeDelay !== undefined ? { delay: typeof nativeDelay === 'function' ? 0 : nativeDelay } : {}),
    ...(nativeStatusCodes ? { statusCodes: nativeStatusCodes } : {})
  } satisfies RequestRetryOptions
}

function resolveCacheOptions(options: RequestOptions<ResponseType, unknown, unknown>, config: CreateRequestOptions, method: RequestMethod) {
  const requested = options.responseCache ?? config.responseCache
  if (!requested) return false

  const configured = requested === true ? {} : requested
  const resolved = { ...defaultCacheOptions, ...configured }

  return resolved.methods.includes(method) ? resolved : false
}

function shouldDedupe(options: RequestOptions<ResponseType, unknown, unknown>, config: CreateRequestOptions, method: RequestMethod) {
  return (options.dedupe ?? config.dedupe ?? false) && (method === 'GET' || method === 'HEAD')
}

function getRetryDelay(policy: RequestRetryOptions, context: RequestRetryContext, retryIndex: number) {
  const base = typeof policy.delay === 'function' ? policy.delay(context) : (policy.delay ?? 0) * Math.pow(policy.factor ?? 1, retryIndex)
  const capped = Math.min(Math.max(0, base), policy.maxDelay ?? Number.POSITIVE_INFINITY)

  if (typeof policy.jitter === 'function') return Math.max(0, policy.jitter(capped, context))
  return policy.jitter ? (policy.random ?? Math.random)() * capped : capped
}

function wait(delay: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Request aborted', 'AbortError'))

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, delay)
    const abort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Request aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', abort, { once: true })
  })
}

function composeMiddlewares(middlewares: readonly RequestMiddleware[], context: RequestMiddlewareContext, core: () => Promise<RequestResult<unknown>>) {
  let currentIndex = -1

  const dispatch = (index: number): Promise<RequestResult<unknown>> => {
    if (index <= currentIndex) return Promise.reject(new Error('Request middleware next() called multiple times'))
    currentIndex = index
    const middleware = middlewares[index]
    return middleware ? middleware(context, () => dispatch(index + 1)) : core()
  }

  return dispatch(0)
}

export function createRequestClient(config: CreateRequestOptions = {}): RequestInstance {
  const mergedConfig: CreateRequestOptions = {
    ...defaultConfig,
    ...config,
    headers: mergeHeaders(defaultConfig.headers, config.headers),
    retryPolicy: config.retryPolicy === false ? false : { ...defaultRetryPolicy, ...config.retryPolicy }
  }
  const fetchConfig = { ...mergedConfig }
  const libraryKeys: (keyof CreateRequestOptions)[] = [
    'auth',
    'concurrency',
    'dedupe',
    'fetch',
    'getToken',
    'middlewares',
    'onError',
    'onRequest',
    'onResponse',
    'onTrace',
    'refreshToken',
    'requestIdHeader',
    'responseCache',
    'retryPolicy',
    'shouldRefreshToken'
  ]
  libraryKeys.forEach((key) => delete fetchConfig[key])
  fetchConfig.retry = 0

  const baseFetch = config.fetch ?? globalThis.fetch.bind(globalThis)
  const client = ofetch.create(fetchConfig as unknown as FetchOptions<ResponseType>, { fetch: createProgressFetch(baseFetch) })
  const semaphore = new RequestSemaphore(mergedConfig.concurrency ?? Number.POSITIVE_INFINITY)
  const defaultCacheAdapter = createMemoryRequestCache()
  const primaryCacheAdapter =
    typeof mergedConfig.responseCache === 'object' && mergedConfig.responseCache.adapter ? mergedConfig.responseCache.adapter : defaultCacheAdapter
  const cacheAdapters = new Set<RequestCacheAdapter>([primaryCacheAdapter])
  const inFlightRequests = new Map<string, Promise<RequestResult<unknown>>>()
  const runtimeMiddlewares: RequestMiddleware[] = []
  const invalidateOnMutation = typeof mergedConfig.responseCache === 'object' ? (mergedConfig.responseCache.invalidateOnMutation ?? true) : true
  let refreshPromise: Promise<TokenValue> | undefined
  let refreshState: RefreshState | undefined

  const clearCacheAdapters = () => cacheAdapters.forEach((adapter) => adapter.clear())
  const resolveCacheAdapter = (options: ResponseCacheOptions) => {
    const adapter = options.adapter ?? primaryCacheAdapter
    cacheAdapters.add(adapter)
    return adapter
  }

  const getToken = () => mergedConfig.getToken?.()

  const resolveRequestOptions = async <R extends ResponseType>(url: FetchRequest, options: FetchOptions<R>, requestId: string, token: TokenValue) => {
    const hookOptions = (await mergedConfig.onRequest?.({ options, requestId, url })) ?? options
    let headers = mergeHeaders(mergedConfig.headers, hookOptions.headers)
    headers = mergeHeaders(headers, createAuthorizationHeader(token, mergedConfig.auth))

    if (mergedConfig.requestIdHeader !== false) {
      const header = mergedConfig.requestIdHeader ?? 'x-request-id'
      if (!headers.has(header)) headers.set(header, requestId)
    }

    return { ...hookOptions, headers, retry: 0 }
  }

  const refreshAccessToken = async (context: TokenRefreshContext) => {
    const currentToken = await getToken()
    if (!Object.is(currentToken, context.failedToken)) return currentToken
    if (refreshState && Object.is(refreshState.failedToken, context.failedToken)) return refreshState.token

    if (!refreshPromise) {
      refreshPromise = Promise.resolve(mergedConfig.refreshToken?.(context)).then(async (token) => token ?? (await getToken()))
    }

    try {
      const token = await refreshPromise
      refreshState = { failedToken: context.failedToken, token }
      return token
    } finally {
      refreshPromise = undefined
    }
  }

  const executeAttempt = async <T, R extends ResponseType, TResult>(
    url: FetchRequest,
    options: RequestOptions<R, T, TResult>,
    requestId: string,
    timestamp: number,
    attempt: number,
    token: TokenValue
  ): Promise<RequestResult<TResult>> => {
    const method = normalizeMethod(options.method)
    const meta = createMeta(url, method, requestId, timestamp, attempt)

    try {
      const {
        cacheKey: _,
        dedupe: __,
        dedupeKey: ___,
        responseCache: ____,
        retryPolicy: _____,
        skipAuthRefresh: ______,
        transform: _______,
        validateResponse: ________,
        ...fetchOptions
      } = options
      const nextOptions = await resolveRequestOptions(url, fetchOptions, requestId, token)
      const rawResponse = await client.raw<T, R>(url, nextOptions)
      const data = rawResponse._data as MappedResponseType<R, T>
      const typedResponse = rawResponse as FetchResponse<MappedResponseType<R, T>>
      await validateResponse(data, typedResponse, options)
      await runHook(() => mergedConfig.onResponse?.({ data, options: nextOptions, requestId, response: typedResponse, url }))
      const response = await applyTransform<R, T, TResult>(data, options)

      return createSuccess(response, rawResponse.headers, meta, rawResponse.status)
    } catch (error) {
      return createFailure(error, meta)
    }
  }

  const executeWithRetry = async <T, R extends ResponseType, TResult>(
    url: FetchRequest,
    options: RequestOptions<R, T, TResult>,
    requestId: string,
    timestamp: number,
    initialToken: TokenValue
  ) => {
    const method = normalizeMethod(options.method)
    const policy = resolveRetryPolicy(options as unknown as RequestOptions<ResponseType, unknown, unknown>, mergedConfig)
    const retries = policy ? Math.max(0, policy.retries ?? 0) : 0
    let retryIndex = 0
    let attempt = 0
    let token = initialToken
    let refreshed = false

    while (true) {
      attempt += 1
      let result = await executeAttempt(url, options, requestId, timestamp, attempt, token)
      if (!result.error) return result
      if (result.error.aborted) return result

      const refreshContext: TokenRefreshContext = { error: result.error, failedToken: token, requestId, url }
      const canRefresh =
        !refreshed &&
        !options.skipAuthRefresh &&
        Boolean(mergedConfig.refreshToken) &&
        (mergedConfig.shouldRefreshToken ? await mergedConfig.shouldRefreshToken(refreshContext) : result.status === 401)

      if (canRefresh) {
        try {
          token = await refreshAccessToken(refreshContext)
          refreshed = true
          clearCacheAdapters()
          continue
        } catch (error) {
          result = createFailure(error, createMeta(url, method, requestId, timestamp, attempt))
          return result
        }
      }

      if (!policy || retryIndex >= retries || !(policy.methods ?? retryMethods).includes(method)) return result

      const context: RequestRetryContext = {
        attempt,
        error: result.error,
        method,
        retriesLeft: retries - retryIndex,
        status: result.status,
        url
      }
      const statusAllowed = result.status === undefined || (policy.statusCodes ?? retryStatusCodes).includes(result.status)
      if (!statusAllowed || (policy.shouldRetry && !(await policy.shouldRetry(context)))) return result

      const delay = getRetryDelay(policy, context, retryIndex)
      retryIndex += 1
      await runHook(() => policy.onRetry?.({ ...context, delay }))

      try {
        if (delay > 0) await wait(delay, options.signal ?? undefined)
      } catch (error) {
        return createFailure(error, createMeta(url, method, requestId, timestamp, attempt))
      }
    }
  }

  const observeResult = async <T>(result: RequestResult<T>, timestamp: number, overrides: Partial<RequestMeta> = {}) => {
    const meta = { ...result.meta, ...overrides, duration: Math.max(0, Date.now() - timestamp) }
    const observed = ensureResultMeta(result, meta)

    if (observed.error) {
      await runHook(() =>
        mergedConfig.onError?.({ error: observed.error, meta: observed.meta, options: {}, requestId: observed.meta.requestId, url: observed.meta.url })
      )
    }

    await runHook(() => mergedConfig.onTrace?.({ ...observed.meta, error: observed.error ?? undefined, status: observed.status }))
    return observed
  }

  const request = (async <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options: RequestOptions<R, T, TResult> = {}
  ) => {
    const timestamp = Date.now()
    const method = normalizeMethod(options.method)
    const requestId = getRequestId(url, options, mergedConfig)
    const fallbackMeta = createMeta(url, method, requestId, timestamp)

    try {
      const token = await getToken()
      const typedOptions = options as unknown as RequestOptions<ResponseType, unknown, unknown>
      const requestKey = options.cacheKey ?? options.dedupeKey ?? createRequestKey(url, typedOptions, token, mergedConfig.baseURL)
      const cacheOptions = resolveCacheOptions(typedOptions, mergedConfig, method)
      const cacheAdapter = cacheOptions ? resolveCacheAdapter(cacheOptions) : undefined
      const cached = cacheAdapter?.get(requestKey)

      if (cached) {
        if (cached.expiresAt > Date.now()) {
          return await observeResult(cloneResult(cached.result) as RequestResult<TResult>, timestamp, { attempts: 0, fromCache: true })
        }
        cacheAdapter?.delete(requestKey)
      }

      const dedupe = shouldDedupe(typedOptions, mergedConfig, method)
      const existingRequest = dedupe ? inFlightRequests.get(requestKey) : undefined

      if (existingRequest) {
        const result = (await existingRequest) as RequestResult<TResult>
        return await observeResult(cloneResult(result), timestamp, { deduped: true })
      }

      const task = semaphore
        .run(async () => {
          const context: RequestMiddlewareContext = { options: typedOptions, requestId, url }
          const middlewares = [...(mergedConfig.middlewares ?? []), ...runtimeMiddlewares]
          const result = middlewares.length
            ? await composeMiddlewares(
                middlewares,
                context,
                () => executeWithRetry(url, options, requestId, timestamp, token) as Promise<RequestResult<unknown>>
              )
            : await executeWithRetry(url, options, requestId, timestamp, token)
          return ensureResultMeta(result, fallbackMeta)
        }, options.signal ?? undefined)
        .catch((error) => createFailure(error, fallbackMeta))

      if (dedupe) inFlightRequests.set(requestKey, task as Promise<RequestResult<unknown>>)
      const result = (await task) as RequestResult<TResult>
      if (dedupe && inFlightRequests.get(requestKey) === task) inFlightRequests.delete(requestKey)

      if (!result.error && cacheOptions) {
        cacheAdapter?.set(requestKey, { expiresAt: Date.now() + Math.max(0, cacheOptions.ttl), result: cloneResult(result) as RequestResult<unknown> })
      }

      if (!result.error && mutationMethods.has(method) && invalidateOnMutation) {
        clearCacheAdapters()
      }

      return await observeResult(result, timestamp)
    } catch (error) {
      return await observeResult(createFailure(error, fallbackMeta), timestamp)
    }
  }) as RequestInstance

  request.raw = async <T = unknown, R extends ResponseType = 'json'>(
    url: FetchRequest,
    options: RawRequestOptions<R> = {}
  ): Promise<RequestResult<FetchResponse<MappedResponseType<R, T>>>> => {
    const timestamp = Date.now()
    const method = normalizeMethod(options.method)
    const requestId = getRequestId(url, options, mergedConfig)
    const meta = createMeta(url, method, requestId, timestamp, 1)

    try {
      const token = await getToken()
      const nextOptions = await resolveRequestOptions(url, options, requestId, token)
      const response = await semaphore.run(() => client.raw<T, R>(url, nextOptions), options.signal ?? undefined)
      const typedResponse = response as FetchResponse<MappedResponseType<R, T>>
      await runHook(() => mergedConfig.onResponse?.({ data: typedResponse._data, options: nextOptions, requestId, response: typedResponse, url }))
      return await observeResult(createSuccess(typedResponse, response.headers, meta, response.status), timestamp)
    } catch (error) {
      return await observeResult<FetchResponse<MappedResponseType<R, T>>>(createFailure(error, meta), timestamp)
    }
  }

  request.createAbortController = () => new AbortController()
  request.isAbortError = (error: unknown) =>
    (error instanceof RequestError && error.aborted === true) || (error instanceof Error && error.name === 'AbortError')
  request.withAbort = <T = unknown, R extends ResponseType = 'json', TResult = MappedResponseType<R, T>>(
    url: FetchRequest,
    options?: RequestOptions<R, T, TResult>
  ) => {
    const controller = new AbortController()

    return {
      controller,
      abort: (reason?: unknown) => controller.abort(reason),
      promise: request<T, R, TResult>(url, { ...options, signal: mergeSignals(options?.signal, controller.signal) })
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
    delete: createAbortableShortcut('DELETE'),
    get: createAbortableShortcut('GET'),
    head: createAbortableShortcut('HEAD'),
    options: createAbortableShortcut('OPTIONS'),
    patch: createAbortableShortcut('PATCH'),
    post: createAbortableShortcut('POST'),
    put: createAbortableShortcut('PUT')
  }
  request.use = (middleware) => {
    runtimeMiddlewares.push(middleware)
    return () => {
      const index = runtimeMiddlewares.indexOf(middleware)
      if (index >= 0) runtimeMiddlewares.splice(index, 1)
    }
  }
  request.invalidateCache = async (url, options = {}) => {
    const token = await getToken()
    const key = options.cacheKey ?? createRequestKey(url, options as unknown as RequestOptions<ResponseType, unknown, unknown>, token, mergedConfig.baseURL)
    const cacheOptions = resolveCacheOptions(
      options as unknown as RequestOptions<ResponseType, unknown, unknown>,
      mergedConfig,
      normalizeMethod(options.method)
    )
    return (cacheOptions ? resolveCacheAdapter(cacheOptions) : primaryCacheAdapter).delete(key)
  }
  request.cache = {
    clear: () => primaryCacheAdapter.clear(),
    delete: (key) => primaryCacheAdapter.delete(key),
    has: (key) => primaryCacheAdapter.has(key),
    keys: () => primaryCacheAdapter.keys(),
    get size() {
      return primaryCacheAdapter.size
    }
  }

  return request
}
