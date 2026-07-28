<script setup lang="ts">
import { Cookie } from 'toolsx/shared'
import { ref } from 'vue'

import type { RunRecordInput } from '../types/playground'
import CodeSnippet from './CodeSnippet.vue'

const emit = defineEmits<{
  log: [message: string]
  record: [record: RunRecordInput]
}>()
const cookie = new Cookie({ sameSite: 'Lax' })
const result = ref('尚未写入 Cookie')

const code = `const cookie = new Cookie({ sameSite: 'Lax' })

cookie.setJSON('profile', { id: 1, name: 'Tom' }, {
  maxAge: 60 * 30
})

const profile = cookie.getJSON('profile')`

function save() {
  const saved = cookie.setJSON('toolsx_playground_profile', { id: 1, name: 'Tom' }, { maxAge: 60 * 30 })
  result.value = saved ? '已写入 JSON Cookie，30 分钟内有效' : '当前环境不可写 Cookie'
  emit('record', { detail: result.value, status: saved ? '成功' : '失败', title: 'Cookie.setJSON' })
}

function read() {
  const profile = cookie.getJSON<{ id: number; name: string }>('toolsx_playground_profile')
  result.value = profile ? `读取成功：${profile.name} #${profile.id}` : '没有读取到 Cookie'
  emit('record', { detail: result.value, status: profile ? '成功' : '失败', title: 'Cookie.getJSON' })
}

function remove() {
  cookie.remove('toolsx_playground_profile')
  result.value = 'Cookie 已删除'
  emit('record', { detail: result.value, status: '成功', title: 'Cookie.remove' })
}
</script>

<template>
  <article class="card cookie-demo">
    <div class="card-heading">
      <span class="badge">Cookie JSON</span>
      <h2>Cookie 读写与清理</h2>
    </div>
    <p class="demo-result">{{ result }}</p>
    <div class="card-actions split-actions">
      <button @click="save">写入 JSON</button>
      <button class="secondary-button" @click="read">读取</button>
      <button class="danger-button" @click="remove">删除</button>
    </div>
    <CodeSnippet :code="code" title="Cookie 示例" @copied="$emit('log', '已复制 Cookie 示例代码')" @error="$emit('log', $event)" />
  </article>
</template>
