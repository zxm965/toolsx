<script setup lang="ts">
const props = defineProps<{
  code: string
  title: string
}>()

const emit = defineEmits<{
  copied: []
  error: [message: string]
}>()

async function copyCode() {
  try {
    if (!navigator.clipboard) {
      throw new Error('当前浏览器不支持 Clipboard API')
    }

    await navigator.clipboard.writeText(props.code)
    emit('copied')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '复制失败')
  }
}
</script>

<template>
  <section class="code-snippet">
    <div class="code-snippet-heading">
      <strong>{{ title }}</strong>
      <button class="compact-button secondary-button" @click="copyCode">复制代码</button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </section>
</template>
