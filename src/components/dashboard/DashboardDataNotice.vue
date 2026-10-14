<template>
  <div v-if="failed.length" class="dashboard-data-notice is-error" role="status">
    <span>{{ failureText }}</span>
    <button type="button" class="dashboard-text-button" :disabled="loading" @click="emit('retry')">重试</button>
  </div>
  <div v-else-if="loading" class="dashboard-data-notice" role="status">正在更新数据…</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ states: { type: Array, default: () => [] } })
const emit = defineEmits(['retry'])
const failed = computed(() => props.states.filter((state) => state.status === 'error'))
const loading = computed(() => props.states.some((state) => state.status === 'loading'))
const failureText = computed(() => {
  if (failed.value.some((state) => [403, 40301].includes(Number(state.errorCode)) || state.error?.includes('无权') || state.error?.includes('权限'))) {
    return '部分数据无访问权限，请联系管理员。'
  }
  return failed.value.some((state) => state.updatedAt)
    ? '部分数据更新失败，保留上次成功结果。'
    : '部分数据暂不可用，请重试。'
})
</script>
