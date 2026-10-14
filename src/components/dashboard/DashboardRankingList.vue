<template>
  <section class="dashboard-ranking-panel" :aria-label="title">
    <div class="dashboard-section-head"><h4>{{ title }}</h4><span class="dashboard-card-description">{{ unit }}</span></div>
    <ol v-if="items?.length" class="dashboard-ranking-list">
      <li v-for="(item, index) in items" :key="item.key">
        <component :is="item.route ? 'a' : 'div'" class="dashboard-ranking-row" :href="item.route || undefined" @click="handleNavigate($event, item)">
          <span class="dashboard-rank-index" :class="{ 'is-leading': index < 3 }">{{ index + 1 }}</span>
          <span class="dashboard-rank-copy">
            <span class="dashboard-rank-name" :title="item.label">{{ item.label }}</span>
            <span class="dashboard-meter" :class="`is-${tone}`" aria-hidden="true"><span :style="{ width: `${dashboardPercentage(item.count, maxCount)}%` }"></span></span>
          </span>
          <strong class="dashboard-rank-count">{{ formatDashboardCount(item.count) }}</strong>
        </component>
      </li>
    </ol>
    <p v-else class="dashboard-empty">{{ emptyText }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { dashboardPercentage, formatDashboardCount } from '../../utils/dashboard'

const props = defineProps({
  title: { type: String, required: true }, unit: { type: String, default: '记录数' },
  items: { type: Array, default: null }, tone: { type: String, default: 'low' },
  status: { type: String, default: 'idle' }, navigateTo: { type: Function, required: true }
})
const maxCount = computed(() => Math.max(0, ...(props.items || []).map((item) => item.count)))
const emptyText = computed(() => {
  if (props.items !== null) return '暂无排行数据'
  return props.status === 'loading' ? '正在加载排行榜…' : '排行数据暂不可用'
})
function handleNavigate(event, item) {
  if (!item.route || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  props.navigateTo(item.route)
}
</script>
