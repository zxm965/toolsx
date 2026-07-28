export type EventListener<T> = (event: T) => void | Promise<void>
export type Unsubscribe = () => void

export interface EventListenerOptions {
  priority?: number
  signal?: AbortSignal
}

export interface EventWaitOptions extends EventListenerOptions {
  timeout?: number
}

export interface EventEmitterOptions<T extends object> {
  maxListeners?: number
  onMaxListenersExceeded?: (eventName: keyof T | string, count: number) => void
}

export type EventAnyPayload<T extends object> = {
  [K in keyof T]: { eventName: K; payload: T[K] }
}[keyof T]

export type EventAnyListener<T extends object> = (event: EventAnyPayload<T>) => void | Promise<void>

interface ListenerEntry<TListener> {
  listener: TListener
  once: boolean
  priority: number
  unsubscribeSignal?: () => void
}

interface PatternListener<T extends object> extends ListenerEntry<EventAnyListener<T>> {
  pattern: string
}

interface Invocation {
  priority: number
  remove: () => void
  run: () => void | Promise<void>
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesPattern(pattern: string, eventName: PropertyKey) {
  if (typeof eventName !== 'string') return false
  const expression = pattern
    .split('*')
    .map((part) => escapeRegExp(part))
    .join('.*')

  return new RegExp(`^${expression}$`).test(eventName)
}

class EventEmitter<T extends object> {
  private listeners = new Map<keyof T, ListenerEntry<EventListener<T[keyof T]>>[]>()
  private anyListeners: ListenerEntry<EventAnyListener<T>>[] = []
  private patternListeners: PatternListener<T>[] = []
  private maxListeners: number
  private warnedEvents = new Set<keyof T | string>()
  private onMaxListenersExceeded?: EventEmitterOptions<T>['onMaxListenersExceeded']

  constructor(options: EventEmitterOptions<T> = {}) {
    this.maxListeners = options.maxListeners ?? 10
    this.onMaxListenersExceeded = options.onMaxListenersExceeded
  }

  private createEntry<TListener>(listener: TListener, options: EventListenerOptions, once: boolean): ListenerEntry<TListener> {
    return { listener, once, priority: options.priority ?? 0 }
  }

  private bindSignal(entry: ListenerEntry<unknown>, signal: AbortSignal | undefined, unsubscribe: Unsubscribe) {
    if (!signal) return
    const abort = () => unsubscribe()
    entry.unsubscribeSignal = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
  }

  private checkListenerLimit(eventName: keyof T | string, count: number) {
    if (this.maxListeners <= 0 || count <= this.maxListeners || this.warnedEvents.has(eventName)) return

    this.warnedEvents.add(eventName)

    if (this.onMaxListenersExceeded) {
      this.onMaxListenersExceeded(eventName, count)
      return
    }

    console.warn(`EventEmitter listener limit exceeded for ${String(eventName)}: ${count}/${this.maxListeners}`)
  }

  private add<K extends keyof T>(eventName: K, listener: EventListener<T[K]>, options: EventListenerOptions, once: boolean): Unsubscribe {
    if (options.signal?.aborted) return () => {}

    const entry = this.createEntry(listener as EventListener<T[keyof T]>, options, once)
    const eventListeners = this.listeners.get(eventName) ?? []
    eventListeners.push(entry)
    eventListeners.sort((left, right) => right.priority - left.priority)
    this.listeners.set(eventName, eventListeners)

    const unsubscribe = () => {
      entry.unsubscribeSignal?.()
      const current = this.listeners.get(eventName)
      if (!current) return
      const next = current.filter((item) => item !== entry)
      if (next.length) this.listeners.set(eventName, next)
      else this.listeners.delete(eventName)
    }

    this.bindSignal(entry, options.signal, unsubscribe)
    this.checkListenerLimit(eventName, eventListeners.length)

    return unsubscribe
  }

  on<K extends keyof T>(eventName: K, listener: EventListener<T[K]>, options: EventListenerOptions = {}): Unsubscribe {
    return this.add(eventName, listener, options, false)
  }

  off<K extends keyof T>(eventName: K, listener: EventListener<T[K]>): void {
    const eventListeners = this.listeners.get(eventName)
    if (!eventListeners) return

    for (const entry of eventListeners) {
      if (entry.listener === listener) entry.unsubscribeSignal?.()
    }

    const next = eventListeners.filter((entry) => entry.listener !== listener)
    if (next.length) this.listeners.set(eventName, next)
    else this.listeners.delete(eventName)
  }

  once<K extends keyof T>(eventName: K, listener: EventListener<T[K]>, options: EventListenerOptions = {}): Unsubscribe {
    return this.add(eventName, listener, options, true)
  }

  onAny(listener: EventAnyListener<T>, options: EventListenerOptions = {}): Unsubscribe {
    if (options.signal?.aborted) return () => {}

    const entry = this.createEntry(listener, options, false)
    this.anyListeners.push(entry)
    this.anyListeners.sort((left, right) => right.priority - left.priority)

    const unsubscribe = () => {
      entry.unsubscribeSignal?.()
      this.anyListeners = this.anyListeners.filter((item) => item !== entry)
    }

    this.bindSignal(entry, options.signal, unsubscribe)
    this.checkListenerLimit('*', this.anyListeners.length)

    return unsubscribe
  }

