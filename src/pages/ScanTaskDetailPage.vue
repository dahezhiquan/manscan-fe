<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  cancelScanTask,
  createScanTaskStream,
  getScanTask,
  getScanTaskLogs,
  pauseScanTask,
  resumeScanTask
} from '../api/scans'
import { mapSeverityTone } from '../utils/template'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/scans'
  }
})

const TERMINAL_STATUSES = new Set(['success', 'failed', 'cancelled'])
const LIVE_LOG_PRELOAD_SIZE = 50
const LOG_PAGE_SIZE = 50
const LIVE_LOG_RESTORE_PAGE_SIZE = 1000
const LOG_SCROLL_PRELOAD_THRESHOLD = 96
const STREAM_RETRY_DELAY = 2500
const SUMMARY_POLL_INTERVAL = 5000
const LOG_LEVEL_LABELS = {
  info: 'INFO',
  debug: 'DEBUG',
  warn: 'WARN',
  error: 'ERROR',
  match: 'MATCH'
}
const SCAN_STRATEGY_LABELS = {
  auto: '自动适配',
  'host-spray': '先按 Host 扫描',
  'template-spray': '先按模板扫描'
}

const task = ref(null)
const progress = ref(null)
const events = ref([])
const pageError = ref('')
const streamError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const isCancelling = ref(false)
const isPauseActionLoading = ref(false)
const streamOffset = ref(0)
const olderLogsOffset = ref(null)
const isInitializing = ref(false)
const streamState = ref('idle')
const nowTick = ref(Date.now())
const logViewport = ref(null)
const logMode = ref('live')
const isLoadingOlderLogs = ref(false)
const isHydratingCompletedLogs = ref(false)
const isRestoringLiveHistory = ref(false)
const hasOlderLogs = ref(false)
const earliestLoadedSeq = ref(null)
const latestLoadedSeq = ref(null)
const actionStatusOverride = ref('')

let currentTaskRequestId = 0
let fetchController = null
let eventSource = null
let reconnectTimer = null
let durationTimer = null
let summaryPollTimer = null
let liveHistoryRestoreId = 0

const taskId = computed(() => {
  const match = props.currentPath.match(/^\/scans\/([^/]+)$/)
  return match?.[1] ?? ''
})

const taskStatus = computed(() => {
  const overrideStatus = normalizeStatusValue(actionStatusOverride.value)
  return overrideStatus || resolveServerTaskStatus()
})

const taskStatusMeta = computed(() => getStatusMeta(taskStatus.value))
const isTaskPaused = computed(() => taskStatus.value === 'paused')
const isTaskFinished = computed(() => {
  if (isTaskPaused.value) {
    return false
  }

  if (TERMINAL_STATUSES.has(taskStatus.value)) {
    return true
  }

  const finishedStatus = normalizeStatusValue(progress.value?.finished_status)

  if (TERMINAL_STATUSES.has(finishedStatus)) {
    return true
  }

  return Boolean(progress.value?.finished)
})
const isTaskInactive = computed(() => isTaskFinished.value || isTaskPaused.value)

const taskTitle = computed(() => {
  const name = String(task.value?.name ?? '').trim()

  if (name) {
    return name
  }

  return taskId.value ? `扫描任务 #${taskId.value}` : '扫描任务详情'
})

const taskSubtitle = computed(() => {
  const description = resolveTaskDescription(task.value)

  if (description) {
    return description
  }

  return '暂无扫描描述。'
})

const streamStatusMeta = computed(() => {
  if (isTaskPaused.value) {
    return { label: '扫描已暂停', tone: 'paused' }
  }

  if (streamState.value === 'connected') {
    return { label: 'SSE 已连接', tone: 'connected' }
  }

  if (streamState.value === 'connecting') {
    return { label: 'SSE 连接中', tone: 'connecting' }
  }

  if (streamState.value === 'reconnecting') {
    return { label: 'SSE 重连中', tone: 'warning' }
  }

  if (streamState.value === 'complete') {
    return { label: '扫描已结束', tone: 'complete' }
  }

  return { label: 'SSE 未连接', tone: 'idle' }
})

const progressCards = computed(() => [
  {
    label: '完成度',
    value: formatPercent(progress.value?.percent),
    tone: 'blue'
  },
  {
    label: '实际请求数',
    value: formatCount(progress.value?.requests),
    tone: 'yellow'
  },
  {
    label: '漏洞命中',
    value: formatCount(resolveVulnerabilityMatchCount(task.value, progress.value)),
    tone: 'pink'
  },
  {
    label: '指纹识别数量',
    value: formatCount(task.value?.tech_count),
    tone: 'orange'
  },
  {
    label: '扫描目标数量',
    value: formatCount(resolveTargetCount(task.value, progress.value)),
    tone: 'green'
  },
  {
    label: '实际漏洞插件数量',
    value: formatCount(firstDefined(task.value?.template_count, task.value?.plugin_count, progress.value?.templates)),
    tone: 'paper'
  }
])

