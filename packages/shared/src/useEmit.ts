// 定义事件监听器的类型
type EventListener<T> = (event: T) => void;

// 事件管理器类
class EventEmitter<T> {
  private listeners: {
    [K in keyof T]?: EventListener<T[K]>[];
  } = {} as {
    [K in keyof T]?: EventListener<T[K]>[];
  };

  // 注册事件监听器
  on<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName]!.push(listener);
  }

  // 移除事件监听器
  off<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName]!.filter(l => l !== listener);
  }

  // 触发事件
  emit<K extends keyof T>(eventName: K, event: T[K]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName]!.forEach(listener => listener(event));
  }
}

export { EventEmitter };
