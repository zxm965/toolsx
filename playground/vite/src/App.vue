<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

import ArrayChunkDemo from './components/ArrayChunkDemo.vue'
import CookieDemo from './components/CookieDemo.vue'
import DataCleanDemo from './components/DataCleanDemo.vue'
import EventLogDemo from './components/EventLogDemo.vue'
import ExecutionRecords from './components/ExecutionRecords.vue'
import GroupByDemo from './components/GroupByDemo.vue'
import HeroPanel from './components/HeroPanel.vue'
import RequestDemo from './components/RequestDemo.vue'
import RetryDemo from './components/RetryDemo.vue'
import StorageDemo from './components/StorageDemo.vue'
import type { RunRecord, RunRecordInput } from './types/playground'

const logs = ref<string[]>(['页面已加载，等待操作'])
const records = ref<RunRecord[]>([])
const runId = ref(0)
const latestRecord = computed(() => records.value[0])
const arrayDemo = ref<InstanceType<typeof ArrayChunkDemo>>()
const groupDemo = ref<InstanceType<typeof GroupByDemo>>()
const dataDemo = ref<InstanceType<typeof DataCleanDemo>>()

function now() {
  return new Date().toLocaleTimeString('zh-CN')
}

function addRecord(record: RunRecordInput) {
  records.value.unshift({ id: ++runId.value, ...record, time: now() })
}

function addLog(message: string) {
  logs.value.unshift(message)
}

async function runVisualDemo() {
  addRecord({ title: '可视化流程', status: '执行中', detail: '开始逐步执行各组件中的测试逻辑' })
  await arrayDemo.value?.run()
  await groupDemo.value?.run()
  await dataDemo.value?.run()
}

onMounted(async () => {
  await nextTick()
  runVisualDemo()
})
</script>

<template>
  <main class="page-shell">
    <HeroPanel @replay="runVisualDemo" />

    <section class="dashboard">
      <ArrayChunkDemo ref="arrayDemo" @record="addRecord" />
      <ExecutionRecords :latest-record="latestRecord" :records="records" />
      <GroupByDemo ref="groupDemo" @record="addRecord" />
      <DataCleanDemo ref="dataDemo" @record="addRecord" />
      <StorageDemo @record="addRecord" @log="addLog" />
      <RetryDemo @record="addRecord" @log="addLog" />
      <RequestDemo @record="addRecord" @log="addLog" />
      <CookieDemo @record="addRecord" @log="addLog" />
      <EventLogDemo :logs="logs" />
    </section>
  </main>
</template>
