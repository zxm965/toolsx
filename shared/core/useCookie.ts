export type CookieSameSite = 'Strict' | 'Lax' | 'None'

export interface CookieOptions {
  expires?: Date | number
  maxAge?: number
  path?: string
  domain?: string
  sameSite?: CookieSameSite
  secure?: boolean
  onSuccess?: () => void
}

function normalizeExpires(expires?: Date | number) {
  if (expires === undefined) {
    return undefined
  }

  return expires instanceof Date ? expires : new Date(expires)
}

class Cookie {
  public set(name: string, value: string, options: CookieOptions = {}) {
    const { domain, maxAge, onSuccess, path = '/', sameSite, secure } = options
    const expires = normalizeExpires(options.expires)
    const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`]

    if (expires) {
      segments.push(`expires=${expires.toUTCString()}`)
    }

    if (maxAge !== undefined) {
      segments.push(`max-age=${maxAge}`)
    }

    if (domain) {
      segments.push(`domain=${domain}`)
    }

    if (path) {
      segments.push(`path=${path}`)
    }

    if (sameSite) {
      segments.push(`samesite=${sameSite}`)
    }

    if (secure) {
      segments.push('secure')
    }

    document.cookie = segments.join('; ')
    onSuccess?.()
  }

  public get(name: string): string | null {
    const encodedName = `${encodeURIComponent(name)}=`
    const cookies = document.cookie ? document.cookie.split('; ') : []

    for (const cookie of cookies) {
      if (cookie.startsWith(encodedName)) {
        return decodeURIComponent(cookie.slice(encodedName.length))
      }
    }

    return null
  }

  public remove(name: string, options: Pick<CookieOptions, 'domain' | 'path'> = {}) {
    this.set(name, '', { ...options, expires: new Date(0), maxAge: 0 })
  }
}

export { Cookie }