const infoItems = computed(() => [
  {
    label: '任务状态',
    value: taskStatusMeta.value.label,
    tone: taskStatusMeta.value.tone,
    emphasis: true
  },
  {
    label: '启动时间',
    value: formatDateTime(task.value?.started_at)
  },
  {
    label: '结束时间',
    value: formatEndTime()
  },
  {
    label: '扫描时长',
    value: formatDuration(task.value?.started_at, resolveFinishedTime(), nowTick.value)
  },
  {
    label: '预估总请求数',
    value: formatCount(progress.value?.total_requests),
    tooltip: '通过模版聚类分析技术和 project 缓存技术，实际请求数可能大大减少'
  },
  {
    label: '扫描目标数量',
    value: formatCount(resolveTargetCount(task.value, progress.value))
  },
  {
    label: '存活主机数量',
    value: formatCount(pickFirstValue(task.value, ['alive_hosts', 'live_hosts', 'up_hosts']) ?? progress.value?.hosts)
  },
  {
    label: '无响应主机数量',
    value: formatCount(pickFirstValue(task.value, ['unresponsive_hosts', 'no_response_hosts', 'dead_hosts', 'timeout_hosts']))
  },
  {
    label: '指定扫描时段',
    value: formatWindowValue(
      pickFirstValue(task.value, ['scan_time_window', 'scan_time_windows', 'allowed_time_ranges', 'allow_time_ranges', 'schedule_window'])
    )
  },
  {
    label: '指定禁扫时段',
    value: formatWindowValue(
      pickFirstValue(task.value, ['blackout_windows', 'forbid_time_ranges', 'disable_time_ranges', 'blocked_time_ranges'])
    )
  }
])

const logCountLabel = computed(() => `${events.value.length} 条`)
const showReconnectButton = computed(() => streamState.value !== 'connected' && !isTaskInactive.value)
const scanStrategyLabel = computed(() => formatScanStrategy(task.value?.scan_strategy))
const showLoadOlderHint = computed(() => logMode.value === 'paged' && (hasOlderLogs.value || isLoadingOlderLogs.value))
const canCancelTask = computed(() => ['pending', 'running', 'paused'].includes(taskStatus.value))
const canPauseTask = computed(() => ['pending', 'running'].includes(taskStatus.value))
const canResumeTask = computed(() => taskStatus.value === 'paused')
const showPauseToggleButton = computed(() => canPauseTask.value || canResumeTask.value)
const pauseToggleAriaLabel = computed(() => {
  if (isPauseActionLoading.value) {
    return canResumeTask.value ? '正在继续扫描任务' : '正在暂停扫描任务'
  }

  return canResumeTask.value ? '继续扫描任务' : '暂停扫描任务'
})

function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return null
}

function pickFirstValue(record, keys) {
  if (!record || typeof record !== 'object') {
    return null
  }

  for (const key of keys) {
    const value = record[key]

    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return null
}

function resolveTaskDescription(taskRecord) {
  const description = pickFirstValue(taskRecord, [
    'description',
    'scan_description',
    'task_description',
    'desc',
    'remark',
    'memo',
    'note',
    'summary'
  ])

  return description === null ? '' : String(description).trim()
}

function formatCount(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toLocaleString('zh-CN') : String(value)
}

function formatPercent(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return '--'
  }

  return `${numeric.toFixed(numeric >= 100 ? 0 : 1)}%`
}

function formatDateTime(value) {
  if (!value) {
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

function formatDuration(startedAt, finishedAt, nowValue) {
  if (!startedAt) {
    return '--'
  }

  const startTime = new Date(startedAt).getTime()

  if (Number.isNaN(startTime)) {
    return '--'
  }

  const endTime = finishedAt ? new Date(finishedAt).getTime() : nowValue

  if (Number.isNaN(endTime) || endTime < startTime) {
    return '--'
  }

  const totalSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
}

function formatScanStrategy(value) {
  if (!value) {
    return '--'
  }

  return SCAN_STRATEGY_LABELS[value] ? `${SCAN_STRATEGY_LABELS[value]} · ${value}` : String(value)
}

function normalizeStatusValue(status) {
  return String(status ?? '').trim().toLowerCase()
}

function resolveServerTaskStatus() {
  const finishedStatus = normalizeStatusValue(progress.value?.finished_status)

  if (finishedStatus === 'paused' || isTerminalStatus(finishedStatus)) {
    return finishedStatus
  }

  const currentStatus = normalizeStatusValue(task.value?.status)
  return currentStatus || finishedStatus
}

function syncActionStatusOverride() {
  const overrideStatus = normalizeStatusValue(actionStatusOverride.value)

  if (!overrideStatus) {
    return
  }

  const serverStatus = resolveServerTaskStatus()

  if (!serverStatus) {
    return
  }

  if (overrideStatus === 'paused') {
    if (serverStatus === 'paused' || isTerminalStatus(serverStatus)) {
      actionStatusOverride.value = ''
    }
    return
  }

  if (overrideStatus === 'pending') {
    if (serverStatus === 'pending' || serverStatus === 'running' || isTerminalStatus(serverStatus)) {
      actionStatusOverride.value = ''
    }
  }
}

function resolveFinishedTime() {
  if (!isTaskInactive.value) {
    return null
  }

  return pickFirstValue(task.value, ['finished_at', 'completed_at']) ?? progress.value?.last_updated_at ?? null
}

function formatEndTime() {
  return formatDateTime(resolveFinishedTime())
}

function formatWindowValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--'
  }

  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }

        if (item && typeof item === 'object') {
          const start = firstDefined(item.start, item.from, item.begin)
          const end = firstDefined(item.end, item.to, item.finish)

          if (start || end) {
            return [start, end].filter(Boolean).join(' - ')
          }
        }

        return ''
      })
      .filter(Boolean)

    return formatted.length > 0 ? formatted.join(' / ') : '--'
  }

  if (typeof value === 'object') {
    const start = firstDefined(value.start, value.from, value.begin)
    const end = firstDefined(value.end, value.to, value.finish)

    if (start || end) {
      return [start, end].filter(Boolean).join(' - ')
    }
  }

  return String(value)
}

