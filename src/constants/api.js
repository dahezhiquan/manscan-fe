export const API_BASE_URL = ''
export const TEMPLATE_MULTI_VALUE_QUERY_MODE = 'repeat'

export const API_PREFIX = `${API_BASE_URL}/api/v1`

export const TEMPLATE_STATS_API = `${API_PREFIX}/templates/stats`
export const TEMPLATE_LIST_API = `${API_PREFIX}/templates`
export const TEMPLATE_DETAIL_API = `${API_PREFIX}/templates`
export const TEMPLATE_TAGS_API = `${API_PREFIX}/templates/options/tags`
export const TEMPLATE_PROTOCOLS_API = `${API_PREFIX}/templates/options/protocols`
export const SCAN_TASK_CREATE_API = `${API_PREFIX}/scans`
export const SCAN_TASK_STATS_API = `${API_PREFIX}/scans/stats`
export const SCAN_TASK_NAME_OPTIONS_API = `${API_PREFIX}/scans/options/names`
export const SCAN_TASK_DELETE_API = SCAN_TASK_CREATE_API
export const VULNERABILITY_LIST_API = `${API_PREFIX}/vulnerabilities`
export const VULNERABILITY_BATCH_STATUS_API = `${VULNERABILITY_LIST_API}/status`

export function buildVulnerabilityDetailApi(vulnerabilityId) {
  return `${VULNERABILITY_LIST_API}/${encodeURIComponent(vulnerabilityId)}`
}

export function buildVulnerabilityStatusApi(vulnerabilityId) {
  return `${buildVulnerabilityDetailApi(vulnerabilityId)}/status`
}

export function buildScanTaskApi(taskId) {
  return `${SCAN_TASK_CREATE_API}/${taskId}`
}

export function buildScanTaskCancelApi(taskId) {
  return `${buildScanTaskApi(taskId)}/cancel`
}

export function buildScanTaskPauseApi(taskId) {
  return `${buildScanTaskApi(taskId)}/pause`
}

export function buildScanTaskResumeApi(taskId) {
  return `${buildScanTaskApi(taskId)}/resume`
}

export function buildScanTaskRescanApi(taskId) {
  return `${buildScanTaskApi(taskId)}/rescan`
}

export function buildScanTaskResponsesArchiveApi(taskId) {
  return `${buildScanTaskApi(taskId)}/responses/archive`
}

export function buildScanTaskLogsApi(taskId, offset = 0, limit = 200, direction = '') {
  const searchParams = new URLSearchParams()
  searchParams.set('offset', String(offset))
  searchParams.set('limit', String(limit))

  if (direction) {
    searchParams.set('direction', String(direction))
  }

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
