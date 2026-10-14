<template>
  <article class="card dashboard-overview-card dashboard-focus-card" :aria-busy="overview.status === 'loading' || assetRisks.status === 'loading'">
    <div class="dashboard-card-head"><div><h3>优先关注</h3><p class="dashboard-card-description">端口暴露与高风险资产</p></div></div>
    <DashboardDataNotice :states="[overview]" @retry="emit('retry', 'overview')" />
    <div class="dashboard-focus-value tone-high">{{ formatDashboardCount(overview.data?.highRiskOpenPorts) }}<span>个</span></div>
    <p class="dashboard-card-description">高危开放端口 · 按存活端口记录计数</p>
    <div class="dashboard-focus-list">
      <button type="button" @click="navigateTo(highRiskVulnerabilitiesRoute)"><span>严重 / 高危未审核漏洞</span><strong>{{ formatDashboardCount(highRiskUnreviewed) }} ↗</strong></button>
    </div>
    <DashboardDataNotice :states="[assetRisks]" @retry="emit('retry', 'assetRisks')" />
    <div class="dashboard-focus-list">
      <button v-for="item in attentionItems" :key="item.label" type="button" @click="navigateTo(item.route)"><span>{{ item.label }}</span><strong>{{ formatDashboardCount(item.count) }} ↗</strong></button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import DashboardDataNotice from './DashboardDataNotice.vue'
import { formatDashboardCount, sumDashboardCounts } from '../../utils/dashboard'
import { ASSET_HIGH_RISK_FILTER } from '../../constants/domainAssets'
import { VULNERABILITY_STATUS_UNREVIEWED } from '../../constants/vulnerabilities'
import { ROUTE_PATHS } from '../../router/routes'

const props = defineProps({
  overview: { type: Object, required: true }, assetRisks: { type: Object, required: true },
  navigateTo: { type: Function, required: true }
})
const emit = defineEmits(['retry'])
const highRiskVulnerabilitiesRoute = `${ROUTE_PATHS.VULNERABILITIES}?status=${VULNERABILITY_STATUS_UNREVIEWED}&severity=${ASSET_HIGH_RISK_FILTER}`
const highRiskUnreviewed = computed(() => sumDashboardCounts([props.overview.data?.pending.critical, props.overview.data?.pending.high]))
const attentionItems = computed(() => [
  { label: '严重 / 高危主机 · 查看清单', count: sumDashboardCounts([props.assetRisks.data?.hosts.counts.critical, props.assetRisks.data?.hosts.counts.high]), route: `${ROUTE_PATHS.HOST_ASSETS}?risk_level=${ASSET_HIGH_RISK_FILTER}` },
  { label: '严重 / 高危域名 · 查看清单', count: sumDashboardCounts([props.assetRisks.data?.domains.counts.critical, props.assetRisks.data?.domains.counts.high]), route: `${ROUTE_PATHS.DOMAIN_ASSETS}?risk_level=${ASSET_HIGH_RISK_FILTER}` }
])
</script>
