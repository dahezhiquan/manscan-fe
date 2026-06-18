export const API_BASE_URL = ''
export const TEMPLATE_MULTI_VALUE_QUERY_MODE = 'repeat'

export const API_PREFIX = `${API_BASE_URL}/api/v1`

export const TEMPLATE_STATS_API = `${API_PREFIX}/templates/stats`
export const TEMPLATE_LIST_API = `${API_PREFIX}/templates`
export const TEMPLATE_DETAIL_API = `${API_PREFIX}/templates`
export const TEMPLATE_TAGS_API = `${API_PREFIX}/templates/options/tags`
export const TEMPLATE_PROTOCOLS_API = `${API_PREFIX}/templates/options/protocols`
export const SCAN_TASK_CREATE_API = `${API_PREFIX}/scans`

export function buildScanTaskApi(taskId) {
  return `${SCAN_TASK_CREATE_API}/${taskId}`
}

export function buildScanTaskLogsApi(taskId, offset = 0, limit = 200) {
  const searchParams = new URLSearchParams()
  searchParams.set('offset', String(offset))
  searchParams.set('limit', String(limit))

  return `${buildScanTaskApi(taskId)}/logs?${searchParams.toString()}`
}

export function buildScanTaskStreamApi(taskId, offset = 0) {
  const searchParams = new URLSearchParams()

  if (Number.isFinite(offset) && Number(offset) > 0) {
    searchParams.set('offset', String(offset))
  }

  const query = searchParams.toString()
  return `${buildScanTaskApi(taskId)}/stream${query ? `?${query}` : ''}`
}
