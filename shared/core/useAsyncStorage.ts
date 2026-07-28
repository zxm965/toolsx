import type { StorageGetResult, StorageMigrationContext, StorageParseErrorStrategy, StorageSetOptions } from './useStorage'

export type AsyncStorageValue<T> = T | PromiseLike<T>

export interface AsyncStorageAdapter {
  clear?: () => AsyncStorageValue<void>
  getItem: (key: string) => AsyncStorageValue<string | null>
  keys?: () => AsyncStorageValue<readonly string[]>
  removeItem: (key: string) => AsyncStorageValue<void>
  setItem: (key: string, value: string) => AsyncStorageValue<void>
}

export interface AsyncStorageWithExpirationOptions {
  deserialize?: <T>(value: string) => T
  migrate?: (value: unknown, context: StorageMigrationContext) => AsyncStorageValue<unknown>
  namespace?: string
  onParseError?: (error: unknown, key: string, rawValue: string) => AsyncStorageValue<void>
  parseErrorStrategy?: StorageParseErrorStrategy
  serialize?: (value: unknown) => string
  slidingExpiration?: number
  validateKey?: boolean | RegExp | ((key: string) => boolean)
  version?: number
}

interface AsyncStorageItem<T> {
  expiresAt: number | null
  slidingExpiration?: number
  updatedAt: number
  value: T
  version: number
}

const defaultKeyPattern = /^[a-zA-Z]+(_[a-zA-Z]+)*$/

export function createAsyncStorageAdapter(storage: Storage): AsyncStorageAdapter {
  return {
    clear: () => storage.clear(),
    getItem: (key) => storage.getItem(key),
    keys: () => Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key !== null),
    removeItem: (key) => storage.removeItem(key),
    setItem: (key, value) => storage.setItem(key, value)
  }
}

class AsyncStorageWithExpiration {
  private adapter: AsyncStorageAdapter
  private options: Required<Pick<AsyncStorageWithExpirationOptions, 'deserialize' | 'parseErrorStrategy' | 'serialize' | 'version'>> &
    Omit<AsyncStorageWithExpirationOptions, 'deserialize' | 'parseErrorStrategy' | 'serialize' | 'version'>
  private pendingValues = new Map<string, Promise<unknown>>()

  constructor(adapter: AsyncStorageAdapter, options: AsyncStorageWithExpirationOptions = {}) {
    this.adapter = adapter
    this.options = {
      deserialize: JSON.parse,
      parseErrorStrategy: 'remove',
      serialize: JSON.stringify,
      version: 1,
      ...options
    }
  }

  private isValidKeyFormat(key: string) {
    const validateKey = this.options.validateKey
    if (validateKey === false) return true
    if (validateKey instanceof RegExp) {
      validateKey.lastIndex = 0
      return validateKey.test(key)
    }
    if (typeof validateKey === 'function') return validateKey(key)
    return defaultKeyPattern.test(key)
  }

  private validateKey(key: string) {
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
    return { expiresAt: null, expired: false, found: false, value: null, version: null }
  }

  private async listStorageKeys() {
    if (!this.adapter.keys) throw new Error('Async storage adapter does not support key enumeration')
    return [...(await this.adapter.keys())]
  }

  async setItem<T>(key: string, value: T, options: StorageSetOptions = {}) {
    this.validateKey(key)
    const { expiresAt, slidingExpiration } = this.normalizeExpiration(options)
    const item: AsyncStorageItem<T> = {
      expiresAt,
      slidingExpiration,
      updatedAt: Date.now(),
      value,
      version: this.options.version
    }
    await this.adapter.setItem(this.toStorageKey(key), this.options.serialize(item))
  }

