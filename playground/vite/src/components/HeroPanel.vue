<script setup lang="ts">
defineEmits<{ replay: [] }>()
</script>

<template>
  <section class="hero">
    <p class="eyebrow">toolsx 可视化演示</p>
    <h1>每次执行都有过程和结果</h1>
    <p class="lede">点击卡片内按钮可以重新触发对应工具函数；右侧执行记录会保留每一次执行结果，方便观察工具行为。</p>
    <button class="hero-action" @click="$emit('replay')">重新播放基础流程</button>
  </section>
</template>
