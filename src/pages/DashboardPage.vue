<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import AppSidebar from '../components/layout/AppSidebar.vue'
import ApiKeyCard from '../components/dashboard/ApiKeyCard.vue'
import AssetsCard from '../components/dashboard/AssetsCard.vue'
import DashboardTopbar from '../components/dashboard/DashboardTopbar.vue'
import DiscoverCard from '../components/dashboard/DiscoverCard.vue'
import OpenVulnerabilitiesCard from '../components/dashboard/OpenVulnerabilitiesCard.vue'
import RemediationEfficiencyCard from '../components/dashboard/RemediationEfficiencyCard.vue'
import RemediationOverviewCard from '../components/dashboard/RemediationOverviewCard.vue'
import SecurityScoreCard from '../components/dashboard/SecurityScoreCard.vue'
import VulnIntelCard from '../components/dashboard/VulnIntelCard.vue'
import {
  assetStats,
  footerNav,
  latestDetections,
  remediationOverviewStats,
  remediationStats,
  vulnerabilityDetections,
  vulnerabilityStats
} from '../data/dashboard'
import { getVulnerabilityList } from '../api/vulnerabilities'
import { useSidebarNavigation } from '../composables/useSidebarNavigation'
import { VULNERABILITY_STATUS_UNREVIEWED } from '../constants/vulnerabilities'
import {
  formatVulnerabilityCount,
  normalizeVulnerabilityListResponse
} from '../utils/vulnerability'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})
const leftColumnRef = ref(null)
const scoreCardRef = ref(null)
const apiCardRef = ref(null)
const newestCardMinHeight = ref(null)
const unreviewedVulnerabilityCounts = ref({})
const unreviewedVulnerabilityCountStatus = ref('idle')

const emit = defineEmits(['toggle-sidebar'])

let resizeObserver = null
let unreviewedVulnerabilityController = null

const { navigationState } = useSidebarNavigation(toRef(props, 'currentPath'))
const dashboardVulnerabilityStats = computed(() =>
  vulnerabilityStats.map((item) => {
    const count = unreviewedVulnerabilityCounts.value[item.key]
    return {
      ...item,
      value: formatVulnerabilityCount(count),
      title:
        unreviewedVulnerabilityCountStatus.value === 'error'
          ? '待处理漏洞统计加载失败，请刷新页面重试'
          : ''
    }
  })
)

function updateNewestCardHeight() {
  const leftColumn = leftColumnRef.value
  const scoreCard = scoreCardRef.value?.getElement?.()
  const apiCard = apiCardRef.value?.getElement?.()

  if (!leftColumn || !scoreCard || !apiCard) {
    newestCardMinHeight.value = null
    return
  }

  const rightParent = scoreCard.parentElement

  if (!rightParent) {
    newestCardMinHeight.value = null
    return
  }

  const gridStyle = window.getComputedStyle(rightParent)
  const gap = Number.parseFloat(gridStyle.rowGap || gridStyle.gap || '0') || 0
  const leftHeight = leftColumn.offsetHeight
  const fixedRightHeight = scoreCard.offsetHeight + apiCard.offsetHeight + gap
  const calculated = leftHeight - fixedRightHeight

  newestCardMinHeight.value = calculated > 0 ? calculated : null
}

async function registerResizeObserver() {
  await nextTick()

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver?.disconnect()
  resizeObserver = new ResizeObserver(() => {
    updateNewestCardHeight()
  })

  const observedElements = [
    leftColumnRef.value,
    scoreCardRef.value?.getElement?.(),
    apiCardRef.value?.getElement?.()
  ].filter(Boolean)

  observedElements.forEach((element) => resizeObserver.observe(element))
}

function stopUnreviewedVulnerabilityRequest() {
  unreviewedVulnerabilityController?.abort()
  unreviewedVulnerabilityController = null
}

async function loadUnreviewedVulnerabilityCount() {
  stopUnreviewedVulnerabilityRequest()
  unreviewedVulnerabilityController = new AbortController()
  const { signal } = unreviewedVulnerabilityController
  const requestItems = vulnerabilityStats.map((item) => ({
    key: item.key,
    severity: item.key === 'unreviewed' ? '' : item.key
  }))

  unreviewedVulnerabilityCountStatus.value = 'loading'

  try {
    const results = await Promise.allSettled(
      requestItems.map((item) => fetchUnreviewedVulnerabilityCount(item.severity, signal))
    )

    if (signal.aborted) {
      return
    }

    const nextCounts = {}
    let fulfilledCount = 0

    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') {
        return
      }

      nextCounts[requestItems[index].key] = result.value
      fulfilledCount += 1
    })

    unreviewedVulnerabilityCounts.value = nextCounts
    unreviewedVulnerabilityCountStatus.value =
      fulfilledCount === requestItems.length ? 'success' : 'error'
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    unreviewedVulnerabilityCounts.value = {}
    unreviewedVulnerabilityCountStatus.value = 'error'
  } finally {
    if (unreviewedVulnerabilityController?.signal === signal) {
      unreviewedVulnerabilityController = null
    }

    await nextTick()
    updateNewestCardHeight()
  }
}

async function fetchUnreviewedVulnerabilityCount(severity, signal) {
  const data = await getVulnerabilityList(
    {
      page: 1,
      page_size: 1,
      status: VULNERABILITY_STATUS_UNREVIEWED,
      severity
    },
    signal
  )
  const normalized = normalizeVulnerabilityListResponse(data, 1, 1)
  return normalized.total
}

onMounted(async () => {
  await registerResizeObserver()
  updateNewestCardHeight()
  window.addEventListener('resize', updateNewestCardHeight)
  void loadUnreviewedVulnerabilityCount()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopUnreviewedVulnerabilityRequest()
  window.removeEventListener('resize', updateNewestCardHeight)
})

watch(
  () => props.isSidebarCollapsed,
  async () => {
    await registerResizeObserver()
    updateNewestCardHeight()
  }
)
</script>

<template>
  <div class="dashboard-shell" :class="{ 'sidebar-collapsed': props.isSidebarCollapsed }">
    <AppSidebar
      :is-collapsed="props.isSidebarCollapsed"
      :primary-nav="navigationState.primaryNav"
      :secondary-nav="navigationState.secondaryNav"
      :footer-nav="footerNav"
      @toggle="emit('toggle-sidebar')"
      @navigate="props.navigateTo"
    />

    <main class="main-content">
      <DashboardTopbar />
      <DiscoverCard :navigate-to="props.navigateTo" />

      <section class="content-grid">
        <div ref="leftColumnRef" class="left-column">
          <OpenVulnerabilitiesCard :stats="dashboardVulnerabilityStats" :navigate-to="props.navigateTo" />
          <AssetsCard :stats="assetStats" />
          <RemediationEfficiencyCard :stats="remediationStats" />
          <RemediationOverviewCard :stats="remediationOverviewStats" />
        </div>

        <div class="right-column">
          <SecurityScoreCard ref="scoreCardRef" />
          <ApiKeyCard ref="apiCardRef" />
          <VulnIntelCard
            :latest-detections="latestDetections"
            :vulnerability-detections="vulnerabilityDetections"
            :min-height="newestCardMinHeight"
          />
        </div>
      </section>
    </main>
  </div>
</template>
