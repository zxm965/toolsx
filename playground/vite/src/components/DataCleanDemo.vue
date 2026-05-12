<script setup lang="ts">
import { isDefined, pick, safeJsonParse, sleep } from 'toolsx/utils'
import { ref } from 'vue'

import type { DemoUser, ParsedConfig, RunRecordInput } from '../types/playground'

const emit = defineEmits<{ record: [record: RunRecordInput] }>()
const selectedUser = ref<DemoUser | null>(null)
const cleanedValues = ref<number[]>([])
const parsedConfig = ref<ParsedConfig | null>(null)

async function run() {
  selectedUser.value = null
  cleanedValues.value = []
  parsedConfig.value = null
  emit('record', { title: '数据清洗', status: '执行中', detail: '开始执行 pick、isDefined、safeJsonParse' })
  await sleep(220)

  selectedUser.value = pick({ id: 1, name: '小林', password: 'secret' }, ['id', 'name'])
  await sleep(160)
  cleanedValues.value = [1, null, 2, undefined, 3].filter(isDefined)
  await sleep(160)
  parsedConfig.value = safeJsonParse<ParsedConfig>('{"ok":true,"label":"解析成功"}', { ok: false, label: '兜底配置' }) ?? { ok: false, label: '解析失败' }
  emit('record', { title: '数据清洗', status: '成功', detail: `保留用户 ${selectedUser.value.name}，过滤后得到 ${cleanedValues.value.length} 个值` })
}

defineExpose({ run })
</script>

<template>
  <article class="card">
    <div class="card-heading">
      <span class="badge">pick + isDefined</span>
      <h2>数据清洗</h2>
    </div>
    <dl class="info-list">
      <div>
        <dt>展示用户</dt>
        <dd>{{ selectedUser ? `${selectedUser.name} #${selectedUser.id}` : '等待执行' }}</dd>
      </div>
      <div>
        <dt>过滤空值</dt>
        <dd>{{ cleanedValues.length ? cleanedValues.join('、') : '等待执行' }}</dd>
      </div>
      <div>
        <dt>JSON 解析</dt>
        <dd :class="parsedConfig?.ok ? 'success-text' : 'danger-text'">{{ parsedConfig?.label ?? '等待执行' }}</dd>
      </div>
    </dl>
    <div class="card-actions">
      <button @click="run">重新清洗数据</button>
    </div>
  </article>
</template>
