import { afterEach, describe, expect, it, vi } from 'vitest'

import { Cookie, EventEmitter, StorageWithExpiration, createMemoryStorage, isStorageAvailable, parseCookieHeader, serializeCookie } from '../shared'

afterEach(() => {
  vi.useRealTimers()
})

function createCookieAdapter() {
  const values = new Map<string, string>()

  return {
    adapter: {
      read: () => [...values].map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('; '),
      write: (serialized: string) => {
        const [pair, ...attributes] = serialized.split('; ')
        const separator = pair.indexOf('=')
        const key = decodeURIComponent(pair.slice(0, separator))
        const value = decodeURIComponent(pair.slice(separator + 1))
        const remove = attributes.some((attribute) => attribute.toLowerCase() === 'max-age=0')
        if (remove) values.delete(key)
        else values.set(key, value)
      }
    },
    values
  }
}

describe('Cookie', () => {
  it('serializes, parses and manages browser-compatible cookies', () => {
    const success = vi.fn()
    const { adapter } = createCookieAdapter()
    const cookie = new Cookie({ sameSite: 'Lax', secure: true }, adapter)

    expect(cookie.set('token', 'a b', { maxAge: 60, onSuccess: success })).toBe(true)
    expect(cookie.get('token')).toBe('a b')
    expect(cookie.has('token')).toBe(true)
    expect(success).toHaveBeenCalledOnce()
    expect(cookie.getAll()).toEqual({ token: 'a b' })

    cookie.setJSON('profile', { id: 1 })
    expect(cookie.getJSON('profile')).toEqual({ id: 1 })
    expect(cookie.getJSON('missing', { id: 0 })).toEqual({ id: 0 })
    expect(cookie.clear()).toBe(2)
    expect(cookie.getAll()).toEqual({})
  })

  it('is safe without document and validates expiration', () => {
    const cookie = new Cookie()
    expect(cookie.isAvailable()).toBe(false)
    expect(cookie.set('token', 'x')).toBe(false)
    expect(cookie.get('token')).toBeNull()
    expect(() => serializeCookie('token', 'x', { expires: Number.NaN })).toThrow(RangeError)
    expect(() => serializeCookie('', 'x')).toThrow('Cookie name')
    expect(() => cookie.setJSON('invalid', undefined)).toThrow('not serializable')
    expect(parseCookieHeader('broken; good=value%20x; bad=%E0%A4%A')).toEqual({ good: 'value x', bad: '%E0%A4%A' })
  })
})

describe('StorageWithExpiration', () => {
  it('stores values, expires entries and exposes convenience methods', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const storage = new StorageWithExpiration(createMemoryStorage(), { namespace: 'app', validateKey: false })
    const changes: string[] = []
    storage.subscribe((change) => changes.push(`${change.type}:${change.key ?? ''}`))

    storage.setItem('user-profile', { id: 1 }, { ttl: 1_000 })
    expect(storage.has('user-profile')).toBe(true)
    expect(storage.getValue<{ id: number }>('user-profile')).toEqual({ id: 1 })
    expect(storage.keys()).toEqual(['user-profile'])
    expect(storage.getOrSet('user-profile', () => ({ id: 2 }))).toEqual({ id: 1 })

    vi.advanceTimersByTime(1_001)
    expect(storage.getItem<{ id: number }>('user-profile')).toMatchObject({ expired: true, found: true, value: { id: 1 } })
    expect(storage.getOrSet('user-profile', () => ({ id: 2 }))).toEqual({ id: 2 })
    storage.removeItem('user-profile')
    expect(changes).toContain('set:user-profile')
    expect(changes).toContain('remove:user-profile')
  })

  it('migrates versions and refreshes sliding expiration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const raw = createMemoryStorage()
    raw.setItem('profile', JSON.stringify({ expiresAt: null, value: { name: 'Tom' }, version: 1 }))
    const migrate = vi.fn((value: unknown) => ({ ...(value as object), active: true }))
    const storage = new StorageWithExpiration(raw, { migrate, slidingExpiration: 500, validateKey: false, version: 2 })

    expect(storage.getItem('profile')).toMatchObject({ value: { active: true, name: 'Tom' }, version: 2 })
    expect(migrate).toHaveBeenCalledOnce()
    expect(JSON.parse(raw.getItem('profile')!)).toMatchObject({ expiresAt: 1_500, version: 2 })
  })

  it('isolates namespaces, handles parse errors and falls back on quota errors', () => {
    const raw = createMemoryStorage()
    raw.setItem('other:key', 'keep')
    raw.setItem('app:bad', 'not-json')
    const parseError = vi.fn()
    const storage = new StorageWithExpiration(raw, { namespace: 'app', onParseError: parseError, validateKey: false })
    expect(storage.getItem('bad').found).toBe(false)
    expect(parseError).toHaveBeenCalledOnce()

    storage.setItem('ok', 1)
    storage.clear()
    expect(raw.getItem('other:key')).toBe('keep')

    const fallback = createMemoryStorage()
    const quotaError = vi.fn()
    const broken: Storage = {
      length: 0,
      clear: () => {
        throw new Error('quota')
      },
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new Error('quota')
      }
    }
    const resilient = new StorageWithExpiration(broken, { fallbackStorage: fallback, onQuotaError: quotaError, validateKey: false })
    resilient.setItem('key', 'value')
    expect(resilient.getValue('key')).toBe('value')
    expect(quotaError).toHaveBeenCalledOnce()
    expect(isStorageAvailable(broken)).toBe(false)
    expect(isStorageAvailable(createMemoryStorage())).toBe(true)
  })

  it('supports validation strategies and explicit fallback failure', () => {
    const raw = createMemoryStorage()
    raw.setItem('bad', 'not-json')
    const keep = new StorageWithExpiration(raw, { parseErrorStrategy: 'keep' })
    expect(keep.getItem('bad').found).toBe(false)
    expect(raw.getItem('bad')).toBe('not-json')
    expect(() => keep.setItem('bad-key', 1)).toThrow('Invalid key format')
    expect(() => keep.setItem('valid_key', 1, { ttl: -1 })).toThrow(RangeError)

    const broken = createMemoryStorage()
    broken.setItem = () => {
      throw new Error('full')
    }
    const noFallback = new StorageWithExpiration(broken, { fallbackStorage: false })
    expect(() => noFallback.setItem('valid_key', 1)).toThrow('full')

    const unsubscribe = keep.subscribe(() => {})
    unsubscribe()
    keep.destroy()
  })
})

