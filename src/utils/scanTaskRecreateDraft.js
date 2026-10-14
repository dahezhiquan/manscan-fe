const SCAN_TASK_RECREATE_DRAFT_TTL_MS = 30 * 60 * 1000
const MB_TO_BYTES = 1024 * 1024
let pendingScanTaskRecreateDraft = null

const CONFIG_SOURCE_KEYS = [
  'scan_config',
  'scanConfig',
  'config',
  'create_request',
  'createRequest',
  'request',
  'raw',
  'options',
  'params',
  'payload'
]

const FORM_FIELD_KEYS = [
  'name',
  'description',
  'created_by',
  'targets',
  'exclude_targets',
  'scan_all_ips',
  'tags',
  'include_ids',
  'severities',
  'protocols',
  'store_response',
  'timestamp',
  'matcher_status',
  'custom_headers',
  'vars',
  'follow_redirects',
  'follow_host_redirects',
  'max_redirects',
  'disable_redirects',
  'force_attempt_http2',
  'sni',
  'allow_local_file_access',
  'attack_type',
  'source_ip',
  'response_read_size',
  'response_save_size',
  'tls_impersonate',
  'rate_limit',
  'rate_limit_duration',
  'bulk_size',
  'template_threads',
  'headless_bulk_size',
  'headless_template_threads',
  'js_concurrency',
  'payload_concurrency',
  'probe_concurrency',
  'timeout',
  'retries',
  'max_host_error',
  'no_host_errors',
  'project',
  'project_path',
  'scan_strategy',
  'dast',
  'headless',
  'page_timeout',
  'show_browser',
  'headless_optional_arguments',
  'use_installed_chrome',
  'cdp_endpoint',
  'show_actions',
  'proxy',
  'proxy_internal',
  'interactsh_server',
  'interactsh_token',
  'no_interactsh',
  'enable_progress_bar',
  'stats_interval',
  'metrics_port',
  'http_stats',
  'new_templates',
  'automatic_scan',
  'preflight_fingerprint',
  'enable_global_matchers_templates'
]

const ARRAY_FIELD_KEYS = new Set([
  'targets',
  'exclude_targets',
  'tags',
  'include_ids',
  'severities',
  'protocols',
  'custom_headers',
  'vars',
  'headless_optional_arguments',
  'proxy'
])

const NUMBER_FIELD_KEYS = new Set([
  'max_redirects',
  'response_read_size',
  'response_save_size',
  'rate_limit',
  'rate_limit_duration',
  'bulk_size',
  'template_threads',
  'headless_bulk_size',
  'headless_template_threads',
  'js_concurrency',
  'payload_concurrency',
  'probe_concurrency',
  'timeout',
  'retries',
  'max_host_error',
  'page_timeout',
  'stats_interval',
  'metrics_port'
])

const BOOLEAN_FIELD_KEYS = new Set([
  'scan_all_ips',
  'store_response',
  'timestamp',
  'matcher_status',
  'follow_redirects',
  'follow_host_redirects',
  'disable_redirects',
  'force_attempt_http2',
  'allow_local_file_access',
  'tls_impersonate',
  'no_host_errors',
  'project',
  'dast',
  'headless',
  'show_browser',
  'use_installed_chrome',
  'show_actions',
  'proxy_internal',
  'no_interactsh',
  'enable_progress_bar',
  'http_stats',
  'new_templates',
  'automatic_scan',
  'preflight_fingerprint',
  'enable_global_matchers_templates'
])

const RESPONSE_SIZE_FIELD_KEYS = new Set(['response_read_size', 'response_save_size'])

export function saveScanTaskRecreateDraft(configRecord, sourceTaskRecord = {}) {
  const draft = buildScanTaskRecreateDraft(configRecord, sourceTaskRecord)

  if (!draft) {
    throw new Error('当前任务缺少可带入创建页的扫描配置。')
  }

  pendingScanTaskRecreateDraft = draft
  return draft
}

