<script setup lang="ts">
import { EventEmitter, StorageWithExpiration } from 'toolsx/shared'
import { debounce, sleep } from 'toolsx/utils'
import { computed, ref } from 'vue'

import type { RunRecordInput } from '../types/playground'

type StorageEvents = {
  saved: { key: string; label: string }
}

const emit = defineEmits<{ record: [record: RunRecordInput]; log: [message: string] }>()
const emitter = new EventEmitter<StorageEvents>()
const storage = new StorageWithExpiration(localStorage, { validateKey: false })
const result = ref('尚未写入')
const active = ref(false)
const storagePreview = computed(() => storage.getItem<{ at: string; label: string }>('toolsx-demo'))
const isActive = computed(() => active.value || (storagePreview.value.found && !storagePreview.value.expired))

emitter.on('saved', ({ key, label }) => {
  emit('log', `已触发事件：${label}（${key}）`)
})

const save = debounce(async () => {
  active.value = false
  result.value = '正在写入缓存...'
  emit('record', { title: 'StorageWithExpiration', status: '执行中', detail: '准备写入 60 秒有效期的缓存' })
  await sleep(260)

  storage.setItem('toolsx-demo', { at: new Date().toLocaleString('zh-CN'), label: '本地缓存演示' }, { expiresAt: Date.now() + 60_000 })
  checkStorage('写入后读取')
  emitter.emit('saved', { key: 'toolsx-demo', label: '本地缓存演示' })
}, 200)

function checkStorage(title = '获取缓存状态') {
  const latest = storage.getItem<{ at: string; label: string }>('toolsx-demo')
  active.value = latest.found && !latest.expired

  if (!latest.found) {
    result.value = '未读取到缓存，请先写入'
    emit('record', { title, status: '失败', detail: result.value })
    return
  }

  if (latest.expired) {
    result.value = `缓存已过期，过期前内容：${latest.value.label}`
    emit('record', { title, status: '失败', detail: result.value })
    return
  }

  result.value = `缓存有效：${latest.value.label}，写入时间 ${latest.value.at}`
  emit('record', { title, status: '成功', detail: result.value })
}
</script>

<template>
  <article class="card">
    <div class="card-heading">
      <span class="badge">StorageWithExpiration</span>
      <h2>本地缓存状态</h2>
    </div>
    <div class="status-orb" :class="isActive ? 'active pulse' : ''">
      <span>{{ isActive ? '有效' : '空' }}</span>
    </div>
    <p>{{ result }}</p>
    <small>缓存有效期：60 秒</small>
    <div class="card-actions split-actions">
      <button @click="save">写入本地缓存</button>
      <button class="secondary-button" @click="checkStorage()">获取缓存状态</button>
    </div>
  </article>
</template>
