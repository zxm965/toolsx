<template>
    <div>
        {{ msg }}
    </div>
</template>
<script setup lang="ts">
defineProps<{ msg: string }>()
</script>
