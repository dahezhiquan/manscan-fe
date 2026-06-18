<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  getNavigationState,
  latestDetections,
  remediationOverviewStats,
  remediationStats,
  vulnerabilityDetections,
  vulnerabilityStats
} from '../data/dashboard'

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

const emit = defineEmits(['toggle-sidebar'])

let resizeObserver = null

const navigationState = computed(() => getNavigationState(props.currentPath))

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

onMounted(async () => {
  await registerResizeObserver()
  updateNewestCardHeight()
  window.addEventListener('resize', updateNewestCardHeight)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
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
          <OpenVulnerabilitiesCard :stats="vulnerabilityStats" :navigate-to="props.navigateTo" />
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
