<script setup lang="ts">
defineProps<{
  logs: string[]
}>()
</script>

<template>
  <article class="card wide">
    <div class="card-heading">
      <span class="badge">EventEmitter</span>
      <h2>事件流</h2>
    </div>
    <ul class="timeline">
      <li v-for="item in logs" :key="item">{{ item }}</li>
    </ul>
  </article>
</template>
