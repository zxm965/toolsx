export type StorageExpiration = Date | number | null
export type StorageParseErrorStrategy = 'remove' | 'keep'

export interface StorageWithExpirationOptions {
  validateKey?: boolean | RegExp | ((key: string) => boolean)
  onParseError?: (error: unknown, key: string, rawValue: string) => void
  parseErrorStrategy?: StorageParseErrorStrategy
  serialize?: (value: unknown) => string
  deserialize?: <T>(value: string) => T
}

export interface StorageItem<T> {
  value: T
  expiresAt: number | null
}

export interface StorageSetOptions {
  expiresAt?: StorageExpiration
}

export type StorageGetResult<T> =
  | { found: true; expired: false; value: T; expiresAt: number | null }
  | { found: true; expired: true; value: T; expiresAt: number }
  | { found: false; expired: false; value: null; expiresAt: null }

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

  const key = '__toolsx_storage_test__'

  try {
    storage.setItem(key, key)
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

class StorageWithExpiration {
  private storage: Storage
  private options: Required<Pick<StorageWithExpirationOptions, 'parseErrorStrategy' | 'serialize' | 'deserialize'>> &
    Omit<StorageWithExpirationOptions, 'parseErrorStrategy' | 'serialize' | 'deserialize'>

  constructor(storage: Storage, options: StorageWithExpirationOptions = {}) {
    this.storage = storage
    this.options = {
      parseErrorStrategy: 'remove',
      serialize: JSON.stringify,
      deserialize: JSON.parse,
      ...options
    }
  }

  private isValidKeyFormat(key: string): boolean {
    const validateKey = this.options.validateKey

    if (validateKey === false) return true
    if (validateKey instanceof RegExp) return validateKey.test(key)
    if (typeof validateKey === 'function') return validateKey(key)

    return defaultKeyPattern.test(key)
  }

  private validateKey(key: string): void {
    if (!this.isValidKeyFormat(key)) {
      throw new Error(`Invalid key format: ${key}. Key must only contain English letters and underscores.`)
    }
  }

  private normalizeExpiration(expiresAt?: StorageExpiration) {
    if (expiresAt === undefined || expiresAt === null) {
      return null
    }

    const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt

    if (!Number.isFinite(timestamp)) {
      throw new Error(`Invalid expiresAt: ${expiresAt}`)
    }

    return timestamp
  }

  private createMissingResult<T>(): StorageGetResult<T> {
    return { found: false, expired: false, value: null, expiresAt: null }
  }

  setItem<T>(key: string, value: T, options: StorageSetOptions = {}): void {
    this.validateKey(key)

    const item: StorageItem<T> = {
      value,
      expiresAt: this.normalizeExpiration(options.expiresAt)
    }

    this.storage.setItem(key, this.options.serialize(item))
  }

  getItem<T>(key: string): StorageGetResult<T> {
    this.validateKey(key)

    const itemStr = this.storage.getItem(key)
    if (!itemStr) {
      return this.createMissingResult<T>()
    }

    try {
      const item = this.options.deserialize<StorageItem<T>>(itemStr)
      const expiresAt = item.expiresAt ?? null

      if (expiresAt && Date.now() > expiresAt) {
        this.storage.removeItem(key)
        return { found: true, expired: true, value: item.value, expiresAt }
      }

      return { found: true, expired: false, value: item.value, expiresAt }
    } catch (error) {
      this.options.onParseError?.(error, key, itemStr)

      if (this.options.parseErrorStrategy === 'remove') {
        this.storage.removeItem(key)
      }

      return this.createMissingResult<T>()
    }
  }

  getValue<T>(key: string): T | null {
    const result = this.getItem<T>(key)

    return result.found && !result.expired ? result.value : null
  }

  removeItem(key: string): void {
    this.validateKey(key)
    this.storage.removeItem(key)
  }

  clear(): void {
    this.storage.clear()
  }
}
export { StorageWithExpiration }
