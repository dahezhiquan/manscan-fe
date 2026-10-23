export const API_BASE_URL = ''
export const TEMPLATE_MULTI_VALUE_QUERY_MODE = 'repeat'

export const API_PREFIX = `${API_BASE_URL}/api/v1`

export const DASHBOARD_OVERVIEW_API = `${API_PREFIX}/dashboard/overview`
export const DASHBOARD_ASSET_RISKS_API = `${API_PREFIX}/dashboard/asset-risks`
export const DASHBOARD_HOST_RANKINGS_API = `${API_PREFIX}/dashboard/host-rankings`
export const DASHBOARD_SERVICE_FINGERPRINTS_API = `${API_PREFIX}/dashboard/service-fingerprints`

export const AUTH_CHALLENGE_API = `${API_PREFIX}/auth/challenge`
export const AUTH_LOGIN_API = `${API_PREFIX}/auth/login`
export const AUTH_ME_API = `${API_PREFIX}/auth/me`
export const AUTH_LOGOUT_API = `${API_PREFIX}/auth/logout`
export const USERS_API = `${API_PREFIX}/users`
export const THIRD_PARTY_API_KEYS_API = `${API_PREFIX}/third-party-api-keys`
export const SETTINGS_THEME_API = `${API_PREFIX}/settings/theme`
export const TEMPLATE_STATS_API = `${API_PREFIX}/templates/stats`
export const TEMPLATE_LIST_API = `${API_PREFIX}/templates`
export const TEMPLATE_DETAIL_API = `${API_PREFIX}/templates`
export const TEMPLATE_TAGS_API = `${API_PREFIX}/templates/options/tags`
export const TEMPLATE_PROTOCOLS_API = `${API_PREFIX}/templates/options/protocols`
export const SCAN_TASK_CREATE_API = `${API_PREFIX}/scans`
export const SCAN_TASK_STATS_API = `${API_PREFIX}/scans/stats`
export const SCAN_TASK_NAME_OPTIONS_API = `${API_PREFIX}/scans/options/names`
export const SCAN_TASK_DELETE_API = SCAN_TASK_CREATE_API
export const DOMAIN_ASSET_LIST_API = `${API_PREFIX}/domain-assets`
export const DOMAIN_ASSET_DETAIL_API = `${DOMAIN_ASSET_LIST_API}/detail`
export const DOMAIN_ASSET_MANUAL_NOTE_API = `${DOMAIN_ASSET_LIST_API}/manual-note`
export const DOMAIN_ASSET_LATEST_SCREENSHOT_API = `${DOMAIN_ASSET_LIST_API}/screenshots/latest`
export const DOMAIN_ASSET_SCREENSHOTS_API = `${DOMAIN_ASSET_LIST_API}/screenshots`
export const HOST_ASSET_LIST_API = `${API_PREFIX}/host-assets`
export const HOST_ASSET_DETAIL_API = `${HOST_ASSET_LIST_API}/detail`
export const HOST_ASSET_MANUAL_NOTE_API = `${HOST_ASSET_LIST_API}/manual-note`
export const ASSET_CONFIG_CENTER_API = `${API_PREFIX}/asset-config-centers`
export const ASSET_CONFIG_CENTER_LIST_API = ASSET_CONFIG_CENTER_API
export const ASSET_CONFIG_CENTER_SMALL_CATEGORY_OPTIONS_API = `${ASSET_CONFIG_CENTER_API}/options/small-categories`
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

export function buildScanTaskConfigApi(taskId) {
  return `${buildScanTaskApi(taskId)}/config`
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

export function buildScanTaskRawLogsArchiveApi(taskId) {
  return `${buildScanTaskApi(taskId)}/raw-logs/archive`
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
