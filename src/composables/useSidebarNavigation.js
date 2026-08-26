import { computed, onBeforeUnmount, onMounted, ref, unref } from 'vue'
import { getScanTaskList } from '../api/scans'
import { getNavigationState } from '../data/dashboard'

const RUNNING_SCAN_COUNT_POLL_INTERVAL = 10000

export function useSidebarNavigation(currentPath) {
  const runningScanCount = ref(0)

  let pollTimer = null
  let fetchController = null
  let currentRequestId = 0
  let isDisposed = false

  const navigationState = computed(() =>
    getNavigationState(unref(currentPath), {
      scanCount: runningScanCount.value
    })
  )

  function clearPolling() {
    if (pollTimer) {
      window.clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function stopRequest() {
    fetchController?.abort()
    fetchController = null
  }

  function schedulePolling() {
    if (isDisposed) {
      return
    }

    clearPolling()
    pollTimer = window.setTimeout(() => {
      void loadRunningScanCount()
    }, RUNNING_SCAN_COUNT_POLL_INTERVAL)
  }

  async function loadRunningScanCount() {
    clearPolling()
    stopRequest()

    const requestId = ++currentRequestId
    const controller = new AbortController()
    fetchController = controller

    try {
      const response = await getScanTaskList(
        {
          page: 1,
          page_size: 1,
          status: 'running'
        },
        controller.signal
      )

      if (requestId !== currentRequestId || isDisposed) {
        return
      }

      const nextCount = Number.parseInt(String(response?.total ?? 0), 10)
      runningScanCount.value = Number.isFinite(nextCount) ? nextCount : 0
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }
    } finally {
      if (requestId === currentRequestId) {
        fetchController = null
        schedulePolling()
      }
    }
  }

  onMounted(() => {
    isDisposed = false
    void loadRunningScanCount()
  })

  onBeforeUnmount(() => {
    isDisposed = true
    clearPolling()
    stopRequest()
  })

  return {
    navigationState,
    runningScanCount
  }
}
