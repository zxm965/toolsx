export type StorageExpiration = Date | number | null
export type StorageParseErrorStrategy = 'remove' | 'keep'
export type StorageChangeType = 'set' | 'remove' | 'clear'

export interface StorageMigrationContext {
  fromVersion: number
  key: string
  toVersion: number
}

export interface StorageSyncOptions {
  broadcast?: boolean
  channelName?: string
}

export interface StorageWithExpirationOptions {
  deserialize?: <T>(value: string) => T
  fallbackStorage?: Storage | false
  migrate?: (value: unknown, context: StorageMigrationContext) => unknown
  namespace?: string
  onParseError?: (error: unknown, key: string, rawValue: string) => void
  onQuotaError?: (error: unknown, key: string) => void
  parseErrorStrategy?: StorageParseErrorStrategy
  serialize?: (value: unknown) => string
  slidingExpiration?: number
  sync?: boolean | StorageSyncOptions
  validateKey?: boolean | RegExp | ((key: string) => boolean)
  version?: number
}

export interface StorageItem<T> {
  expiresAt: number | null
  slidingExpiration?: number
  updatedAt?: number
  value: T
  version?: number
}

export interface StorageSetOptions {
  expiresAt?: StorageExpiration
  slidingExpiration?: number
  ttl?: number
}

export type StorageGetResult<T> =
  | { found: true; expired: false; value: T; expiresAt: number | null; version: number }
  | { found: true; expired: true; value: T; expiresAt: number; version: number }
  | { found: false; expired: false; value: null; expiresAt: null; version: null }

export interface StorageChange<T = unknown> {
  key?: string
  source: 'local' | 'external'
  type: StorageChangeType
  value?: T
}

interface StorageBroadcastMessage extends StorageChange {
  instanceId: string
}

const defaultKeyPattern = /^[a-zA-Z]+(_[a-zA-Z]+)*$/

export function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value)
  }
}

export function isStorageAvailable(storage: Storage | null | undefined) {
  if (!storage) {
    return false
  }

  const key = `__toolsx_storage_test_${Date.now()}_${Math.random()}__`

  try {
    storage.setItem(key, key)
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function getStorageKeys(storage: Storage) {
  const keys: string[] = []

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null) keys.push(key)
    }
  } catch {
    return []
  }

  return keys
}

class StorageWithExpiration {
  private storage: Storage
  private fallbackStorage?: Storage
  private options: Required<Pick<StorageWithExpirationOptions, 'parseErrorStrategy' | 'serialize' | 'deserialize' | 'version'>> &
    Omit<StorageWithExpirationOptions, 'parseErrorStrategy' | 'serialize' | 'deserialize' | 'version' | 'fallbackStorage'>
  private listeners = new Set<(change: StorageChange) => void>()
  private broadcastChannel?: BroadcastChannel
  private removeStorageListener?: () => void
  private instanceId = `${Date.now()}_${Math.random().toString(36).slice(2)}`

  constructor(storage: Storage, options: StorageWithExpirationOptions = {}) {
    this.storage = storage
    this.fallbackStorage = options.fallbackStorage === false ? undefined : (options.fallbackStorage ?? createMemoryStorage())
    this.options = {
      parseErrorStrategy: 'remove',
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      version: 1,
      ...options
    }
    this.initializeSync()
  }

  private initializeSync() {
    if (!this.options.sync) return

    const syncOptions = typeof this.options.sync === 'object' ? this.options.sync : {}
    const channelName = syncOptions.channelName ?? `toolsx-storage-${this.options.namespace ?? 'default'}`

    if (syncOptions.broadcast !== false && typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(channelName)
      this.broadcastChannel.addEventListener('message', (event: MessageEvent<StorageBroadcastMessage>) => {
        if (event.data.instanceId === this.instanceId) return
        const { instanceId: _, ...change } = event.data
        this.notify({ ...change, source: 'external' }, false)
      })
      return
    }

    if (typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea !== this.storage || (event.key && !this.isOwnedStorageKey(event.key))) return

        const key = event.key ? this.toLogicalKey(event.key) : undefined
        const type: StorageChangeType = event.key === null ? 'clear' : event.newValue === null ? 'remove' : 'set'
        this.notify({ key, source: 'external', type }, false)
      }

