export type EventListener<T> = (event: T) => void
export type Unsubscribe = () => void

class EventEmitter<T extends object> {
  private listeners: {
    [K in keyof T]?: EventListener<T[K]>[]
  } = {}

  on<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): Unsubscribe {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }

    this.listeners[eventName]!.push(listener)

    return () => this.off(eventName, listener)
  }

  off<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    if (!this.listeners[eventName]) return
    this.listeners[eventName] = this.listeners[eventName]!.filter((item) => item !== listener)
  }

  once<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): Unsubscribe {
    const onceListener: EventListener<T[K]> = (data) => {
      this.off(eventName, onceListener)
      listener(data)
    }

    return this.on(eventName, onceListener)
  }

  emit<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]): void {
    const eventListeners = [...(this.listeners[eventName] ?? [])]

    eventListeners.forEach((listener) => listener(args[0] as T[K]))
  }

  safeEmit<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]) {
    const errors: unknown[] = []
    const eventListeners = [...(this.listeners[eventName] ?? [])]

    eventListeners.forEach((listener) => {
      try {
        listener(args[0] as T[K])
      } catch (error) {
        errors.push(error)
      }
    })

    return errors
  }

  clear<K extends keyof T>(eventName?: K): void {
    if (eventName === undefined) {
      this.listeners = {}
      return
    }

    delete this.listeners[eventName]
  }

  listenerCount<K extends keyof T>(eventName: K) {
    return this.listeners[eventName]?.length ?? 0
  }
}

const createListenerHelper =
  <T extends object>() =>
  <K extends keyof T>(_: K, listener: EventListener<T[K]>) =>
    listener

export { createListenerHelper, EventEmitter }