export function consumeScanTaskRecreateDraft() {
  const draft = pendingScanTaskRecreateDraft
  pendingScanTaskRecreateDraft = null

  if (!draft) {
    return null
  }

  const createdAt = Number(draft?.created_at)

  if (!Number.isFinite(createdAt) || Date.now() - createdAt > SCAN_TASK_RECREATE_DRAFT_TTL_MS) {
    return null
  }

  if (!draft?.form || typeof draft.form !== 'object') {
    return null
  }

  return draft
}

function buildScanTaskRecreateDraft(configRecord, sourceTaskRecord) {
  if (!configRecord || typeof configRecord !== 'object') {
    return null
  }

  const sources = collectConfigSources(configRecord)
  const form = {}

  FORM_FIELD_KEYS.forEach((key) => {
    const rawValue = pickFieldValue(sources, key)

    if (rawValue === undefined || rawValue === null) {
      return
    }

    const normalizedValue = normalizeDraftValue(key, rawValue)

    if (normalizedValue === undefined) {
      return
    }

    form[key] = normalizedValue
  })

  if (!form.targets?.length) {
    const inlineTargets = pickFieldValue(sources, 'inline_targets_list')
    const normalizedTargets = normalizeArrayValue(inlineTargets)

    if (normalizedTargets.length > 0) {
      form.targets = normalizedTargets
    }
  }

  if (Object.keys(form).length === 0) {
    return null
  }

  return {
    created_at: Date.now(),
    source_task_id: sourceTaskRecord?.id ?? configRecord.task_id ?? configRecord.id ?? '',
    source_task_no: sourceTaskRecord?.task_no ?? configRecord.task_no ?? '',
    source_task_name: sourceTaskRecord?.name ?? configRecord.name ?? '',
    form
  }
}

function collectConfigSources(taskRecord) {
  const nestedSources = CONFIG_SOURCE_KEYS
    .map((key) => normalizeObjectSource(taskRecord[key]))
    .filter(Boolean)

  return [...nestedSources, taskRecord]
}

function normalizeObjectSource(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function pickFieldValue(sources, key) {
  const camelKey = toCamelCase(key)

  for (const source of sources) {
    if (!source || typeof source !== 'object') {
      continue
    }

    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key]
    }

    if (Object.prototype.hasOwnProperty.call(source, camelKey)) {
      return source[camelKey]
    }
  }

  return undefined
}

function normalizeDraftValue(key, value) {
  if (ARRAY_FIELD_KEYS.has(key)) {
    return normalizeArrayValue(value)
  }

  if (NUMBER_FIELD_KEYS.has(key)) {
    return normalizeNumberValue(key, value)
  }

  if (BOOLEAN_FIELD_KEYS.has(key)) {
    return normalizeBooleanValue(value)
  }

  return normalizeStringValue(value)
}

function normalizeArrayValue(value) {
  if (Array.isArray(value)) {
    return cleanStringList(value)
  }

  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed)

    if (Array.isArray(parsed)) {
      return cleanStringList(parsed)
    }
  } catch {
    // Fall through to line-based parsing for textarea-like fields.
  }

  return cleanStringList(trimmed.split(/\r?\n/))
}

function normalizeNumberValue(key, value) {
  if (value === '') {
    return undefined
  }

  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return undefined
  }

  if (RESPONSE_SIZE_FIELD_KEYS.has(key) && numeric >= 1024) {
    return Number((numeric / MB_TO_BYTES).toFixed(3))
  }

  return numeric
}

function normalizeBooleanValue(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  const normalized = String(value ?? '').trim().toLowerCase()

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false
  }

  return Boolean(value)
}

function normalizeStringValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return undefined
  }

  const text = String(value ?? '').trim()
  return text ? text : undefined
}

function cleanStringList(value) {
  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
}

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, character) => character.toUpperCase())
}