describe('EventEmitter', () => {
  type Events = {
    'user:login': { id: string }
    logout: undefined
  }

  it('supports priority, once, wildcard and any listeners', () => {
    const emitter = new EventEmitter<Events>()
    const calls: string[] = []
    emitter.on(
      'user:login',
      () => {
        calls.push('low')
      },
      { priority: 1 }
    )
    emitter.once(
      'user:login',
      () => {
        calls.push('once')
      },
      { priority: 3 }
    )
    emitter.onPattern(
      'user:*',
      ({ eventName }) => {
        calls.push(`pattern:${String(eventName)}`)
      },
      { priority: 2 }
    )
    emitter.onAny(({ eventName }) => {
      calls.push(`any:${String(eventName)}`)
    })

    emitter.emit('user:login', { id: '1' })
    emitter.emit('user:login', { id: '2' })
    expect(calls).toEqual(['once', 'pattern:user:login', 'low', 'any:user:login', 'pattern:user:login', 'low', 'any:user:login'])
    expect(emitter.listenerCount('user:login')).toBe(1)
    expect(emitter.totalListenerCount()).toBe(3)
  })

  it('supports async emission, safe errors and AbortSignal cleanup', async () => {
    const emitter = new EventEmitter<Events>()
    const controller = new AbortController()
    const calls: string[] = []
    emitter.on('logout', async () => {
      calls.push('async')
    })
    emitter.on(
      'logout',
      () => {
        calls.push('removed')
      },
      { signal: controller.signal }
    )
    controller.abort()

    await emitter.emitAsync('logout')
    expect(calls).toEqual(['async'])
    emitter.on('logout', () => {
      throw new Error('listener failed')
    })
    expect(emitter.safeEmit('logout')).toHaveLength(1)
    expect(await emitter.safeEmitAsync('logout')).toHaveLength(1)
    emitter.clear()
    expect(emitter.totalListenerCount()).toBe(0)
  })

  it('reports listener limit overflow', () => {
    const warning = vi.fn()
    const emitter = new EventEmitter<Events>({ maxListeners: 1, onMaxListenersExceeded: warning })
    emitter.on('logout', () => {})
    emitter.on('logout', () => {})
    expect(warning).toHaveBeenCalledWith('logout', 2)
    emitter.setMaxListeners(3)
  })

  it('removes exact listeners and ignores already-aborted subscriptions', () => {
    const emitter = new EventEmitter<Events>()
    const listener = vi.fn()
    const controller = new AbortController()
    controller.abort()
    emitter.on('logout', listener, { signal: controller.signal })
    expect(emitter.listenerCount('logout')).toBe(0)

    emitter.on('logout', listener)
    emitter.off('logout', listener)
    emitter.emit('logout')
    expect(listener).not.toHaveBeenCalled()
    emitter.on('logout', listener)
    emitter.clear('logout')
    expect(emitter.listenerCount('logout')).toBe(0)
  })
})
