import { describe, expect, it, vi } from 'vitest'

import { RequestError, createRequestClient } from '../shared'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const value = JSON.stringify(body)
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  headers.set('content-length', String(new TextEncoder().encode(value).byteLength))
  return new Response(value, { ...init, headers })
}

describe('createRequestClient', () => {
  it('returns typed results, applies hooks, validation and transforms', async () => {
    const onResponse = vi.fn()
    const onTrace = vi.fn()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token')
      expect(new Headers(init?.headers).get('x-request-id')).toBeTruthy()
      return jsonResponse({ code: 0, data: { name: 'Tom' } }, { status: 200 })
    })
    const request = createRequestClient({ fetch: fetchMock, getToken: () => 'token', onResponse, onTrace, retryPolicy: false })
    const result = await request.get<{ code: number; data: { name: string } }, 'json', { name: string }>('/profile', {
      transform: (body) => body.data,
      validateResponse: (body) => body.code === 0
    })

    expect(result.error).toBeNull()
    expect(result.response).toEqual({ name: 'Tom' })
    expect(result.meta.attempts).toBe(1)
    expect(onResponse).toHaveBeenCalledOnce()
    expect(onTrace).toHaveBeenCalledOnce()
  })

  it('retries eligible failures with backoff policy', async () => {
    let attempts = 0
    const onRetry = vi.fn()
    const request = createRequestClient({
      fetch: async () => {
        attempts += 1
        return attempts < 3 ? jsonResponse({ message: 'unavailable' }, { status: 503 }) : jsonResponse({ ok: true }, { status: 200 })
      },
      retryPolicy: { delay: 0, jitter: false, onRetry, retries: 2 }
    })
    const result = await request.get<{ ok: boolean }>('/retry')

    expect(result.response).toEqual({ ok: true })
    expect(result.meta.attempts).toBe(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('refreshes an expired token once for concurrent requests', async () => {
    const refreshToken = vi.fn(async () => 'new-token')
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('authorization')
      await Promise.resolve()
      return token === 'Bearer new-token' ? jsonResponse({ ok: true }) : jsonResponse({ message: 'expired' }, { status: 401 })
    })
    const request = createRequestClient({ fetch: fetchMock, getToken: () => 'old-token', refreshToken, retryPolicy: false })
    const [first, second] = await Promise.all([request.get('/one'), request.get('/two')])

    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expect(refreshToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('deduplicates in-flight requests and caches successful GET responses', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (resolveFetch = resolve)))
    const request = createRequestClient({ fetch: fetchMock, responseCache: { ttl: 1_000 }, retryPolicy: false })
    const firstPromise = request.get<{ value: number }>('/cached')
    const secondPromise = request.get<{ value: number }>('/cached')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    resolveFetch(jsonResponse({ value: 1 }))

    const [first, second] = await Promise.all([firstPromise, secondPromise])
    expect(first.response).toEqual({ value: 1 })
    expect(second.meta.deduped).toBe(true)

    const cached = await request.get<{ value: number }>('/cached')
    expect(cached.meta.fromCache).toBe(true)
    expect(request.cache.size).toBe(1)
    expect(await request.invalidateCache('/cached')).toBe(true)
  })

  it('runs middleware and limits network concurrency', async () => {
    const releases: (() => void)[] = []
    let active = 0
    let maxActive = 0
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('x-middleware')).toBe('yes')
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active -= 1
      return jsonResponse({ ok: true })
    })
    const request = createRequestClient({ concurrency: 1, dedupe: false, fetch: fetchMock, retryPolicy: false })
    request.use(async (context, next) => {
      context.options.headers = { ...context.options.headers, 'x-middleware': 'yes' }
      return await next()
    })

    const first = request.get('/one')
    const second = request.get('/two')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    releases.shift()?.()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    releases.shift()?.()
    await Promise.all([first, second])
    expect(maxActive).toBe(1)
  })

  it('reports upload/download progress and supports raw responses', async () => {
    const upload = vi.fn()
    const download = vi.fn()
    const request = createRequestClient({ fetch: async () => jsonResponse({ ok: true }), retryPolicy: false })
    const result = await request.post('/progress', {
      body: 'payload',
      onDownloadProgress: download,
      onUploadProgress: upload
    })
    expect(result.response).toEqual({ ok: true })
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ done: true, phase: 'upload' }))
    expect(download).toHaveBeenCalledWith(expect.objectContaining({ done: true, phase: 'download' }))

    const raw = await request.raw<{ ok: boolean }>('/raw')
    expect(raw.response?._data).toEqual({ ok: true })
  })

  it('returns structured validation, fetch and abort failures', async () => {
    const onError = vi.fn()
    const validationClient = createRequestClient({ fetch: async () => jsonResponse({ code: 1 }), onError, retryPolicy: false })
    const invalid = await validationClient('/invalid', { validateResponse: () => 'business failed' })
    expect(invalid.error).toBeInstanceOf(RequestError)
    expect(invalid.error?.message).toBe('business failed')

    const abortClient = createRequestClient({
      fetch: async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
        }),
      retryPolicy: false
    })
    const abortable = abortClient.withAbort('/slow')
    abortable.abort()
    const aborted = await abortable.promise
    expect(aborted.error?.aborted).toBe(true)
    expect(abortClient.isAbortError(aborted.error)).toBe(true)
    expect(onError).toHaveBeenCalledOnce()
  })

  it('does not retry disallowed statuses or methods and contains middleware failures', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'missing' }, { status: 404 }))
    const request = createRequestClient({ fetch: fetchMock, retryPolicy: { delay: 0, retries: 3 } })
    const missing = await request.get('/missing')
    expect(missing.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledOnce()

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'unavailable' }, { status: 503 }))
    const post = await request.post('/mutation')
    expect(post.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    request.use(async (_context, next) => {
      await next()
      return await next()
    })
    const middlewareFailure = await request.get('/middleware')
    expect(middlewareFailure.error?.message).toContain('next() called multiple times')
  })

  it('expires cache entries and exposes cache controls', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    const request = createRequestClient({ fetch: fetchMock, responseCache: { ttl: 100 }, retryPolicy: false })

    await request.get('/cache-controls')
    const key = request.cache.keys()[0]
    expect(request.cache.has(key)).toBe(true)
    vi.advanceTimersByTime(101)
    await request.get('/cache-controls')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    request.cache.clear()
    expect(request.cache.size).toBe(0)
    vi.useRealTimers()
  })
})
