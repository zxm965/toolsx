interface QueueEntry {
  reject: (error: unknown) => void
  resolve: (release: () => void) => void
  signal?: AbortSignal
}

function createAbortError(signal?: AbortSignal) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError')
}

export class RequestSemaphore {
  private active = 0
  private queue: QueueEntry[] = []

  constructor(private limit = Number.POSITIVE_INFINITY) {
    if (limit <= 0) throw new RangeError('concurrency must be greater than 0')
  }

  private release = () => {
    this.active = Math.max(0, this.active - 1)
    this.flush()
  }

  private flush() {
    while (this.active < this.limit && this.queue.length) {
      const entry = this.queue.shift()!

      if (entry.signal?.aborted) {
        entry.reject(createAbortError(entry.signal))
        continue
      }

      this.active += 1
      entry.resolve(this.release)
    }
  }

  acquire(signal?: AbortSignal) {
    if (signal?.aborted) return Promise.reject(createAbortError(signal))

    return new Promise<() => void>((resolve, reject) => {
      const entry: QueueEntry = { reject, resolve, signal }
      const abort = () => {
        const index = this.queue.indexOf(entry)
        if (index >= 0) this.queue.splice(index, 1)
        reject(createAbortError(signal))
      }

      signal?.addEventListener('abort', abort, { once: true })
      entry.resolve = (release) => {
        signal?.removeEventListener('abort', abort)
        resolve(release)
      }
      this.queue.push(entry)
      this.flush()
    })
  }

  async run<T>(task: () => Promise<T>, signal?: AbortSignal) {
    const release = await this.acquire(signal)

    try {
      return await task()
    } finally {
      release()
    }
  }
}
