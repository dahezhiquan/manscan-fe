<template>
  <article class="card dashboard-overview-card" :aria-busy="section.status === 'loading'">
    <div class="dashboard-card-head">
      <div>
        <h3>未审核漏洞</h3>
      </div>
      <button type="button" class="dashboard-text-button" @click="navigateTo(unreviewedRoute)">查看漏洞 ↗</button>
    </div>
    <DashboardDataNotice :states="[section]" @retry="emit('retry')" />
    <DashboardMetrics :items="metrics" compact />
    <div v-if="section.data" class="dashboard-severity-track" aria-hidden="true">
      <span v-for="item in distribution" :key="item.key" :class="`is-${item.tone}`" :style="{ flexGrow: item.count }"></span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import DashboardDataNotice from './DashboardDataNotice.vue'
import DashboardMetrics from './DashboardMetrics.vue'
import { DASHBOARD_SEVERITIES } from '../../constants/dashboard'
import { VULNERABILITY_STATUS_UNREVIEWED } from '../../constants/vulnerabilities'
import { ROUTE_PATHS } from '../../router/routes'

const props = defineProps({ section: { type: Object, required: true }, navigateTo: { type: Function, required: true } })
const emit = defineEmits(['retry'])
const unreviewedRoute = `${ROUTE_PATHS.VULNERABILITIES}?status=${VULNERABILITY_STATUS_UNREVIEWED}`
const distribution = computed(() => DASHBOARD_SEVERITIES.map((item) => ({ ...item, count: props.section.data?.pending[item.key] ?? null })))
const metrics = computed(() => [
  { key: 'total', label: '未审核总数', count: props.section.data?.pending.total ?? null, tone: 'total' },
  ...distribution.value
])
</script>
