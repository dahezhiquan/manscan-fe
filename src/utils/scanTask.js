import {
  ACTIVE_SCAN_STATUSES,
  SCAN_SEVERITY_ORDER,
  SCAN_STATUS_META,
  SCAN_STRATEGY_LABELS
} from '../constants/scanTasks'

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return null
}

export function formatCount(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString('zh-CN') : String(value)
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '--'
  }

  const bounded = Math.min(100, Math.max(0, numeric))
  const digits = Number.isInteger(bounded) || bounded >= 100 ? 0 : 1
  return `${bounded.toFixed(digits)}%`
}

export function formatDateTime(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date)
}

export function formatDurationSeconds(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric < 0) {
    return '--'
  }

  const totalSeconds = Math.floor(numeric)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
}

export function formatDurationFromRange(startedAt, finishedAt, nowValue = Date.now()) {
  if (!startedAt) {
    return '--'
  }

  const startedAtMs = new Date(startedAt).getTime()

  if (Number.isNaN(startedAtMs)) {
    return '--'
  }

  const endSource = finishedAt || nowValue
  const finishedAtMs = new Date(endSource).getTime()

  if (Number.isNaN(finishedAtMs) || finishedAtMs < startedAtMs) {
    return '--'
  }

  return formatDurationSeconds(Math.floor((finishedAtMs - startedAtMs) / 1000))
}

export function formatScanStrategy(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const normalized = String(value).trim()
  return SCAN_STRATEGY_LABELS[normalized] ?? normalized
}

export function getScanTaskStatusMeta(status) {
  const normalized = normalizeStatus(status)
  return SCAN_STATUS_META[normalized] ?? { label: normalized || '未知', tone: 'neutral' }
}

export function isActiveScanStatus(status) {
  return ACTIVE_SCAN_STATUSES.has(normalizeStatus(status))
}

export function normalizeScanTaskListResponse(payload, fallbackPage = 1, fallbackPageSize = 10) {
  const normalizedPageSize = normalizePositiveInteger(
    firstDefined(payload?.pageSize, payload?.page_size),
    fallbackPageSize
  )
  const total = normalizeNonNegativeInteger(payload?.total, 0)
  const totalPagesFallback = total > 0 ? Math.ceil(total / normalizedPageSize) : 1

  return {
    items: normalizeScanTaskListPayload(payload),
    total,
    page: normalizePositiveInteger(payload?.page, fallbackPage),
    pageSize: normalizedPageSize,
    totalPages: normalizePositiveInteger(firstDefined(payload?.totalPages, payload?.total_pages), totalPagesFallback)
  }
}

export function normalizeScanTaskListPayload(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
  return items.map(normalizeScanTask)
}

export function normalizeScanTask(record) {
  const taskId = String(firstDefined(record?.id, record?.task_no, '') ?? '').trim()
  const taskNo = String(record?.task_no ?? '').trim()
  const status = normalizeStatus(firstDefined(record?.status, record?.finished_status))
  const startedAt = firstDefined(record?.started_at)
  const finishedAt = firstDefined(record?.finished_at, record?.completed_at)
  const progressPercent = normalizeNullableNumber(firstDefined(record?.progress_percent, record?.percent))
  const durationSeconds = normalizeNullableNumber(record?.duration_seconds)
  const createdBy = formatText(firstDefined(record?.created_by), '匿名用户')
  const scanStrategy = String(firstDefined(record?.scan_strategy, '') ?? '').trim()
  const severity = SCAN_SEVERITY_ORDER.reduce((result, key) => {
    result[key] = normalizeCountValue(firstDefined(record?.[`${key}_count`], record?.[key]))
    return result
  }, {})

  const severityTotal = Object.values(severity).reduce((total, count) => total + count, 0)
  const pluginCount = normalizeNullableNumber(firstDefined(record?.plugin_count, record?.template_count, record?.plugin))
  const techCount = normalizeNullableNumber(firstDefined(record?.tech_count, record?.tech))
  const targetCount = normalizeNullableNumber(firstDefined(record?.target_count, record?.targets_count))
  const totalRequests = normalizeNullableNumber(record?.total_requests)
  const realRequests = normalizeNullableNumber(firstDefined(record?.real_requests, record?.requests))
  const statusMeta = getScanTaskStatusMeta(status)
  const name = formatText(firstDefined(record?.name, taskNo, taskId), taskId ? `扫描任务 #${taskId}` : '未命名任务')
  const lastMessage = formatText(firstDefined(record?.last_message), '')

  return {
    id: taskId,
    taskNo,
    name,
    status,
    statusMeta,
    createdBy,
    scanStrategy,
    scanStrategyLabel: formatScanStrategy(scanStrategy),
    startedAt,
    startedAtDisplay: formatDateTime(startedAt),
    finishedAt,
    finishedAtDisplay: formatDateTime(finishedAt),
    progressPercent,
    progressPercentDisplay: formatPercent(progressPercent),
    durationSeconds,
    durationDisplay:
      durationSeconds !== null
        ? formatDurationSeconds(durationSeconds)
        : formatDurationFromRange(startedAt, finishedAt),
    pluginCount,
    pluginCountDisplay: formatCount(pluginCount),
    techCount,
    techCountDisplay: formatCount(techCount),
    targetCount,
    targetCountDisplay: formatCount(targetCount),
    totalRequests,
    totalRequestsDisplay: formatCount(totalRequests),
    realRequests,
    realRequestsDisplay: formatCount(realRequests),
    severity,
    severityTotal,
    lastMessage,
    lastMessageDisplay: lastMessage || '暂无最新进度消息',
    memoKey: [
      taskId,
      status,
      progressPercent,
      durationSeconds,
      totalRequests,
      realRequests,
      pluginCount,
      techCount,
      targetCount,
      startedAt,
      finishedAt,
      lastMessage,
      severityTotal
    ].join('|')
  }
}

export function severityLabel(key) {
  switch (key) {
    case 'critical':
      return 'Critical'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
    case 'info':
      return 'Info'
    default:
      return 'Unknown'
  }
}

function formatText(value, fallback = '--') {
  if (value === null || value === undefined) {
    return fallback
  }

  const normalized = String(value).trim()
  return normalized || fallback
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeCountValue(value) {
  const numeric = normalizeNullableNumber(value)
  return numeric === null ? 0 : Math.max(0, Math.trunc(numeric))
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback
}

function normalizeNonNegativeInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback
}
