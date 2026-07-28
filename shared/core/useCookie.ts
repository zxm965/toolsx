export type CookieSameSite = 'Strict' | 'Lax' | 'None'
export type CookiePriority = 'Low' | 'Medium' | 'High'

export interface CookieOptions {
  domain?: string
  expires?: Date | number
  httpOnly?: boolean
  maxAge?: number
  onSuccess?: () => void
  partitioned?: boolean
  path?: string
  priority?: CookiePriority
  sameSite?: CookieSameSite
  secure?: boolean
}

export interface CookieAdapter {
  read: () => string
  write: (value: string) => void
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeExpires(expires?: Date | number) {
  if (expires === undefined) {
    return undefined
  }

  const normalized = expires instanceof Date ? expires : new Date(expires)

  if (!Number.isFinite(normalized.getTime())) {
    throw new RangeError(`Invalid cookie expiration: ${String(expires)}`)
  }

  return normalized
}

function getBrowserAdapter(): CookieAdapter | undefined {
  if (typeof document === 'undefined') return undefined

  return {
    read: () => document.cookie,
    write: (value) => {
      document.cookie = value
    }
  }
}

export function parseCookieHeader(header = '') {
  const result: Record<string, string> = {}

  for (const segment of header.split(';')) {
    const separator = segment.indexOf('=')
    if (separator < 0) continue

    const name = safeDecode(segment.slice(0, separator).trim())
    if (!name) continue
    result[name] = safeDecode(segment.slice(separator + 1).trim())
  }

  return result
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  if (!name) {
    throw new Error('Cookie name must not be empty')
  }

  const { domain, httpOnly, maxAge, partitioned, path = '/', priority, sameSite, secure } = options
  const expires = normalizeExpires(options.expires)
  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

  if (expires) segments.push(`Expires=${expires.toUTCString()}`)
  if (maxAge !== undefined) segments.push(`Max-Age=${Math.trunc(maxAge)}`)
  if (domain) segments.push(`Domain=${domain}`)
  if (path) segments.push(`Path=${path}`)
  if (sameSite) segments.push(`SameSite=${sameSite}`)
  if (secure) segments.push('Secure')
  if (httpOnly) segments.push('HttpOnly')
  if (partitioned) segments.push('Partitioned')
  if (priority) segments.push(`Priority=${priority}`)

  return segments.join('; ')
}

class Cookie {
  private adapter?: CookieAdapter
  private defaults: CookieOptions

  constructor(defaults: CookieOptions = {}, adapter?: CookieAdapter) {
    this.defaults = defaults
    this.adapter = adapter
  }

  private getAdapter() {
    return this.adapter ?? getBrowserAdapter()
  }

  private getOptions(options: CookieOptions) {
    return { path: '/', ...this.defaults, ...options }
  }

  public isAvailable() {
    return Boolean(this.getAdapter())
  }

  public set(name: string, value: string, options: CookieOptions = {}) {
    const adapter = this.getAdapter()
    if (!adapter) return false

    const mergedOptions = this.getOptions(options)
    adapter.write(serializeCookie(name, value, mergedOptions))
    mergedOptions.onSuccess?.()
    return true
  }

  public setJSON<T>(name: string, value: T, options: CookieOptions = {}) {
    const serialized = JSON.stringify(value)

    if (serialized === undefined) {
      throw new Error('Cookie JSON value is not serializable')
    }

    return this.set(name, serialized, options)
  }

  public get(name: string): string | null {
    return this.getAll()[name] ?? null
  }

  public getJSON<T>(name: string, fallback: T | null = null): T | null {
    const value = this.get(name)
    if (value === null) return fallback

    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  public getAll() {
    return parseCookieHeader(this.getAdapter()?.read() ?? '')
  }

  public has(name: string) {
    return Object.prototype.hasOwnProperty.call(this.getAll(), name)
  }

  public remove(name: string, options: Pick<CookieOptions, 'domain' | 'path'> = {}) {
    return this.set(name, '', { ...options, expires: new Date(0), maxAge: 0 })
  }

  public clear(options: Pick<CookieOptions, 'domain' | 'path'> = {}) {
    const names = Object.keys(this.getAll())
    names.forEach((name) => this.remove(name, options))
    return names.length
  }
}

export { Cookie }