function resolveTargetCount(taskRecord, progressRecord) {
  const directCount = pickFirstValue(taskRecord, ['target_count', 'targets_count', 'total_targets', 'hosts_total'])

  if (directCount !== null) {
    return directCount
  }

  if (Array.isArray(taskRecord?.targets)) {
    return taskRecord.targets.length
  }

  if (typeof taskRecord?.inline_targets_list === 'string') {
    return taskRecord.inline_targets_list
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean).length
  }

  return progressRecord?.hosts ?? null
}

function resolveVulnerabilityMatchCount(taskRecord, progressRecord) {
  const severityKeys = ['critical_count', 'high_count', 'medium_count', 'low_count', 'info_count']
  const hasSeverityBreakdown = severityKeys.some((key) => taskRecord?.[key] !== null && taskRecord?.[key] !== undefined && taskRecord?.[key] !== '')

  if (hasSeverityBreakdown) {
    return severityKeys.reduce((total, key) => total + normalizeCountValue(taskRecord?.[key]), 0)
  }

  return progressRecord?.matched ?? null
}

function normalizeCountValue(value) {
  const count = Number(value)
  return Number.isFinite(count) ? count : 0
}

function getStatusMeta(status) {
  if (status === 'success') {
    return { label: '扫描结束（成功）', tone: 'success' }
  }

  if (status === 'failed') {
    return { label: '扫描结束（失败）', tone: 'error' }
  }

  if (status === 'cancelled') {
    return { label: '已取消', tone: 'warning' }
  }

  if (status === 'running') {
    return { label: '正在扫描', tone: 'running' }
  }

  if (status === 'pending') {
    return { label: '等待执行', tone: 'pending' }
  }

  if (status === 'paused') {
    return { label: '已暂停', tone: 'paused' }
  }

  return { label: status ? String(status) : '未知', tone: 'neutral' }
}

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(normalizeStatusValue(status))
}

function normalizeLogEvent(eventRecord) {
  if (!eventRecord || typeof eventRecord !== 'object') {
    return null
  }

  const data = eventRecord.data && typeof eventRecord.data === 'object' ? eventRecord.data : null

  return {
    seq: Number.isFinite(Number(eventRecord.seq)) ? Number(eventRecord.seq) : null,
    time: eventRecord.time || eventRecord.created_at || '',
    level: String(eventRecord.level || 'info').toLowerCase(),
    type: String(eventRecord.type || 'stdout').toLowerCase(),
    message: String(eventRecord.message || ''),
    data,
    severityTone: resolveLogSeverityTone(eventRecord, data)
  }
}

function resolveLogSeverityTone(eventRecord, data) {
  const directSeverity = firstDefined(
    eventRecord?.severity,
    data?.severity,
    data?.info?.severity,
    data?.template_info?.severity,
    data?.template?.severity
  )

  if (directSeverity) {
    return mapSeverityTone(directSeverity)
  }

  const message = String(eventRecord?.message || '')
  const severityFromMessage = message.match(/\[(critical|high|medium|low|info|严重|高危|中危|低危|信息)\]/i)?.[1]

  if (severityFromMessage) {
    return mapSeverityTone(severityFromMessage)
  }

  return 'unknown'
}

function logRowClasses(item) {
  const classes = [`is-${item.level}`, `type-${item.type}`]

  if (item.level === 'match') {
    classes.push(`severity-${item.severityTone || 'unknown'}`)
  }

  return classes
}

function eventKey(eventRecord) {
  if (eventRecord.seq !== null) {
    return `seq:${eventRecord.seq}`
  }

  return `${eventRecord.time}|${eventRecord.level}|${eventRecord.type}|${eventRecord.message}`
}

function sortEvents(left, right) {
  if (left.seq !== null && right.seq !== null) {
    return left.seq - right.seq
  }

  if (left.seq !== null) {
    return -1
  }

  if (right.seq !== null) {
    return 1
  }

  return String(left.time).localeCompare(String(right.time))
}

