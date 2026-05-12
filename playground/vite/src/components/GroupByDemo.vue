<script setup lang="ts">
import { groupBy, sleep } from 'toolsx/utils'
import { ref } from 'vue'

import type { RunRecordInput, ToolItem } from '../types/playground'

const emit = defineEmits<{ record: [record: RunRecordInput] }>()
const groupEntries = ref<[string, ToolItem[]][]>([])

async function run() {
  groupEntries.value = []
  emit('record', { title: 'groupBy', status: '执行中', detail: '开始按能力类型分组' })
  await sleep(220)

  const grouped = groupBy(
    [
      { type: '网络请求', name: 'createRequestClient' },
      { type: '通用函数', name: 'chunk' },
      { type: '通用函数', name: 'pick' },
      { type: '共享能力', name: 'EventEmitter' }
    ],
    (item) => item.type
  )
  groupEntries.value = Object.entries(grouped)
  emit('record', { title: 'groupBy', status: '成功', detail: `生成 ${groupEntries.value.length} 个能力分组` })
}

defineExpose({ run })
</script>

<template>
  <article class="card">
    <div class="card-heading">
      <span class="badge">groupBy</span>
      <h2>能力分组</h2>
    </div>
    <div class="group-list">
      <div v-for="[type, items] in groupEntries" :key="type" class="group-item pop-in">
        <strong>{{ type }}</strong>
        <span>{{ items.length }} 项</span>
        <div class="chips">
          <em v-for="item in items" :key="item.name">{{ item.name }}</em>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button @click="run">重新分组</button>
    </div>
  </article>
</template>