  async getItem<T>(key: string): Promise<StorageGetResult<T>> {
    this.validateKey(key)
    const storageKey = this.toStorageKey(key)
    const rawValue = await this.adapter.getItem(storageKey)
    if (rawValue === null) return this.createMissingResult<T>()

    try {
      let item = this.options.deserialize<AsyncStorageItem<T>>(rawValue)
      if (typeof item !== 'object' || item === null || !('value' in item)) throw new Error(`Invalid storage item: ${key}`)
      if (item.expiresAt !== null && item.expiresAt !== undefined && !Number.isFinite(item.expiresAt)) {
        throw new Error(`Invalid storage expiration: ${key}`)
      }

      const fromVersion = item.version ?? 1
      if (fromVersion < this.options.version && this.options.migrate) {
        item = {
          ...item,
          updatedAt: Date.now(),
          value: (await this.options.migrate(item.value, { fromVersion, key, toVersion: this.options.version })) as T,
          version: this.options.version
        }
        await this.adapter.setItem(storageKey, this.options.serialize(item))
      }

      const expiresAt = item.expiresAt ?? null
      const version = item.version ?? fromVersion
      if (expiresAt !== null && Date.now() >= expiresAt) {
        await this.adapter.removeItem(storageKey)
        return { expiresAt, expired: true, found: true, value: item.value, version }
      }

      const slidingExpiration = item.slidingExpiration ?? this.options.slidingExpiration
      if (slidingExpiration !== undefined) {
        this.normalizeDuration(slidingExpiration, 'slidingExpiration')
        item = { ...item, expiresAt: Date.now() + slidingExpiration, slidingExpiration, updatedAt: Date.now() }
        await this.adapter.setItem(storageKey, this.options.serialize(item))
      }

      return { expiresAt: item.expiresAt ?? null, expired: false, found: true, value: item.value, version }
    } catch (error) {
      await this.options.onParseError?.(error, key, rawValue)
      if (this.options.parseErrorStrategy === 'remove') await this.adapter.removeItem(storageKey)
      return this.createMissingResult<T>()
    }
  }

  async getValue<T>(key: string) {
    const item = await this.getItem<T>(key)
    return item.found && !item.expired ? item.value : null
  }

  async getOrSet<T>(key: string, createValue: () => AsyncStorageValue<T>, options: StorageSetOptions = {}) {
    const existing = await this.getItem<T>(key)
    if (existing.found && !existing.expired) return existing.value

    const storageKey = this.toStorageKey(key)
    const pending = this.pendingValues.get(storageKey) as Promise<T> | undefined
    if (pending) return await pending

    const task = Promise.resolve(createValue()).then(async (value) => {
      await this.setItem(key, value, options)
      return value
    })
    this.pendingValues.set(storageKey, task)

    try {
      return await task
    } finally {
      if (this.pendingValues.get(storageKey) === task) this.pendingValues.delete(storageKey)
    }
  }

  async has(key: string) {
    const item = await this.getItem(key)
    return item.found && !item.expired
  }

  async keys() {
    return (await this.listStorageKeys()).filter((key) => this.isOwnedStorageKey(key)).map((key) => this.toLogicalKey(key))
  }

  async entries<T = unknown>() {
    const result: [string, T][] = []
    for (const key of await this.keys()) {
      const item = await this.getItem<T>(key)
      if (item.found && !item.expired) result.push([key, item.value])
    }
    return result
  }

  async values<T = unknown>() {
    return (await this.entries<T>()).map(([, value]) => value)
  }

  async updateItem<T>(key: string, updater: (value: T) => AsyncStorageValue<T>, options: StorageSetOptions = {}) {
    const current = await this.getItem<T>(key)
    if (!current.found || current.expired) return null
    const value = await updater(current.value)
    const nextOptions =
      options.expiresAt === undefined && options.slidingExpiration === undefined && options.ttl === undefined ? { expiresAt: current.expiresAt } : options
    await this.setItem(key, value, nextOptions)
    return value
  }

  async purgeExpired() {
    let removed = 0
    for (const key of await this.keys()) {
      const item = await this.getItem(key)
      if (item.found && item.expired) removed += 1
    }
    return removed
  }

  async removeItem(key: string) {
    this.validateKey(key)
    await this.adapter.removeItem(this.toStorageKey(key))
  }

  async clear() {
    if (!this.options.namespace && this.adapter.clear) {
      await this.adapter.clear()
      return
    }

    for (const key of await this.keys()) await this.adapter.removeItem(this.toStorageKey(key))
  }
}

export { AsyncStorageWithExpiration }
