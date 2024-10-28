<template>
  <div>1{{ msg }}</div>
</template>
<script setup lang="ts">
defineProps<{ msg: string }>()
</script>
