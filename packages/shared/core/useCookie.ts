export interface CookieOptions {
  expires?: Date
  onSuccess?: () => void
}

class Cookie {
  // set a cookie
  public set(name: string, value: string, options?: CookieOptions) {
    const { expires, onSuccess } = options || {}
    let useExpires = ''
    const date = new Date()
    // default to 30 minutes
    date.setTime(
      (expires ? expires.getTime() : date.getTime()) + 30 * 60 * 1000,
    )
    useExpires = `; expires=${date.toUTCString()}`
    document.cookie = `${name}=${value || ''}${useExpires}; path=/`
    if (typeof onSuccess === 'function') {
      onSuccess()
    }
  }

  // get a cookie
  public get(name: string): string | null {
    const nameEQ = `${name}=`
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i += 1) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0)
        return c.substring(nameEQ.length, c.length) as string
    }
    return null
  }

  // remove a cookie
  public remove(name: string) {
    this.set(name, '', { expires: new Date(0) })
  }
}

export { Cookie }
