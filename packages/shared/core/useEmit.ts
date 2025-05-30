// define the type of event listener
type EventListener<T> = (event: T) => void

// create a event emitter class
class EventEmitter<T> {
  private listeners: {
    [K in keyof T]?: EventListener<T[K]>[]
  } = {}

  // create a event listener
  on<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName]!.push(listener)
  }

  // remove a event listener
  off<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    if (!this.listeners[eventName]) return
    this.listeners[eventName] = this.listeners[eventName]!.filter(
      (l) => l !== listener,
    )
  }

  // create a event listener that only trigger once
  once<K extends keyof T>(event: K, listener: EventListener<T[K]>): void {
    const onceListener: EventListener<T[K]> = (data) => {
      this.off(event, onceListener)
      listener(data)
    }
    this.on(event, onceListener)
  }

  // trigger a event
  emit<K extends keyof T>(eventName: K, event: T[K]): void {
    if (!this.listeners[eventName]) return
    this.listeners[eventName]!.forEach((listener) => listener(event))
  }
}

/**
 * @description create a listener helper function
 * you can use this helper function to create a listener
 * @example
 * type Events = {
 *  event: string
 * }
 * const emitter = new EventEmitter<Events>()
 * const createListener = createListenerHelper<Events>()
 * const listener = createListener('event', (data) => {})
 * emitter.on('event', listener)
 * emitter.off('event', listener)
 */
const createListenerHelper =
  <T>() =>
  <K extends keyof T>(_: K, listener: EventListener<T[K]>) =>
    listener

export { createListenerHelper, EventEmitter }