function updateLoadedSequenceState(sourceEvents = events.value) {
  const seqList = sourceEvents.map((item) => item.seq).filter((item) => Number.isFinite(item))

  earliestLoadedSeq.value = seqList.length > 0 ? Math.min(...seqList) : null
  latestLoadedSeq.value = seqList.length > 0 ? Math.max(...seqList) : null
}

function extractEvents(payload) {
  if (Array.isArray(payload?.events)) {
    return payload.events
  }

  if (payload?.event && typeof payload.event === 'object') {
    return [payload.event]
  }

  if (payload?.seq !== undefined || payload?.message) {
    return [payload]
  }

  if (payload?.data && (payload.data.seq !== undefined || payload.data.message)) {
    return [payload.data]
  }

  return []
}

function mergeEvents(incomingEvents, replace = false) {
  const normalizedIncoming = incomingEvents.map((item) => normalizeLogEvent(item)).filter(Boolean)

  if (normalizedIncoming.length === 0 && !replace) {
    return
  }

  const shouldStickToBottom = isLogNearBottom()
  const merged = new Map()

  if (!replace) {
    events.value.forEach((item) => merged.set(eventKey(item), item))
  }

  normalizedIncoming.forEach((item) => merged.set(eventKey(item), item))

  events.value = Array.from(merged.values()).sort(sortEvents)
  updateLoadedSequenceState()
  syncLogScroll(shouldStickToBottom || replace)
}

function replaceEvents(nextEvents, { stickToBottom = false } = {}) {
  events.value = nextEvents.slice().sort(sortEvents)
  updateLoadedSequenceState()
  syncLogScroll(stickToBottom)
}

function prependEvents(nextEvents) {
  if (nextEvents.length === 0) {
    return
  }

  const viewport = logViewport.value
  const previousScrollHeight = viewport?.scrollHeight ?? 0
  const previousScrollTop = viewport?.scrollTop ?? 0
  const merged = new Map()

  nextEvents.forEach((item) => merged.set(eventKey(item), item))
  events.value.forEach((item) => merged.set(eventKey(item), item))

  events.value = Array.from(merged.values()).sort(sortEvents)
  updateLoadedSequenceState()

  window.requestAnimationFrame(() => {
    const element = logViewport.value

    if (!element) {
      return
    }

    const scrollDelta = element.scrollHeight - previousScrollHeight
    element.scrollTop = previousScrollTop + scrollDelta
  })
}

function isLogNearBottom() {
  const element = logViewport.value

  if (!element) {
    return true
  }

  return element.scrollHeight - element.scrollTop - element.clientHeight < 48
}

function syncLogScroll(force = false) {
  window.requestAnimationFrame(() => {
    const element = logViewport.value

    if (!element) {
      return
    }

    if (force || isLogNearBottom()) {
      element.scrollTop = element.scrollHeight
    }
  })
}

function updateStreamOffset(payload, incomingEvents) {
  const seqList = incomingEvents
    .map((item) => Number(item?.seq))
    .filter((item) => Number.isFinite(item))
  const payloadNextOffset = Number(firstDefined(payload?.nextOffset, payload?.next_offset))
  const lastEventSeq = Number(payload?.progress?.last_event_seq)
  const latestSeq = Number(latestLoadedSeq.value)

  if (Number.isFinite(payloadNextOffset)) {
    seqList.push(payloadNextOffset)
  }

  if (Number.isFinite(lastEventSeq)) {
    seqList.push(lastEventSeq)
  }

  if (Number.isFinite(latestSeq)) {
    seqList.push(latestSeq)
  }

  if (seqList.length > 0) {
    streamOffset.value = Math.max(streamOffset.value, Math.max(...seqList))
  }
}

function updateOlderLogsOffset(payload, normalizedEvents) {
  if (payload?.has_more === false) {
    olderLogsOffset.value = null
    return
  }

  const nextFromPayload = Number(payload?.next_offset)

  if (Number.isFinite(nextFromPayload) && nextFromPayload > 0) {
    olderLogsOffset.value = nextFromPayload
    return
  }

  const seqList = normalizedEvents.map((item) => item.seq).filter((item) => Number.isFinite(item))

  if (seqList.length === 0) {
    olderLogsOffset.value = null
    return
  }

  const earliestSeq = Math.min(...seqList)
  olderLogsOffset.value = earliestSeq > 1 ? earliestSeq : null
}

function updateTaskAndProgress(payload) {
  if (payload?.task && typeof payload.task === 'object') {
    task.value = {
      ...(task.value ?? {}),
      ...payload.task
    }
  }

  if (payload?.progress && typeof payload.progress === 'object') {
    progress.value = {
      ...(progress.value ?? {}),
      ...payload.progress
    }
  }

  syncActionStatusOverride()
}

function resolveStreamOffset() {
  const candidates = [
    Number(progress.value?.last_event_seq),
    Number(streamOffset.value),
    Number(latestLoadedSeq.value)
  ].filter((item) => Number.isFinite(item))

  if (candidates.length === 0) {
    return 0
  }

  return Math.max(0, Math.max(...candidates))
}

