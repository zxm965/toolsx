import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AsyncStorageWithExpiration,
  Cookie,
  EventEmitter,
  StorageWithExpiration,
  createAsyncStorageAdapter,
  createMemoryStorage,
  isStorageAvailable,
  parseCookieHeader,
  serializeCookie
} from '../shared'

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

  it('serializes server and partitioning attributes', () => {
    expect(serializeCookie('session', 'value', { httpOnly: true, partitioned: true, priority: 'High', secure: true })).toContain(
      'Secure; HttpOnly; Partitioned; Priority=High'
    )
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
    expect(storage.entries()).toEqual([['user-profile', { id: 2 }]])
    expect(storage.values()).toEqual([{ id: 2 }])
    expect(storage.updateItem<{ id: number }>('user-profile', (value) => ({ id: value.id + 1 }))).toEqual({ id: 3 })
    storage.removeItem('user-profile')
    expect(changes).toContain('set:user-profile')
    expect(changes).toContain('remove:user-profile')
  })

  it('purges expired entries in bulk', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const storage = new StorageWithExpiration(createMemoryStorage(), { validateKey: false })
    storage.setItem('expired', 1, { ttl: 10 })
    storage.setItem('active', 2, { ttl: 100 })
    vi.setSystemTime(1_011)
    expect(storage.purgeExpired()).toBe(1)
    expect(storage.keys()).toEqual(['active'])
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

describe('AsyncStorageWithExpiration', () => {
  it('supports asynchronous adapters, deduplicated factories and collection helpers', async () => {
    const storage = new AsyncStorageWithExpiration(createAsyncStorageAdapter(createMemoryStorage()), {
      namespace: 'async',
      validateKey: false
    })
    const factory = vi.fn(async () => ({ count: 1 }))
    const [first, second] = await Promise.all([storage.getOrSet('item', factory, { ttl: 1_000 }), storage.getOrSet('item', factory, { ttl: 1_000 })])

    expect(first).toEqual({ count: 1 })
    expect(second).toEqual({ count: 1 })
    expect(factory).toHaveBeenCalledOnce()
    expect(await storage.entries()).toEqual([['item', { count: 1 }]])
    expect(await storage.values()).toEqual([{ count: 1 }])
    await expect(storage.updateItem<{ count: number }>('item', async (value) => ({ count: value.count + 1 }))).resolves.toEqual({ count: 2 })
    expect(await storage.getValue<{ count: number }>('item')).toEqual({ count: 2 })
    await storage.clear()
    expect(await storage.keys()).toEqual([])
  })

  it('migrates and purges expired entries', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const raw = createMemoryStorage()
    raw.setItem('value', JSON.stringify({ expiresAt: 1_010, updatedAt: 1_000, value: 1, version: 1 }))
    const storage = new AsyncStorageWithExpiration(createAsyncStorageAdapter(raw), {
      migrate: async (value) => Number(value) + 1,
      validateKey: false,
      version: 2
    })

    expect(await storage.getValue<number>('value')).toBe(2)
    vi.setSystemTime(1_011)
    expect(await storage.purgeExpired()).toBe(1)
  })

  it('handles adapter limitations, validation and parse failures', async () => {
    const values = new Map<string, string>([['bad', 'not-json']])
    const parseError = vi.fn()
    const storage = new AsyncStorageWithExpiration(
      {
        getItem: (key) => values.get(key) ?? null,
        removeItem: (key) => {
          values.delete(key)
        },
        setItem: (key, value) => {
          values.set(key, value)
        }
      },
      { onParseError: parseError }
    )

    expect((await storage.getItem('bad')).found).toBe(false)
    expect(parseError).toHaveBeenCalledOnce()
    await expect(storage.keys()).rejects.toThrow('key enumeration')
    await expect(storage.setItem('bad-key', 1)).rejects.toThrow('Invalid key format')
    await expect(storage.setItem('valid_key', 1, { ttl: -1 })).rejects.toThrow(RangeError)
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

  it('waits for events, emits in parallel and exposes listener state', async () => {
    const emitter = new EventEmitter<Events>()
    const calls: string[] = []
    let releaseFirst!: () => void
    let releaseSecond!: () => void
    emitter.on('user:login', async () => {
      calls.push('first:start')
      await new Promise<void>((resolve) => (releaseFirst = resolve))
      calls.push('first:end')
    })
    emitter.on('user:login', async () => {
      calls.push('second:start')
      await new Promise<void>((resolve) => (releaseSecond = resolve))
      calls.push('second:end')
    })

    expect(emitter.hasListeners('user:login')).toBe(true)
    expect(emitter.eventNames()).toEqual(['user:login'])
    const waiting = emitter.waitFor('logout', { timeout: 100 })
    emitter.emit('logout')
    await expect(waiting).resolves.toBeUndefined()

    const emitted = emitter.emitParallel('user:login', { id: '1' })
    await Promise.resolve()
    expect(calls).toEqual(['first:start', 'second:start'])
    releaseSecond()
    releaseFirst()
    await emitted
    expect(calls).toEqual(['first:start', 'second:start', 'second:end', 'first:end'])
    expect(emitter.hasListeners()).toBe(true)
  })

  it('cancels and times out event waits', async () => {
    const emitter = new EventEmitter<Events>()
    const controller = new AbortController()
    const aborted = emitter.waitFor('logout', { signal: controller.signal })
    controller.abort(new Error('cancel wait'))
    await expect(aborted).rejects.toThrow('cancel wait')

    vi.useFakeTimers()
    const timed = emitter.waitFor('logout', { timeout: 10 })
    const expectation = expect(timed).rejects.toThrow('Timed out waiting')
    await vi.advanceTimersByTimeAsync(10)
    await expectation
    await expect(emitter.waitFor('logout', { timeout: -1 })).rejects.toThrow(RangeError)
    expect(emitter.hasListeners()).toBe(false)
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