  onPattern(pattern: string, listener: EventAnyListener<T>, options: EventListenerOptions = {}): Unsubscribe {
    if (options.signal?.aborted) return () => {}

    const entry: PatternListener<T> = { ...this.createEntry(listener, options, false), pattern }
    this.patternListeners.push(entry)
    this.patternListeners.sort((left, right) => right.priority - left.priority)

    const unsubscribe = () => {
      entry.unsubscribeSignal?.()
      this.patternListeners = this.patternListeners.filter((item) => item !== entry)
    }

    this.bindSignal(entry, options.signal, unsubscribe)
    this.checkListenerLimit(pattern, this.patternListeners.filter((item) => item.pattern === pattern).length)

    return unsubscribe
  }

  private collectInvocations<K extends keyof T>(eventName: K, payload: T[K]) {
    const event = { eventName, payload } as EventAnyPayload<T>
    const invocations: Invocation[] = []
    const eventListeners = [...(this.listeners.get(eventName) ?? [])]

    for (const entry of eventListeners) {
      invocations.push({
        priority: entry.priority,
        remove: entry.once ? () => this.off(eventName, entry.listener as EventListener<T[K]>) : () => {},
        run: () => entry.listener(payload)
      })
    }

    for (const entry of this.patternListeners.filter((item) => matchesPattern(item.pattern, eventName))) {
      invocations.push({ priority: entry.priority, remove: () => {}, run: () => entry.listener(event) })
    }

    for (const entry of this.anyListeners) {
      invocations.push({ priority: entry.priority, remove: () => {}, run: () => entry.listener(event) })
    }

    return invocations.sort((left, right) => right.priority - left.priority)
  }

  emit<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]): void {
    for (const invocation of this.collectInvocations(eventName, args[0] as T[K])) {
      invocation.remove()
      void invocation.run()
    }
  }

  safeEmit<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]) {
    const errors: unknown[] = []

    for (const invocation of this.collectInvocations(eventName, args[0] as T[K])) {
      invocation.remove()

      try {
        const result = invocation.run()
        if (result instanceof Promise) void result.catch((error) => errors.push(error))
      } catch (error) {
        errors.push(error)
      }
    }

    return errors
  }

  async emitAsync<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]) {
    for (const invocation of this.collectInvocations(eventName, args[0] as T[K])) {
      invocation.remove()
      await invocation.run()
    }
  }

  async emitParallel<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]) {
    const invocations = this.collectInvocations(eventName, args[0] as T[K])
    invocations.forEach((invocation) => invocation.remove())
    await Promise.all(invocations.map((invocation) => Promise.resolve().then(invocation.run)))
  }

  async safeEmitAsync<K extends keyof T>(eventName: K, ...args: undefined extends T[K] ? [event?: T[K]] : [event: T[K]]) {
    const errors: unknown[] = []

    for (const invocation of this.collectInvocations(eventName, args[0] as T[K])) {
      invocation.remove()

      try {
        await invocation.run()
      } catch (error) {
        errors.push(error)
      }
    }

    return errors
  }

  waitFor<K extends keyof T>(eventName: K, options: EventWaitOptions = {}) {
    if (options.signal?.aborted) {
      return Promise.reject(options.signal.reason instanceof Error ? options.signal.reason : new DOMException('Event wait aborted', 'AbortError'))
    }

    if (options.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout < 0)) {
      return Promise.reject(new RangeError('timeout must be a non-negative finite number'))
    }

    return new Promise<T[K]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = () => {
        unsubscribe()
        options.signal?.removeEventListener('abort', abort)
        if (timer) clearTimeout(timer)
      }
      const abort = () => {
        cleanup()
        reject(options.signal?.reason instanceof Error ? options.signal.reason : new DOMException('Event wait aborted', 'AbortError'))
      }
      const unsubscribe = this.once(
        eventName,
        (payload) => {
          cleanup()
          resolve(payload)
        },
        { priority: options.priority }
      )

      options.signal?.addEventListener('abort', abort, { once: true })

      if (options.timeout !== undefined) {
        timer = setTimeout(() => {
          cleanup()
          reject(new Error(`Timed out waiting for event: ${String(eventName)}`))
        }, options.timeout)
      }
    })
  }

  clear<K extends keyof T>(eventName?: K): void {
    if (eventName === undefined) {
      for (const listeners of this.listeners.values()) listeners.forEach((entry) => entry.unsubscribeSignal?.())
      this.anyListeners.forEach((entry) => entry.unsubscribeSignal?.())
      this.patternListeners.forEach((entry) => entry.unsubscribeSignal?.())
      this.listeners.clear()
      this.anyListeners = []
      this.patternListeners = []
      this.warnedEvents.clear()
      return
    }

    this.listeners.get(eventName)?.forEach((entry) => entry.unsubscribeSignal?.())
    this.listeners.delete(eventName)
    this.warnedEvents.delete(eventName)
  }

  listenerCount<K extends keyof T>(eventName: K) {
    return this.listeners.get(eventName)?.length ?? 0
  }

  eventNames() {
    return [...this.listeners.keys()]
  }

  hasListeners<K extends keyof T>(eventName?: K) {
    return eventName === undefined ? this.totalListenerCount() > 0 : this.listenerCount(eventName) > 0
  }

  totalListenerCount() {
    let count = this.anyListeners.length + this.patternListeners.length
    for (const listeners of this.listeners.values()) count += listeners.length
    return count
  }

  setMaxListeners(maxListeners: number) {
    this.maxListeners = Math.max(0, maxListeners)
    this.warnedEvents.clear()
    return this
  }
}

const createListenerHelper =
  <T extends object>() =>
  <K extends keyof T>(_: K, listener: EventListener<T[K]>) =>
    listener

export { createListenerHelper, EventEmitter }
