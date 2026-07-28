import type { RequestProgressHandler, RequestProgressPhase } from './types'

interface ProgressRequestInit extends RequestInit {
  onDownloadProgress?: RequestProgressHandler
  onUploadProgress?: RequestProgressHandler
}

function emitProgress(handler: RequestProgressHandler | undefined, phase: RequestProgressPhase, loaded: number, total?: number, done = false) {
  if (!handler) return

  try {
    handler({
      done,
      loaded,
      percent: total && total > 0 ? Math.min(100, (loaded / total) * 100) : undefined,
      phase,
      total
    })
  } catch {
    // Progress callbacks are observability hooks and do not control request success.
  }
}

function getBodySize(body: BodyInit | null | undefined) {
  if (body === null || body === undefined) return 0
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).byteLength
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  return undefined
}

function wrapDownloadProgress(response: Response, handler: RequestProgressHandler) {
  if (!response.body) {
    emitProgress(handler, 'download', 0, 0, true)
    return response
  }

  const totalHeader = response.headers.get('content-length')
  const total = totalHeader === null ? undefined : Number(totalHeader)
  const reader = response.body.getReader()
  let loaded = 0

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read()

        if (chunk.done) {
          emitProgress(handler, 'download', loaded, total, true)
          controller.close()
          return
        }

        loaded += chunk.value.byteLength
        emitProgress(handler, 'download', loaded, total)
        controller.enqueue(chunk.value)
      } catch (error) {
        controller.error(error)
      }
    },
    cancel(reason) {
      return reader.cancel(reason)
    }
  })

  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText
  })
}

export function createProgressFetch(baseFetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (input, init) => {
    const { onDownloadProgress, onUploadProgress, ...requestInit } = (init ?? {}) as ProgressRequestInit
    const uploadTotal = getBodySize(requestInit.body)
    emitProgress(onUploadProgress, 'upload', 0, uploadTotal)

    const response = await baseFetch(input, requestInit)
    emitProgress(onUploadProgress, 'upload', uploadTotal ?? 0, uploadTotal, true)

    return onDownloadProgress ? wrapDownloadProgress(response, onDownloadProgress) : response
  }
}
