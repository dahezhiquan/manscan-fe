<script setup>
import { computed } from 'vue'
import DashboardDataNotice from './DashboardDataNotice.vue'
import { DASHBOARD_INTELLIGENCE_SEVERITIES } from '../../constants/dashboard'
import { ROUTE_PATHS } from '../../router/routes'
import { formatDashboardCount } from '../../utils/dashboard'
import globeAsset from '../../assets/earth.png'

const props = defineProps({
  statsSection: { type: Object, required: true },
  recentSection: { type: Object, required: true },
  minHeight: {
    type: Number,
    default: null
  }
})
const emit = defineEmits(['retry-stats', 'retry-recent'])

const latestDetections = computed(() => [
  { value: props.statsSection.data?.last7Days ?? null, label: '近 7 天' },
  { value: props.statsSection.data?.last30Days ?? null, label: '近 30 天' }
])

const recentRecords = computed(() => props.recentSection.data ?? [])
const allIntelligenceUrl = `${ROUTE_PATHS.VULNERABILITY_INTELLIGENCE}?severity=${DASHBOARD_INTELLIGENCE_SEVERITIES.join(',')}`

const cardStyle = computed(() =>
  props.minHeight ? { minHeight: `${props.minHeight}px` } : null
)

function severityClass(tone) {
  return `severity-${tone}`
}
</script>

<template>
  <article class="card newest-card" :style="cardStyle" :aria-busy="statsSection.status === 'loading'">
    <div class="newest-header">
      <div class="card-header">
        <h3>最新漏洞情报</h3>
      </div>

      <DashboardDataNotice :states="[statsSection]" @retry="emit('retry-stats')" />
      <div class="detection-grid">
        <div v-for="item in latestDetections" :key="item.label" class="detection-box">
          <div class="detection-value">{{ formatDashboardCount(item.value) }}</div>
          <div class="detection-label">{{ item.label }}</div>
        </div>
      </div>
    </div>

    <div class="globe-section">
      <div class="globe-shell" aria-hidden="true">
        <img class="globe-image" :src="globeAsset" alt="" />
      </div>
    </div>

    <div class="detection-list" :aria-busy="recentSection.status === 'loading'">
      <DashboardDataNotice :states="[recentSection]" @retry="emit('retry-recent')" />
      <article
        v-for="(item, index) in recentRecords"
        :key="`${item.vulnerabilityId}-${index}`"
        class="detection-item"
      >
        <div class="detection-item-top">
          <div class="detection-tags">
            <span class="severity-pill" :class="severityClass(item.severityTone)">
              {{ item.severity }}
            </span>
            <span class="detection-chip">{{ item.vulnerabilityId }}</span>
          </div>
        </div>

        <div class="detection-item-title">{{ item.name }}</div>
      </article>

      <div v-if="recentSection.status === 'success' && recentRecords.length === 0" class="detection-empty">
        暂无漏洞情报
      </div>
    </div>

    <div class="panel-footer">
      <a class="panel-footer-button" :href="allIntelligenceUrl" target="_blank" rel="noopener noreferrer">查看全部</a>
    </div>
  </article>
</template>
