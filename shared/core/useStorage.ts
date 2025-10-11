interface StorageItem<T> {
  value: T;
  expiration?: number | null;
}
type ExpirationLaterType = 'minutes' | 'hours' | 'days';

interface SetItemOptions {
  laterThan?: number;
  laterType?: ExpirationLaterType;
  // can add more options in the future, such as:
  // isSensitive?: boolean;
}

class StorageWithExpiration {
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  private isValidKeyFormat(key: string): boolean {
    const keyFormatRegex = /^[a-zA-Z]+(_[a-zA-Z]+)*$/;
    return keyFormatRegex.test(key);
  }

  private validateKey(key: string): void {
    if (!this.isValidKeyFormat(key)) {
      throw new Error(`Invalid key format: ${key}. Key must only contain English letters and underscores.`);
    }
  }

  private calculateExpiration(laterThan: number, laterType: ExpirationLaterType = 'minutes'): number {
    const now = new Date();
    switch (laterType) {
      case 'minutes':
        return now.getTime() + laterThan * 60 * 1000;
      case 'hours':
        return now.getTime() + laterThan * 60 * 60 * 1000;
      case 'days':
        return now.getTime() + laterThan * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid laterType: ${laterType}`);
    }
  }

  setItem<T>(key: string, value: T, options?: SetItemOptions): void {
    this.validateKey(key);

    const item: StorageItem<T> = {
      value: value
    };

    if (options?.laterThan !== undefined) {
      item.expiration = this.calculateExpiration(options.laterThan, options.laterType);
    }

    this.storage.setItem(key, JSON.stringify(item));
  }

  getItem<T>(key: string): T | null {
    this.validateKey(key);

    const itemStr = this.storage.getItem(key);
    if (!itemStr) {
      return null;
    }

    try {
      const item: StorageItem<T> = JSON.parse(itemStr);
      const now = new Date();

      if (item.expiration && now.getTime() > item.expiration) {
        this.storage.removeItem(key);
        return null;
      }

      return item.value;
    } catch (e) {
      console.warn(`Failed to parse item for key: ${key}. Error: ${e}`);
      this.storage.removeItem(key);
      return null;
    }
  }

  removeItem(key: string): void {
    this.validateKey(key);
    this.storage.removeItem(key);
  }

  clear(): void {
    this.storage.clear();
  }
}
export { StorageWithExpiration };
