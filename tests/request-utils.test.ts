import { describe, expect, it } from 'vitest'

import {
  RequestError,
  appendQuery,
  createAuthorizationHeader,
  createQueryString,
  createRequestId,
  createTimeoutSignal,
  getHeader,
  headersToObject,
  isRequestFailure,
  isRequestSuccess,
  mapRequestResult,
  mergeHeaders,
  mergeSignals,
  normalizeRequestError,
  omitHeaders,
  unwrapRequestResult
} from '../shared'

const meta = { attempts: 1, duration: 0, method: 'GET' as const, requestId: 'req', timestamp: 0, url: '/test' }

describe('request helpers', () => {
  it('manages headers and authorization', () => {
    expect(headersToObject(mergeHeaders({ a: '1' }, { a: '2', b: '3' }))).toEqual({ a: '2', b: '3' })
    expect(headersToObject(omitHeaders({ a: '1', b: '2' }, ['a']))).toEqual({ b: '2' })
    expect(getHeader({ Authorization: 'Bearer token' }, 'authorization')).toBe('Bearer token')
    expect(createAuthorizationHeader('token')).toEqual({ Authorization: 'Bearer token' })
    expect(createAuthorizationHeader('token', { header: 'x-token', type: '' })).toEqual({ 'x-token': 'token' })
    expect(createAuthorizationHeader(null)).toBeUndefined()
  })

  it('serializes query strings and creates signals and ids', () => {
    expect(createQueryString({ active: true, dates: [new Date(0), null], page: 1 })).toBe('active=true&dates=1970-01-01T00%3A00%3A00.000Z&page=1')
    expect(appendQuery('/users?sort=name#top', { page: 2 })).toBe('/users?sort=name&page=2#top')
    expect(createRequestId('trace', () => 0)).toMatch(/^trace_[^_]+_00000000$/)

    const first = new AbortController()
    const second = new AbortController()
    const merged = mergeSignals(first.signal, second.signal)!
    second.abort('stop')
    expect(merged.aborted).toBe(true)
    expect(merged.reason).toBe('stop')
    expect(createTimeoutSignal(0)).toBeUndefined()
  })

  it('maps, unwraps and normalizes request results', async () => {
    const success = { error: null, headers: new Headers(), meta, response: { count: 2 }, status: 200 } as const
    const mapped = mapRequestResult(success, (response) => response.count)
    expect(isRequestSuccess(mapped)).toBe(true)
    expect(mapped.response).toBe(2)
    await expect(unwrapRequestResult(mapped)).resolves.toBe(2)

    const error = new RequestError('failed', { status: 500 })
    const failure = { error, headers: null, meta, response: null, status: 500 } as const
    expect(isRequestFailure(failure)).toBe(true)
    expect(mapRequestResult(failure, () => 1)).toBe(failure)
    await expect(unwrapRequestResult(failure)).rejects.toBe(error)
    expect(normalizeRequestError(new Error('native'))).toBeInstanceOf(RequestError)
    expect(normalizeRequestError('unknown').message).toBe('Request failed')
  })
})
