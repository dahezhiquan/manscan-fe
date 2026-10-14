<template>
  <div class="dashboard-shell" :class="{ 'sidebar-collapsed': props.isSidebarCollapsed }">
    <AppSidebar
      :is-collapsed="props.isSidebarCollapsed"
      :current-user-name="props.currentUserName"
      :current-path="props.currentPath"
      :primary-nav="navigationState.primaryNav"
      :secondary-nav="navigationState.secondaryNav"
      :footer-nav="footerNav"
      @toggle="emit('toggle-sidebar')"
      @navigate="props.navigateTo"
      @logout="emit('logout')"
    />
    <main class="main-content dashboard-home">
      <DashboardTopbar :current-user-name="props.currentUserName" :current-user-role="props.currentUserRole" />
      <DiscoverCard :navigate-to="props.navigateTo" />
      <div class="dashboard-refresh-bar">
        <div>
          <h2>安全与资产概览</h2>
          <p v-if="refreshDescription" class="dashboard-card-description" role="status">{{ refreshDescription }}</p>
        </div>
        <button type="button" class="dashboard-refresh-button" :disabled="isLoading" @click="refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3" /></svg>
          {{ isLoading ? '更新中…' : '刷新数据' }}
        </button>
      </div>
      <section class="content-grid dashboard-overview-grid" aria-label="安全与资产统计">
        <div class="left-column">
          <OpenVulnerabilitiesCard :section="sections.overview" :navigate-to="props.navigateTo" @retry="refreshSection('overview')" />
          <VulnerabilityStatusCard :total="sections.overview.data?.statuses.total ?? null" :stats="statusMetrics" :states="[sections.overview]" :navigate-to="props.navigateTo" @retry="refreshSection('overview')" />
          <AssetsCard :section="sections.assetRisks" :navigate-to="props.navigateTo" @retry="refreshSection('assetRisks')" />
          <DashboardRankingsCard
            title="主机排行"
            :section="sections.hostRankings"
            :groups="hostGroups"
            :navigate-to="props.navigateTo"
            @retry="refreshSection('hostRankings')"
          />
          <DashboardRankingsCard
            title="服务指纹分布"
            :section="sections.fingerprints"
            :groups="fingerprintGroups"
            :navigate-to="props.navigateTo"
            @retry="refreshSection('fingerprints')"
          />
        </div>
        <div class="right-column">
          <RiskFocusCard :overview="sections.overview" :asset-risks="sections.assetRisks" :navigate-to="props.navigateTo" @retry="refreshSection" />
          <VulnIntelCard :latest-detections="latestDetections" :vulnerability-detections="vulnerabilityDetections" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import AssetsCard from '../components/dashboard/AssetsCard.vue'
import DashboardTopbar from '../components/dashboard/DashboardTopbar.vue'
import DiscoverCard from '../components/dashboard/DiscoverCard.vue'
import OpenVulnerabilitiesCard from '../components/dashboard/OpenVulnerabilitiesCard.vue'
import RiskFocusCard from '../components/dashboard/RiskFocusCard.vue'
import VulnerabilityStatusCard from '../components/dashboard/VulnerabilityStatusCard.vue'
import DashboardRankingsCard from '../components/dashboard/DashboardRankingsCard.vue'
import VulnIntelCard from '../components/dashboard/VulnIntelCard.vue'
import { footerNav, latestDetections, vulnerabilityDetections } from '../data/dashboard'
import { DASHBOARD_STATUSES } from '../constants/dashboard'
import { useSidebarNavigation } from '../composables/useSidebarNavigation'
import { useDashboardOverview } from '../composables/useDashboardOverview'

const props = defineProps({
  navigateTo: { type: Function, required: true },
  currentPath: { type: String, default: '/' },
  isSidebarCollapsed: { type: Boolean, default: false },
  currentUserName: { type: String, default: 'admin' },
  currentUserRole: { type: String, default: 'user' }
})
const emit = defineEmits(['toggle-sidebar', 'logout'])
const { navigationState } = useSidebarNavigation(toRef(props, 'currentPath'))
const { sections, isLoading, failedCount, refresh, refreshSection } = useDashboardOverview()
const statusMetrics = computed(() => DASHBOARD_STATUSES.map(({ value, label }) => ({
  key: value, label, count: sections.overview.data?.statuses[value] ?? null
})))
const hostGroups = [
  { key: 'vulnerabilities', title: '漏洞数量 Top10 主机', unit: '漏洞数', tone: 'high' },
  { key: 'ports', title: '开放端口 Top10 主机', unit: '端口数', tone: 'low' }
]
const fingerprintGroups = [
  { key: 'domains', title: '域名应用 Top10', unit: '记录数', tone: 'low' },
  { key: 'hosts', title: '主机服务 Top10', unit: '记录数', tone: 'info' }
]
const refreshDescription = computed(() => {
  if (isLoading.value) return '正在更新，已加载的区块可继续查看'
  if (failedCount.value) return `${failedCount.value} 个区块更新失败，可独立重试；已有数据保留上次结果`
  return ''
})
</script>
