<script setup lang="ts">
import { createRequestClient } from 'toolsx/shared'
import { ref } from 'vue'

import type { RunRecordInput } from '../types/playground'
import CodeSnippet from './CodeSnippet.vue'

type DemoResponse = {
  code: number
  data: { message: string }
  message: string
}

const emit = defineEmits<{
  log: [message: string]
  record: [record: RunRecordInput]
}>()
const attempt = ref(0)
const result = ref('等待执行请求演示')
const state = ref<'idle' | 'running' | 'success' | 'error'>('idle')

const code = `const request = createRequestClient({
  baseURL: '/api',
  retryPolicy: { retries: 2, delay: 250, factor: 2 },
  responseCache: { ttl: 30_000 }
})

const result = await request.get('/profile')`

function createJsonResponse(body: DemoResponse, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

const request = createRequestClient({
  fetch: async (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (url.includes('/retry')) {
      attempt.value += 1

      if (attempt.value < 3) {
        return createJsonResponse({ code: 503, data: { message: '' }, message: `第 ${attempt.value} 次请求暂不可用` }, 503)
      }
    }

    if (url.includes('/business-error')) {
      return createJsonResponse({ code: 1001, data: { message: '' }, message: '模拟业务校验失败' })
    }

    return createJsonResponse({ code: 0, data: { message: '请求成功' }, message: 'ok' })
  },
  onTrace: (trace) => {
    emit('log', `${trace.method} ${trace.url} · ${trace.duration}ms · ${trace.attempts} 次尝试`)
  },
  responseCache: { ttl: 10_000 },
  retryPolicy: { delay: 180, factor: 1.5, jitter: false, retries: 2 }
})

async function runRetry() {
  attempt.value = 0
  state.value = 'running'
  result.value = '模拟前两次返回 503，等待自动重试...'
  emit('record', { detail: result.value, status: '执行中', title: 'request 自动重试' })
  const response = await request.get<DemoResponse, 'json', DemoResponse['data']>('/retry', {
    transform: (body) => body.data
  })

  if (response.error) {
    state.value = 'error'
    result.value = response.error.message
    emit('record', { detail: result.value, status: '失败', title: 'request 自动重试' })
    return
  }

  state.value = 'success'
  result.value = `${response.response.message}，共尝试 ${response.meta.attempts} 次`
  emit('record', { detail: result.value, status: '成功', title: 'request 自动重试' })
}

async function runCache() {
  state.value = 'running'
  await request.invalidateCache('/cache')
  const first = await request.get<DemoResponse>('/cache')
  const second = await request.get<DemoResponse>('/cache')
  state.value = second.error ? 'error' : 'success'
  result.value = second.error ? second.error.message : `首次网络请求成功；第二次读取缓存：${second.meta.fromCache ? '是' : '否'}`
  emit('record', { detail: result.value, status: second.error ? '失败' : '成功', title: 'request GET 缓存' })

  if (first.error) emit('log', first.error.message)
}

async function runBusinessError() {
  state.value = 'running'
  const response = await request.get<DemoResponse>('/business-error', {
    validateResponse: (body) => body.code === 0 || body.message
  })
  state.value = response.error ? 'error' : 'success'
  result.value = response.error?.message ?? '业务校验成功'
  emit('record', { detail: result.value, status: response.error ? '失败' : '成功', title: 'request 业务校验' })
}
</script>

<template>
  <article class="card wide request-demo">
    <div class="card-heading">
      <span class="badge">createRequestClient</span>
      <h2>请求重试、缓存与失败状态</h2>
    </div>
    <div class="request-status" :data-state="state">
      <strong>{{ state === 'running' ? '执行中' : state === 'success' ? '成功' : state === 'error' ? '失败' : '待执行' }}</strong>
      <p>{{ result }}</p>
    </div>
    <div class="card-actions three-actions">
      <button @click="runRetry">执行自动重试</button>
      <button class="secondary-button" @click="runCache">验证 GET 缓存</button>
      <button class="danger-button" @click="runBusinessError">模拟业务失败</button>
    </div>
    <CodeSnippet :code="code" title="request 配置示例" @copied="$emit('log', '已复制 request 示例代码')" @error="$emit('log', $event)" />
  </article>
</template>