function resolveOlderLogOffset() {
  const offset = Number(olderLogsOffset.value)

  if (!Number.isFinite(offset) || offset <= 1) {
    return null
  }

  return offset
}

function inferHasOlderLogs(payload, requestedOffset, normalizedEvents) {
  if (typeof payload?.has_more === 'boolean') {
    return payload.has_more
  }

  if (normalizedEvents.length === 0) {
    return requestedOffset > 1
  }

  const seqList = normalizedEvents.map((item) => item.seq).filter((item) => Number.isFinite(item))

  if (seqList.length === 0) {
    return requestedOffset > 1 && normalizedEvents.length >= LOG_PAGE_SIZE
  }

  return Math.min(...seqList) > 1
}

async function fetchLogsChunk(offset, limit = LOG_PAGE_SIZE, direction = '') {
  const data = await getScanTaskLogs(taskId.value, offset, limit, direction)

  updateTaskAndProgress(data)

  return {
    payload: data,
    events: extractEvents(data).map((item) => normalizeLogEvent(item)).filter(Boolean)
  }
}

async function hydrateLiveLogs() {
  if (!taskId.value) {
    return
  }

  streamError.value = ''

  try {
    const { payload, events: chunkEvents } = await fetchLogsChunk(0, LIVE_LOG_PRELOAD_SIZE, 'before')

    replaceEvents(chunkEvents, { stickToBottom: true })
    updateOlderLogsOffset(payload, chunkEvents)
    updateStreamOffset(payload, chunkEvents)
  } catch (error) {
    streamError.value = error instanceof Error ? error.message : '获取扫描日志失败。'
  } finally {
    isLoading.value = false
  }
}

async function restoreLiveHistory() {
  if (!taskId.value || isTaskInactive.value || isRestoringLiveHistory.value) {
    return
  }

  if (!hasOlderLogs.value) {
    return
  }

  const restoreId = ++liveHistoryRestoreId
  let offset = resolveOlderLogOffset()

  if (offset === null) {
    return
  }

  isRestoringLiveHistory.value = true

  try {
    while (restoreId === liveHistoryRestoreId && taskId.value && !isTaskInactive.value && offset !== null) {
      const { payload, events: chunkEvents } = await fetchLogsChunk(offset, LIVE_LOG_RESTORE_PAGE_SIZE, 'before')

      if (restoreId !== liveHistoryRestoreId) {
        return
      }

      prependEvents(chunkEvents)
      updateOlderLogsOffset(payload, chunkEvents)
      updateStreamOffset(payload, chunkEvents)
      hasOlderLogs.value = inferHasOlderLogs(payload, offset, chunkEvents)

      const nextOlderOffset = resolveOlderLogOffset()

      if (!hasOlderLogs.value || nextOlderOffset === null || nextOlderOffset === offset) {
        break
      }

      offset = nextOlderOffset
    }
  } finally {
    if (restoreId === liveHistoryRestoreId) {
      isRestoringLiveHistory.value = false
    }
  }
}

async function hydrateCompletedLogs() {
  if (!taskId.value || isHydratingCompletedLogs.value) {
    return
  }

  isHydratingCompletedLogs.value = true
  streamError.value = ''
  logMode.value = 'paged'

  try {
    const offset = 0
    const { payload, events: chunkEvents } = await fetchLogsChunk(offset, LOG_PAGE_SIZE, 'before')
    const shouldKeepLiveEvents = chunkEvents.length === 0 && events.value.length > 0
    const visibleEvents = shouldKeepLiveEvents ? events.value : chunkEvents

    if (!shouldKeepLiveEvents) {
      replaceEvents(chunkEvents, { stickToBottom: true })
    }

    updateOlderLogsOffset(payload, visibleEvents)
    updateStreamOffset(payload, visibleEvents)
    hasOlderLogs.value = inferHasOlderLogs(payload, offset, visibleEvents)
  } catch (error) {
    streamError.value = error instanceof Error ? error.message : '获取扫描日志失败。'
  } finally {
    isHydratingCompletedLogs.value = false
    isLoading.value = false
  }
}

async function loadOlderLogs() {
  if (isLoadingOlderLogs.value || !hasOlderLogs.value || !taskId.value) {
    return
  }

  const offset = resolveOlderLogOffset()

  if (offset === null) {
    hasOlderLogs.value = false
    return
  }

  isLoadingOlderLogs.value = true

  try {
    const { payload, events: chunkEvents } = await fetchLogsChunk(offset, LOG_PAGE_SIZE, 'before')
    prependEvents(chunkEvents)
    updateOlderLogsOffset(payload, chunkEvents)
    updateStreamOffset(payload, chunkEvents)
    hasOlderLogs.value = inferHasOlderLogs(payload, offset, chunkEvents)
  } catch (error) {
    streamError.value = error instanceof Error ? error.message : '加载更早日志失败。'
  } finally {
    isLoadingOlderLogs.value = false
  }
}

