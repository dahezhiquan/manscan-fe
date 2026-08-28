import { computed, onBeforeUnmount, onMounted, ref, unref } from 'vue'
import { getScanTaskList } from '../api/scans'
import { getVulnerabilityList } from '../api/vulnerabilities'
import { VULNERABILITY_STATUS_UNREVIEWED } from '../constants/vulnerabilities'
import { getNavigationState } from '../data/dashboard'

const SIDEBAR_BADGE_POLL_INTERVAL = 10000
const sidebarBadgeCache = {
  runningScanCount: 0,
  unreviewedVulnerabilityCount: 0
}

export function useSidebarNavigation(currentPath) {
  const runningScanCount = ref(sidebarBadgeCache.runningScanCount)
  const unreviewedVulnerabilityCount = ref(sidebarBadgeCache.unreviewedVulnerabilityCount)

  let pollTimer = null
  let scanCountController = null
  let vulnerabilityCountController = null
  let currentRequestId = 0
  let isDisposed = false

  const navigationState = computed(() =>
    getNavigationState(unref(currentPath), {
      scanCount: runningScanCount.value,
      vulnerabilityCount: unreviewedVulnerabilityCount.value
    })
  )

  function clearPolling() {
    if (pollTimer) {
      window.clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function stopRequest() {
    scanCountController?.abort()
    vulnerabilityCountController?.abort()
    scanCountController = null
    vulnerabilityCountController = null
  }

  function schedulePolling() {
    if (isDisposed) {
      return
    }

    clearPolling()
    pollTimer = window.setTimeout(() => {
      void loadSidebarBadgeCounts()
    }, SIDEBAR_BADGE_POLL_INTERVAL)
  }

  async function loadSidebarBadgeCounts() {
    clearPolling()
    stopRequest()

    const requestId = ++currentRequestId
    scanCountController = new AbortController()
    vulnerabilityCountController = new AbortController()

    try {
      const [scanResult, vulnerabilityResult] = await Promise.allSettled([
        getScanTaskList(
          {
            page: 1,
            page_size: 1,
            status: 'running'
          },
          scanCountController.signal
        ),
        getVulnerabilityList(
          {
            page: 1,
            page_size: 1,
            status: VULNERABILITY_STATUS_UNREVIEWED
          },
          vulnerabilityCountController.signal
        )
      ])

      if (requestId !== currentRequestId || isDisposed) {
        return
      }

      if (scanResult.status === 'fulfilled') {
        runningScanCount.value = normalizeCount(scanResult.value?.total)
        sidebarBadgeCache.runningScanCount = runningScanCount.value
      }
      if (vulnerabilityResult.status === 'fulfilled') {
        unreviewedVulnerabilityCount.value = normalizeCount(vulnerabilityResult.value?.total)
        sidebarBadgeCache.unreviewedVulnerabilityCount = unreviewedVulnerabilityCount.value
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }
    } finally {
      if (requestId === currentRequestId) {
        scanCountController = null
        vulnerabilityCountController = null
        schedulePolling()
      }
    }
  }

  function normalizeCount(value) {
    const nextCount = Number.parseInt(String(value ?? 0), 10)
    return Number.isFinite(nextCount) ? nextCount : 0
  }

  onMounted(() => {
    isDisposed = false
    void loadSidebarBadgeCounts()
  })

  onBeforeUnmount(() => {
    isDisposed = true
    clearPolling()
    stopRequest()
  })

  return {
    navigationState,
    runningScanCount,
    unreviewedVulnerabilityCount
  }
}
