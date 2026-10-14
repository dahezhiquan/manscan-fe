import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { getDashboardOverview, getDashboardAssetRisks, getDashboardHostRankings, getDashboardServiceFingerprints } from '../api/dashboard'
import { DASHBOARD_REFRESH_TIMEOUT } from '../constants/dashboard'

/** 每个区块独立加载、取消和重试，较慢或失败的接口不阻塞其他区块。 */
export function useDashboardOverview() {
  const loaders = {
    overview: getDashboardOverview,
    assetRisks: getDashboardAssetRisks,
    hostRankings: getDashboardHostRankings,
    fingerprints: getDashboardServiceFingerprints
  }
  const sections = reactive(Object.fromEntries(Object.keys(loaders).map((key) => [key, {
    data: null, status: 'idle', error: '', errorCode: null, updatedAt: null
  }])))
  const requests = new Map()
  let disposed = false
  const isLoading = computed(() => Object.values(sections).some((section) => section.status === 'loading'))
  const failedCount = computed(() => Object.values(sections).filter((section) => section.status === 'error').length)
  const refreshedAt = computed(() => {
    const times = Object.values(sections).map((section) => section.updatedAt).filter(Boolean)
    return times.length ? new Date(Math.max(...times.map(Number))) : null
  })

  async function refreshSection(key) {
    if (disposed || !loaders[key]) return
    const previous = requests.get(key)
    previous?.controller.abort()
    window.clearTimeout(previous?.timeout)
    const controller = new AbortController()
    const request = { controller, timeout: null, timedOut: false }
    requests.set(key, request)
    const section = sections[key]
    Object.assign(section, { status: 'loading', error: '', errorCode: null })
    request.timeout = window.setTimeout(() => {
      request.timedOut = true
      controller.abort()
    }, DASHBOARD_REFRESH_TIMEOUT)

    try {
      const data = await loaders[key](controller.signal)
      if (disposed || requests.get(key) !== request) return
      Object.assign(section, { data, status: 'success', updatedAt: new Date() })
    } catch (error) {
      if (disposed || requests.get(key) !== request) return
      Object.assign(section, {
        status: 'error',
        error: request.timedOut ? '数据加载超时，请重试' : error?.message || '数据暂不可用，请重试',
        errorCode: error?.code ?? error?.status ?? null
      })
    } finally {
      window.clearTimeout(request.timeout)
      if (requests.get(key) === request) requests.delete(key)
    }
  }

  async function refresh() {
    await Promise.all(Object.keys(loaders).map(refreshSection))
  }

  onMounted(() => { void refresh() })
  onBeforeUnmount(() => {
    disposed = true
    for (const { controller, timeout } of requests.values()) {
      controller.abort()
      window.clearTimeout(timeout)
    }
    requests.clear()
  })

  return { sections, isLoading, failedCount, refreshedAt, refresh, refreshSection }
}