      window.addEventListener('storage', onStorage)
      this.removeStorageListener = () => window.removeEventListener('storage', onStorage)
    }
  }

  private isValidKeyFormat(key: string): boolean {
    const validateKey = this.options.validateKey

    if (validateKey === false) return true
    if (validateKey instanceof RegExp) {
      validateKey.lastIndex = 0
      return validateKey.test(key)
    }
    if (typeof validateKey === 'function') return validateKey(key)

    return defaultKeyPattern.test(key)
  }

  private validateKey(key: string): void {
    if (!this.isValidKeyFormat(key)) {
      throw new Error(`Invalid key format: ${key}. Key must only contain English letters and underscores.`)
    }
  }

  private toStorageKey(key: string) {
    return this.options.namespace ? `${this.options.namespace}:${key}` : key
  }

  private toLogicalKey(key: string) {
    return this.options.namespace ? key.slice(this.options.namespace.length + 1) : key
  }

  private isOwnedStorageKey(key: string) {
    return this.options.namespace ? key.startsWith(`${this.options.namespace}:`) : true
  }

  private normalizeDuration(value: number | undefined, name: string) {
    if (value === undefined) return undefined
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`Invalid ${name}: ${value}`)
    return value
  }

  private normalizeExpiration(options: StorageSetOptions) {
    const slidingExpiration = this.normalizeDuration(options.slidingExpiration ?? this.options.slidingExpiration, 'slidingExpiration')
    const ttl = this.normalizeDuration(options.ttl, 'ttl')

    if (options.expiresAt !== undefined && options.expiresAt !== null) {
      const timestamp = options.expiresAt instanceof Date ? options.expiresAt.getTime() : options.expiresAt
      if (!Number.isFinite(timestamp)) throw new RangeError(`Invalid expiresAt: ${String(options.expiresAt)}`)
      return { expiresAt: timestamp, slidingExpiration }
    }

    const duration = ttl ?? slidingExpiration
    return { expiresAt: duration === undefined ? null : Date.now() + duration, slidingExpiration }
  }

  private createMissingResult<T>(): StorageGetResult<T> {
    return { found: false, expired: false, value: null, expiresAt: null, version: null }
  }

  private readRaw(storageKey: string) {
    try {
      const value = this.storage.getItem(storageKey)
      if (value !== null) return value
    } catch {
      // Fall through to the configured fallback storage.
    }

    try {
      return this.fallbackStorage?.getItem(storageKey) ?? null
    } catch {
      return null
    }
  }

  private writeRaw(storageKey: string, value: string) {
    try {
      this.storage.setItem(storageKey, value)
      this.fallbackStorage?.removeItem(storageKey)
      return
    } catch (error) {
      this.options.onQuotaError?.(error, this.toLogicalKey(storageKey))

      if (!this.fallbackStorage) throw error
      this.fallbackStorage.setItem(storageKey, value)
    }
  }

  private removeRaw(storageKey: string) {
    try {
      this.storage.removeItem(storageKey)
    } catch {
      // The fallback storage may still be writable.
    }

    try {
      this.fallbackStorage?.removeItem(storageKey)
    } catch {
      // Removing an unavailable fallback is intentionally ignored.
    }
  }

  private notify(change: StorageChange, broadcast = true) {
    this.listeners.forEach((listener) => listener(change))

    if (broadcast) {
      this.broadcastChannel?.postMessage({ ...change, instanceId: this.instanceId } satisfies StorageBroadcastMessage)
    }
  }

  private parseItem<T>(key: string, rawValue: string) {
    const item = this.options.deserialize<StorageItem<T>>(rawValue)

    if (typeof item !== 'object' || item === null || !('value' in item)) {
      throw new Error(`Invalid storage item: ${key}`)
    }

    if (item.expiresAt !== undefined && item.expiresAt !== null && !Number.isFinite(item.expiresAt)) {
      throw new Error(`Invalid storage expiration: ${key}`)
    }

    return item
  }

  setItem<T>(key: string, value: T, options: StorageSetOptions = {}): void {
    this.validateKey(key)
    const { expiresAt, slidingExpiration } = this.normalizeExpiration(options)
    const item: StorageItem<T> = {
      value,
      expiresAt,
      slidingExpiration,
      updatedAt: Date.now(),
      version: this.options.version
    }

    this.writeRaw(this.toStorageKey(key), this.options.serialize(item))
    this.notify({ key, source: 'local', type: 'set', value })
  }

  getItem<T>(key: string): StorageGetResult<T> {
    this.validateKey(key)
    const storageKey = this.toStorageKey(key)
    const itemStr = this.readRaw(storageKey)
    if (itemStr === null) return this.createMissingResult<T>()

    try {
      let item = this.parseItem<T>(key, itemStr)
      const fromVersion = item.version ?? 1

      if (fromVersion < this.options.version && this.options.migrate) {
        item = {
          ...item,
          value: this.options.migrate(item.value, { fromVersion, key, toVersion: this.options.version }) as T,
          updatedAt: Date.now(),
          version: this.options.version
        }
        this.writeRaw(storageKey, this.options.serialize(item))
      }

      const expiresAt = item.expiresAt ?? null
      const version = item.version ?? fromVersion

      if (expiresAt !== null && Date.now() >= expiresAt) {
        this.removeRaw(storageKey)
        this.notify({ key, source: 'local', type: 'remove' })
        return { found: true, expired: true, value: item.value, expiresAt, version }
      }

      const slidingExpiration = item.slidingExpiration ?? this.options.slidingExpiration

      if (slidingExpiration !== undefined) {
        item.slidingExpiration = slidingExpiration
        item.expiresAt = Date.now() + slidingExpiration
        item.updatedAt = Date.now()
        this.writeRaw(storageKey, this.options.serialize(item))
      }

      return { found: true, expired: false, value: item.value, expiresAt: item.expiresAt ?? null, version }
    } catch (error) {
      this.options.onParseError?.(error, key, itemStr)

      if (this.options.parseErrorStrategy === 'remove') {
        this.removeRaw(storageKey)
      }

      return this.createMissingResult<T>()
    }
  }

  getValue<T>(key: string): T | null {
    const result = this.getItem<T>(key)
    return result.found && !result.expired ? result.value : null
  }

  getOrSet<T>(key: string, createValue: () => T, options: StorageSetOptions = {}) {
    const existing = this.getItem<T>(key)
    if (existing.found && !existing.expired) return existing.value

    const value = createValue()
    this.setItem(key, value, options)
    return value
  }

  has(key: string) {
    const result = this.getItem(key)
    return result.found && !result.expired
  }

  keys() {
    const storageKeys = new Set([...getStorageKeys(this.storage), ...(this.fallbackStorage ? getStorageKeys(this.fallbackStorage) : [])])

    return [...storageKeys].filter((key) => this.isOwnedStorageKey(key)).map((key) => this.toLogicalKey(key))
  }

  removeItem(key: string): void {
    this.validateKey(key)
    this.removeRaw(this.toStorageKey(key))
    this.notify({ key, source: 'local', type: 'remove' })
  }

  clear(): void {
    if (!this.options.namespace) {
      try {
        this.storage.clear()
      } catch {
        // Continue clearing the fallback storage.
      }
      try {
        this.fallbackStorage?.clear()
      } catch {
        // Clearing an unavailable fallback is intentionally ignored.
      }
    } else {
      this.keys().forEach((key) => this.removeRaw(this.toStorageKey(key)))
    }

    this.notify({ source: 'local', type: 'clear' })
  }

  subscribe(listener: (change: StorageChange) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  destroy() {
    this.removeStorageListener?.()
    this.broadcastChannel?.close()
    this.listeners.clear()
  }
}

export { StorageWithExpiration }
