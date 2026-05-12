<script setup lang="ts">
import { retry, sleep } from 'toolsx/utils'
import { ref } from 'vue'

import type { RetryStep, RunRecordInput } from '../types/playground'

const emit = defineEmits<{ record: [record: RunRecordInput]; log: [message: string] }>()
const steps = ref<RetryStep[]>(['等待', '等待', '等待'])
const attempt = ref(0)

async function run() {
  steps.value = ['执行中', '等待', '等待']
  attempt.value = 0
  emit('record', { title: 'retry', status: '执行中', detail: '模拟前两次失败，第三次成功' })

  const value = await retry(
    async () => {
      attempt.value += 1
      steps.value = steps.value.map((step, index) => (index < attempt.value - 1 ? '完成' : index === attempt.value - 1 ? '执行中' : step)) as RetryStep[]
      await sleep(380)

      if (attempt.value < 3) {
        steps.value[attempt.value - 1] = '完成'
        emit('record', { title: 'retry', status: '失败', detail: `第 ${attempt.value} 次尝试失败，准备重试` })
        throw new Error('模拟失败')
      }

      steps.value = ['完成', '完成', '完成']
      return '第 3 次尝试成功'
    },
    3,
    260
  )

  emit('record', { title: 'retry', status: '成功', detail: value })
  emit('log', value)
}
</script>

<template>
  <article class="card">
    <div class="card-heading">
      <span class="badge">retry</span>
      <h2>异步重试</h2>
    </div>
    <div class="retry-track">
      <span v-for="(step, index) in steps" :key="index" :class="{ done: step === '完成', running: step === '执行中' }"
        >第 {{ index + 1 }} 次<br />{{ step }}</span
      >
    </div>
    <p class="attempt-text">当前尝试：{{ attempt || '未开始' }}</p>
    <div class="card-actions">
      <button @click="run">执行重试任务</button>
    </div>
  </article>
</template>