function handleLogScroll() {
  if (logMode.value !== 'paged' || isLoadingOlderLogs.value || isHydratingCompletedLogs.value) {
    return
  }

  const element = logViewport.value

  if (!element) {
    return
  }

  if (element.scrollTop <= LOG_SCROLL_PRELOAD_THRESHOLD) {
    void loadOlderLogs()
  }
}

function applyPayload(payload, { replaceEvents = false, complete = false } = {}) {
  updateTaskAndProgress(payload)

  if (complete) {
    const finalStatus =
      [
        payload?.progress?.finished_status,
        payload?.task?.status,
        progress.value?.finished_status,
        task.value?.status
      ]
        .map((status) => normalizeStatusValue(status))
        .find((status) => status === 'paused' || isTerminalStatus(status)) ?? 'success'

    task.value = {
      ...(task.value ?? {}),
      status: finalStatus
    }

    progress.value = {
      ...(progress.value ?? {}),
      finished: true,
      finished_status: finalStatus
    }
  }

  const incomingEvents = extractEvents(payload)
  mergeEvents(incomingEvents, replaceEvents)
  updateStreamOffset(payload, incomingEvents)
  isLoading.value = false
}

async function requestTaskSummary({ silent = false } = {}) {
  const currentRequestId = ++currentTaskRequestId

  fetchController?.abort()
  fetchController = new AbortController()
  if (!silent) {
    pageError.value = ''
    isRefreshing.value = true
  }

  try {
    const data = await getScanTask(taskId.value, fetchController.signal)

    if (currentRequestId !== currentTaskRequestId) {
      return
    }

    applyPayload(data)

    if (isTaskInactive.value && logMode.value === 'paged' && !isHydratingCompletedLogs.value) {
      void hydrateCompletedLogs()
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    if (!silent) {
      pageError.value = error instanceof Error ? error.message : '获取扫描任务详情失败。'
      isLoading.value = false
    }
  } finally {
    if (!silent && currentRequestId === currentTaskRequestId) {
      isRefreshing.value = false
    }
  }
}

async function fetchTaskSummary() {
  await requestTaskSummary()
}

async function handleCancelTask() {
  if (!taskId.value || isCancelling.value || !canCancelTask.value) {
    return
  }

  isCancelling.value = true
  pageError.value = ''

  try {
    const result = await cancelScanTask(taskId.value)

    if (result?.status === 'cancelled') {
      task.value = {
        ...(task.value ?? {}),
        status: 'cancelled'
      }
    }

    await requestTaskSummary({ silent: true })
  } catch (error) {
    pageError.value = error instanceof Error ? error.message : '停止扫描任务失败，请稍后重试。'
  } finally {
    isCancelling.value = false
  }
}

async function handlePauseToggle() {
  if (!taskId.value || isPauseActionLoading.value) {
    return
  }

  const shouldResume = canResumeTask.value
  const previousOverride = actionStatusOverride.value

  actionStatusOverride.value = shouldResume ? 'pending' : 'paused'
  isPauseActionLoading.value = true
  pageError.value = ''

  try {
    if (shouldResume) {
      await resumeScanTask(taskId.value)
      actionStatusOverride.value = 'pending'
      streamError.value = ''
      streamState.value = 'idle'
      logMode.value = 'live'
      openStream(resolveStreamOffset())
      void requestTaskSummary({ silent: true })
      return
    }

    await pauseScanTask(taskId.value)
    streamError.value = ''
  } catch (error) {
    actionStatusOverride.value = previousOverride
    pageError.value = error instanceof Error ? error.message : shouldResume ? '继续扫描任务失败，请稍后重试。' : '暂停扫描任务失败，请稍后重试。'

    if (!isTaskInactive.value && !eventSource) {
      openStream(resolveStreamOffset())
    }
  } finally {
    isPauseActionLoading.value = false
  }
}

function scheduleReconnect() {
  if (reconnectTimer || isTaskInactive.value) {
    return
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    openStream()
  }, STREAM_RETRY_DELAY)
}

function closeStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function stopDurationTicker() {
  if (durationTimer) {
    window.clearInterval(durationTimer)
    durationTimer = null
  }
}

function stopSummaryPolling() {
  if (summaryPollTimer) {
    window.clearInterval(summaryPollTimer)
    summaryPollTimer = null
  }
}

function startDurationTicker() {
  stopDurationTicker()
  durationTimer = window.setInterval(() => {
    nowTick.value = Date.now()
  }, 1000)
}

function startSummaryPolling() {
  stopSummaryPolling()

  if (!taskId.value || isTaskInactive.value) {
    return
  }

  summaryPollTimer = window.setInterval(() => {
    if (isInitializing.value || isHydratingCompletedLogs.value) {
      return
    }

    void requestTaskSummary({ silent: true })
  }, SUMMARY_POLL_INTERVAL)
}

function parseStreamMessage(event) {
  try {
    return JSON.parse(event.data)
  } catch {
    return null
  }
}

function handleStreamEnvelope(event, options = {}) {
  const payload = parseStreamMessage(event)

  if (!payload) {
    return
  }

  applyPayload(payload, options)
}

