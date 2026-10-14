<template>
  <dl class="dashboard-metrics" :class="{ 'is-compact': compact }">
    <div v-for="item in items" :key="item.key" class="dashboard-metric">
      <dt>{{ item.label }}</dt>
      <dd :class="`tone-${item.tone || 'total'}`">{{ formatDashboardCount(item.count) }}</dd>
    </div>
  </dl>
</template>

<script setup>
import { formatDashboardCount } from '../../utils/dashboard'

defineProps({
  items: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false }
})
</script>
