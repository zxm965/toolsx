export interface CookieOptions {
  expires?: Date;
  onSuccess?: () => void;
}

class Cookie {
  // 设置方法
  public set(name: string, value: string, options?: CookieOptions) {
    const { expires, onSuccess } = options || {};
    let useExpires = "";
    const date = new Date();
    // 保留 30 minutes
    date.setTime((expires ? expires.getTime() : date.getTime()) + 30 * 60 * 1000);
    useExpires = `; expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value || ""}${useExpires}; path=/`;
    if (typeof onSuccess === "function") {
      onSuccess();
    }
  }

  // 获取方法
  public get(name: string): string | null {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i += 1) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0)
        return c.substring(nameEQ.length, c.length) as string;
    }
    return null;
  }

  // 移除方法
  public remove(name: string) {
    this.set(name, "", { expires: new Date(0) });
  }

}

export { Cookie };