function openStream(initialOffset = streamOffset.value) {
  if (!taskId.value || isTaskInactive.value) {
    return
  }

  closeStream()
  streamError.value = ''
  streamState.value = 'connecting'
  logMode.value = 'live'

  const source = createScanTaskStream(taskId.value, initialOffset)
  eventSource = source

  source.onopen = () => {
    if (eventSource !== source) {
      return
    }

    streamState.value = 'connected'
    streamError.value = ''
  }

  source.addEventListener('snapshot', (event) => {
    if (eventSource !== source) {
      return
    }

    const payload = parseStreamMessage(event)

    if (!payload) {
      return
    }

    const hasHydratedLiveTail = logMode.value === 'live' && events.value.length > 0

    if (hasHydratedLiveTail) {
      updateTaskAndProgress(payload)
      updateStreamOffset(payload, extractEvents(payload))
      return
    }

    applyPayload(payload, { replaceEvents: true })
  })

  source.addEventListener('event', (event) => {
    if (eventSource !== source) {
      return
    }

    handleStreamEnvelope(event)
  })

  source.addEventListener('complete', (event) => {
    if (eventSource !== source) {
      return
    }

    handleStreamEnvelope(event, { complete: true })
    streamState.value = 'complete'
    streamError.value = ''
    closeStream()
    void hydrateCompletedLogs()
  })

  source.onerror = () => {
    if (eventSource !== source) {
      return
    }

    closeStream()

    if (isTaskInactive.value) {
      streamState.value = 'complete'
      return
    }

    streamState.value = 'reconnecting'
    streamError.value = '实时订阅连接中断，正在自动重连。'
    scheduleReconnect()
  }
}

function resetState() {
  liveHistoryRestoreId += 1
  currentTaskRequestId += 1
  fetchController?.abort()
  fetchController = null
  closeStream()
  stopSummaryPolling()

  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  task.value = null
  progress.value = null
  events.value = []
  pageError.value = ''
  streamError.value = ''
  isLoading.value = true
  isRefreshing.value = false
  isCancelling.value = false
  isPauseActionLoading.value = false
  streamOffset.value = 0
  olderLogsOffset.value = null
  isInitializing.value = false
  streamState.value = 'idle'
  logMode.value = 'live'
  isLoadingOlderLogs.value = false
  isHydratingCompletedLogs.value = false
  isRestoringLiveHistory.value = false
  hasOlderLogs.value = false
  earliestLoadedSeq.value = null
  latestLoadedSeq.value = null
  actionStatusOverride.value = ''
}

async function initializePage() {
  resetState()

  if (!taskId.value) {
    pageError.value = '任务 ID 无效，无法打开任务详情。'
    isLoading.value = false
    return
  }

  isInitializing.value = true

  try {
    await fetchTaskSummary()

    if (!pageError.value) {
      if (isTaskInactive.value) {
        if (!isHydratingCompletedLogs.value) {
          await hydrateCompletedLogs()
        }
      } else {
        await hydrateLiveLogs()
        openStream(resolveStreamOffset())
        void restoreLiveHistory()
      }
    }
  } finally {
    isInitializing.value = false
  }
}

function reconnectStream() {
  streamError.value = ''

  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  openStream()
}

watch(
  taskId,
  () => {
    initializePage()
  },
  { immediate: true }
)

watch([isTaskFinished, isTaskPaused], ([finished, paused]) => {
  if (finished) {
    stopDurationTicker()
    stopSummaryPolling()

    if (streamState.value !== 'complete') {
      streamState.value = 'complete'
    }

    closeStream()
    if (!isInitializing.value && logMode.value !== 'paged') {
      void hydrateCompletedLogs()
    }
    return
  }

  if (paused) {
    stopDurationTicker()
    stopSummaryPolling()
    closeStream()
    streamState.value = 'paused'

    if (!isInitializing.value && logMode.value !== 'paged') {
      void hydrateCompletedLogs()
    }
    return
  }

  startDurationTicker()
  startSummaryPolling()

  if (!isInitializing.value && !eventSource && !isPauseActionLoading.value) {
    openStream(resolveStreamOffset())
  }
}, { immediate: true })

onBeforeUnmount(() => {
  resetState()
  stopDurationTicker()
})
</script>

