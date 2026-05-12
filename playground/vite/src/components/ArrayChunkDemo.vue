<script setup lang="ts">
import { chunk, sleep, unique } from 'toolsx/utils'
import { ref } from 'vue'

import type { RunRecordInput } from '../types/playground'

const emit = defineEmits<{ record: [record: RunRecordInput] }>()
const rawNumbers = ref([1, 1, 2, 3, 4, 5])
const visibleNumbers = ref<number[]>([])
const chunkGroups = ref<number[][]>([])

async function run() {
  visibleNumbers.value = []
  chunkGroups.value = []
  emit('record', { title: 'unique + chunk', status: '执行中', detail: '开始执行数组去重与分页' })

  for (const item of unique(rawNumbers.value)) {
    visibleNumbers.value.push(item)
    await sleep(180)
  }

  emit('record', { title: 'unique', status: '成功', detail: `去重结果：${visibleNumbers.value.join('、')}` })
  await sleep(220)

  for (const group of chunk(visibleNumbers.value, 2)) {
    chunkGroups.value.push(group)
    await sleep(220)
  }

  emit('record', { title: 'chunk', status: '成功', detail: `拆分为 ${chunkGroups.value.length} 组` })
}

defineExpose({ run })
</script>

<template>
  <article class="card wide">
    <div class="card-heading">
      <span class="badge">unique + chunk</span>
      <h2>数组去重与分页</h2>
    </div>
    <div class="number-row muted">
      <span v-for="(item, index) in rawNumbers" :key="`${item}-${index}`">{{ item }}</span>
    </div>
    <div class="arrow">动态去重中</div>
    <div class="number-row result-row">
      <span v-for="item in visibleNumbers" :key="item" class="pop-in">{{ item }}</span>
    </div>
    <div class="page-row">
      <div v-for="(page, index) in chunkGroups" :key="index" class="page-card pop-in">
        <strong>第 {{ index + 1 }} 组</strong>
        <div class="number-row">
          <span v-for="item in page" :key="item">{{ item }}</span>
        </div>
      </div>
    </div>
    <div class="card-actions">
      <button @click="run">重新执行数组测试</button>
    </div>
  </article>
</template>
