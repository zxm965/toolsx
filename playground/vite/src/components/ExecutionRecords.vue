<script setup lang="ts">
import type { RunRecord } from '../types/playground'

defineProps<{
  latestRecord?: RunRecord
  records: RunRecord[]
}>()
</script>

<template>
  <article class="card sticky-card">
    <div class="card-heading">
      <span class="badge">执行记录</span>
      <h2>每次执行结果</h2>
    </div>
    <div v-if="latestRecord" class="latest-record" :data-status="latestRecord.status">
      <strong>{{ latestRecord.title }}</strong>
      <span>{{ latestRecord.status }} · {{ latestRecord.time }}</span>
      <p>{{ latestRecord.detail }}</p>
    </div>
    <ul class="record-list">
      <li v-for="record in records" :key="record.id" :data-status="record.status">
        <span>{{ record.time }}</span>
        <strong>{{ record.title }}</strong>
        <p>{{ record.detail }}</p>
      </li>
    </ul>
  </article>
</template>