<template>
  <main class="scan-task-detail-page">
    <section class="scan-task-detail-hero">
      <div class="scan-task-detail-copy">
        <div class="scan-task-detail-kicker">实时扫描任务面板</div>
        <h1>{{ taskTitle }}</h1>
        <p>{{ taskSubtitle }}</p>

        <div class="scan-task-detail-meta">
          <span class="scan-task-detail-status" :class="`is-${taskStatusMeta.tone}`">
            {{ taskStatusMeta.label }}
          </span>
          <span class="scan-task-detail-chip">任务号：{{ task?.task_no || taskId }}</span>
          <span class="scan-task-detail-chip">创建人：{{ task?.created_by || '--' }}</span>
          <span class="scan-task-detail-chip is-accent">扫描策略：{{ scanStrategyLabel }}</span>
        </div>
      </div>

      <div class="scan-task-detail-actions">
        <button class="scan-task-detail-ghost-button" type="button" @click="props.navigateTo('/scans')">
          返回任务列表
        </button>
        <button class="scan-task-detail-primary-button" type="button" :disabled="isRefreshing" @click="fetchTaskSummary">
          {{ isRefreshing ? '刷新中...' : '刷新详情' }}
        </button>
        <button
          v-if="showPauseToggleButton"
          class="scan-task-detail-toggle-button"
          :class="{ 'is-paused': canResumeTask }"
          type="button"
          :disabled="isPauseActionLoading"
          :aria-label="pauseToggleAriaLabel"
          @click="handlePauseToggle"
        >
          <svg v-if="canResumeTask" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 7.2v9.6c0 .73.81 1.18 1.44.8l7.2-4.8a.94.94 0 0 0 0-1.6l-7.2-4.8A.94.94 0 0 0 9 7.2Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="6.8" />
          </svg>
        </button>
        <button
          v-if="canCancelTask"
          class="scan-task-detail-danger-button"
          type="button"
          :disabled="isCancelling"
          :aria-label="isCancelling ? '正在停止扫描任务' : '停止扫描任务'"
          @click="handleCancelTask"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="7" y="7" width="10" height="10" rx="1.8" />
          </svg>
        </button>
      </div>
    </section>

    <section class="scan-task-detail-progress-grid">
      <article
        v-for="card in progressCards"
        :key="card.label"
        class="scan-task-detail-progress-card"
        :class="`is-${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
      </article>
    </section>

    <section v-if="pageError" class="scan-task-detail-notice is-error">
      <strong>任务详情加载失败</strong>
      <span>{{ pageError }}</span>
    </section>

    <section v-else class="scan-task-detail-grid">
      <article class="scan-task-detail-panel scan-task-detail-logs-panel">
        <header class="scan-task-detail-panel-head">
          <div>
            <h2>扫描日志</h2>
          </div>

          <div class="scan-task-detail-panel-actions">
            <span class="scan-task-detail-stream-badge" :class="`is-${streamStatusMeta.tone}`">
              {{ streamStatusMeta.label }}
            </span>
            <button
              v-if="showReconnectButton"
              class="scan-task-detail-inline-button"
              type="button"
              @click="reconnectStream"
            >
              重新连接
            </button>
          </div>
        </header>

        <div v-if="streamError" class="scan-task-detail-stream-tip is-warning">
          {{ streamError }}
        </div>

        <div ref="logViewport" class="scan-task-detail-log-viewport" @scroll="handleLogScroll">
          <div v-if="showLoadOlderHint" class="scan-task-detail-log-loader">
            <span v-if="isLoadingOlderLogs">正在加载更早日志...</span>
            <span v-else>向上滚动加载更早日志</span>
          </div>

          <div v-if="isLoading" class="scan-task-detail-empty-state">
            <strong>正在连接任务流...</strong>
            <span>先获取当前任务快照，再建立实时日志订阅。</span>
          </div>

          <div v-else-if="isHydratingCompletedLogs" class="scan-task-detail-empty-state is-compact">
            <strong>正在整理最终日志...</strong>
            <span>请稍候。</span>
          </div>

          <div v-else-if="events.length === 0" class="scan-task-detail-empty-state">
            <strong>暂时还没有日志输出</strong>
            <span>任务开始执行后，这里会按事件序号持续追加扫描日志。</span>
          </div>

          <article
            v-for="item in events"
            v-else
            :key="eventKey(item)"
            class="scan-task-detail-log-row"
            :class="logRowClasses(item)"
          >
            <div class="scan-task-detail-log-meta">
              <span class="scan-task-detail-log-seq">#{{ item.seq ?? '--' }}</span>
              <span class="scan-task-detail-log-level">{{ LOG_LEVEL_LABELS[item.level] || item.level }}</span>
              <time>{{ formatDateTime(item.time) }}</time>
            </div>
            <p>{{ item.message || '无消息内容' }}</p>
          </article>
        </div>
      </article>

      <article class="scan-task-detail-panel scan-task-detail-summary-panel">
        <header class="scan-task-detail-panel-head">
          <div>
            <h2>任务基本信息</h2>
          </div>
        </header>

        <div class="scan-task-detail-info-list">
          <div
            v-for="item in infoItems"
            :key="item.label"
            class="scan-task-detail-info-row"
            :class="[{ 'is-emphasis': item.emphasis }, item.tone ? `is-${item.tone}` : '']"
          >
            <span class="scan-task-detail-info-label">
              <span>{{ item.label }}</span>
              <span
                v-if="item.tooltip"
                class="scan-create-field-tooltip-anchor"
                tabindex="0"
                aria-label="查看字段说明"
              >
                <span class="scan-create-field-tooltip-icon">?</span>
                <span class="scan-create-field-tooltip" role="tooltip">
                  {{ item.tooltip }}
                </span>
              </span>
            </span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </article>
    </section>
  </main>
</template>
