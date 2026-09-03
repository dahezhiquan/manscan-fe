<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { deleteScanTasks, getScanTaskList, getScanTaskStats } from '../api/scans'
import {
  SCAN_LIST_PAGE_SIZE_OPTIONS,
  SCAN_LIST_POLL_INTERVAL,
  SCAN_LIST_SEARCH_DEBOUNCE,
  SCAN_TASK_BULK_DELETE_BATCH_SIZE,
  SCAN_TASK_DELETABLE_STATUSES,
  SCAN_TASK_SELECT_ALL_PAGE_SIZE,
  SCAN_SEVERITY_ORDER,
  SCAN_STATUS_META,
  SCAN_STATUS_OPTIONS
} from '../constants/scanTasks'
import { useSearchMagnetism } from '../composables/useSearchMagnetism'
import {
  formatCount,
  formatDateTime,
  isActiveScanStatus,
  normalizeScanTaskListResponse,
  severityLabel
} from '../utils/scanTask'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  }
})

const keywordInput = ref('')
const appliedKeyword = ref('')
const selectedStatus = ref('')
const hasHighRiskOnly = ref(false)
const activeFilterMenu = ref('')
const filtersRef = ref(null)
const selectedScanTaskIds = ref([])
const isSelectingAll = ref(false)
const selectionError = ref('')
const isBulkActionMenuOpen = ref(false)
const isBatchDeleteDialogOpen = ref(false)
const batchDeleteDialogRef = ref(null)
const batchDeleteSubmitting = ref(false)
const batchDeleteError = ref('')
const batchDeleteCompleted = ref(0)
const batchDeleteTotal = ref(0)
const tableRows = ref([])
const total = ref(null)
const currentPage = ref(1)
const pageSize = ref(SCAN_LIST_PAGE_SIZE_OPTIONS[0])
const totalPages = ref(1)
const pageError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const lastUpdatedAt = ref(null)
const summaryStats = ref({
  total: null,
  running: null,
  savedRequests: null
})
const { setup: setupSearchMagnetism } = useSearchMagnetism('.scans-search')

let fetchController = null
let selectAllController = null
let batchDeleteController = null
let currentRequestId = 0
let pollTimer = null
let keywordTimer = null
let isSyncingFilters = false

const activeTaskCount = computed(() => tableRows.value.filter((item) => isActiveScanStatus(item.status)).length)
const hasData = computed(() => tableRows.value.length > 0)
const hasFilters = computed(() => Boolean(appliedKeyword.value || selectedStatus.value || hasHighRiskOnly.value))
const selectedScanTaskIdSet = computed(() => new Set(selectedScanTaskIds.value))
const selectedScanTaskCount = computed(() => selectedScanTaskIds.value.length)
const currentPageSelectableIds = computed(() =>
  tableRows.value.filter((item) => canDeleteScanTask(item)).map((item) => item.id).filter(Boolean)
)
const isCurrentPageFullySelected = computed(() => {
  if (!currentPageSelectableIds.value.length) {
    return false
  }

  return currentPageSelectableIds.value.every((taskId) => selectedScanTaskIdSet.value.has(taskId))
})
const isBatchOperationSubmitting = computed(() => isSelectingAll.value || batchDeleteSubmitting.value)
const showInitialLoading = computed(() => isLoading.value && !hasData.value)
const showBlockingError = computed(() => Boolean(pageError.value) && !hasData.value && !isLoading.value)
const showInlineError = computed(() => Boolean(pageError.value) && hasData.value)
const showEmptyState = computed(() => !showInitialLoading.value && !showBlockingError.value && !hasData.value)
const totalTaskCount = computed(() => {
  if (summaryStats.value.total !== null && summaryStats.value.total !== undefined) {
    return summaryStats.value.total
  }

  return total.value
})
const runningTaskCount = computed(() => {
  if (summaryStats.value.running !== null && summaryStats.value.running !== undefined) {
    return summaryStats.value.running
  }

  return activeTaskCount.value
})
const savedRequestCount = computed(() => summaryStats.value.savedRequests)
const hasGlobalRunningTasks = computed(() => {
  if (summaryStats.value.running !== null && summaryStats.value.running !== undefined) {
    return summaryStats.value.running > 0
  }

  return activeTaskCount.value > 0
})
const pageStart = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return (currentPage.value - 1) * pageSize.value + 1
})
const pageEnd = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return Math.min(total.value, pageStart.value + tableRows.value.length - 1)
})
const shouldPoll = computed(() => hasGlobalRunningTasks.value)
const autoRefreshLabel = computed(() => (shouldPoll.value ? '运行中任务自动刷新中' : '当前无运行中任务'))
const lastUpdatedLabel = computed(() => (lastUpdatedAt.value ? formatDateTime(lastUpdatedAt.value) : '--'))
const statusButtonLabel = computed(() => formatFilterLabel('状态', SCAN_STATUS_OPTIONS, selectedStatus.value))
const batchDeleteProgressText = computed(() =>
  batchDeleteSubmitting.value ? `已删除 ${batchDeleteCompleted.value} / ${batchDeleteTotal.value} 个任务` : ''
)

function buildScanTaskListParams(page, pageSizeValue) {
  return {
    page,
    page_size: pageSizeValue,
    keyword: appliedKeyword.value,
    status: selectedStatus.value,
    has_high_risk: hasHighRiskOnly.value ? true : undefined
  }
}

function scheduleInputCommit() {
  if (isSyncingFilters) {
    return
  }

  const nextValue = keywordInput.value.trim()
  const currentValue = appliedKeyword.value

  if (nextValue === currentValue) {
    return
  }

  window.clearTimeout(keywordTimer)

  const timerId = window.setTimeout(() => {
    appliedKeyword.value = nextValue
    currentPage.value = 1
    void loadScanTasks()
  }, SCAN_LIST_SEARCH_DEBOUNCE)

  keywordTimer = timerId
}

function severityValue(row, key) {
  return row.severity[key] ?? 0
}

function canDeleteScanTask(row) {
  return Boolean(row?.id) && SCAN_TASK_DELETABLE_STATUSES.has(row.status)
}

function isScanTaskSelected(taskId) {
  return selectedScanTaskIdSet.value.has(taskId)
}

function mergeUniqueIds(currentIds, nextIds) {
  return [...new Set([...currentIds, ...nextIds].map((id) => String(id ?? '').trim()).filter(Boolean))]
}

function normalizeSelectedScanTaskIds(scanTaskIds) {
  return [
    ...new Set(
      scanTaskIds
        .map((id) => Number.parseInt(id, 10))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  ]
}

function chunkArray(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeScanTaskStats(payload) {
  return {
    total: normalizeSummaryNumber(payload?.total),
    running: normalizeSummaryNumber(payload?.running),
    savedRequests: normalizeSummaryNumber(payload?.saved_requests ?? payload?.savedRequests)
  }
}

function normalizeSummaryNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function formatFilterLabel(baseLabel, options, selectedValue) {
  if (!selectedValue) {
    return baseLabel
  }

  const selectedLabel = options.find((item) => item.value === selectedValue)?.label

  return selectedLabel ? `${baseLabel} · ${selectedLabel}` : baseLabel
}

function statusOptionTone(value) {
  if (!value) {
    return 'all'
  }

  return SCAN_STATUS_META[value]?.tone ?? 'all'
}

function isMenuOpen(name) {
  return activeFilterMenu.value === name
}

function toggleFilterMenu(name) {
  closeBatchActionMenu()
  activeFilterMenu.value = activeFilterMenu.value === name ? '' : name
}

function closeFilterMenus() {
  activeFilterMenu.value = ''
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenus()
    closeBatchActionMenu()
  }
}

function goToScanDetail(taskId) {
  if (!taskId) {
    return
  }

  const detailPath = `/scans/${encodeURIComponent(taskId)}`
  window.open(detailPath, '_blank', 'noopener,noreferrer')
}

function handleRowKeydown(event, taskId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    goToScanDetail(taskId)
  }
}

function handleStatusChange() {
  currentPage.value = 1
  closeFilterMenus()
  void loadScanTasks()
}

function toggleHighRiskFilter() {
  hasHighRiskOnly.value = !hasHighRiskOnly.value
  currentPage.value = 1
  void loadScanTasks()
}

function goToPreviousPage() {
  if (currentPage.value <= 1 || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value -= 1
  void loadScanTasks()
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value += 1
  void loadScanTasks()
}

function clearFilters() {
  isSyncingFilters = true
  window.clearTimeout(keywordTimer)
  closeFilterMenus()
  closeBatchActionMenu()
  keywordInput.value = ''
  appliedKeyword.value = ''
  selectedStatus.value = ''
  hasHighRiskOnly.value = false
  currentPage.value = 1
  clearScanTaskSelection()
  void loadScanTasks()
  window.setTimeout(() => {
    isSyncingFilters = false
  }, 0)
}

function handleRefresh() {
  void loadScanTasks({ forceLoading: !hasData.value })
}

function clearPolling() {
  if (pollTimer) {
    window.clearTimeout(pollTimer)
    pollTimer = null
  }
}

function toggleBatchActionMenu() {
  closeFilterMenus()
  isBulkActionMenuOpen.value = !isBulkActionMenuOpen.value
}

function closeBatchActionMenu() {
  isBulkActionMenuOpen.value = false
}

function toggleScanTaskSelection(taskId) {
  if (!taskId || isBatchOperationSubmitting.value) {
    return
  }

  const selectedSet = new Set(selectedScanTaskIds.value)

  if (selectedSet.has(taskId)) {
    selectedSet.delete(taskId)
  } else {
    selectedSet.add(taskId)
  }

  selectedScanTaskIds.value = [...selectedSet]
  selectionError.value = ''
}

function selectCurrentPageScanTasks() {
  if (!currentPageSelectableIds.value.length || isBatchOperationSubmitting.value) {
    return
  }

  selectedScanTaskIds.value = mergeUniqueIds(selectedScanTaskIds.value, currentPageSelectableIds.value)
  selectionError.value = ''
}

async function selectAllMatchingScanTasks() {
  if (isSelectingAll.value || batchDeleteSubmitting.value) {
    return
  }

  selectAllController?.abort()
  selectAllController = new AbortController()
  isSelectingAll.value = true
  selectionError.value = ''

  try {
    const allIds = []
    const seenPageSignatures = new Set()
    let nextPage = 1

    do {
      const currentPageSize = SCAN_TASK_SELECT_ALL_PAGE_SIZE
      const data = await getScanTaskList(
        buildScanTaskListParams(nextPage, currentPageSize),
        selectAllController.signal
      )
      const normalized = normalizeScanTaskListResponse(
        data,
        nextPage,
        currentPageSize
      )
      const pageSignature = normalized.items.map((item) => item.id).join('|')

      if (!pageSignature || seenPageSignatures.has(pageSignature)) {
        break
      }

      seenPageSignatures.add(pageSignature)

      allIds.push(
        ...normalized.items.filter((item) => canDeleteScanTask(item)).map((item) => item.id)
      )

      if (normalized.items.length < currentPageSize) {
        break
      }

      nextPage += 1
    } while (true)

    selectedScanTaskIds.value = mergeUniqueIds(selectedScanTaskIds.value, allIds)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      selectionError.value = error instanceof Error ? error.message : '全选扫描任务失败，请稍后重试。'
    }
  } finally {
    isSelectingAll.value = false
    selectAllController = null
  }
}

function clearScanTaskSelection() {
  selectAllController?.abort()
  selectedScanTaskIds.value = []
  selectionError.value = ''
  closeBatchActionMenu()
  closeBatchDeleteDialog()
}

function clearSelectionNotice() {
  selectionError.value = ''
}

function openBatchDeleteDialog() {
  if (!selectedScanTaskCount.value || isBatchOperationSubmitting.value) {
    return
  }

  closeBatchActionMenu()
  batchDeleteError.value = ''
  batchDeleteCompleted.value = 0
  batchDeleteTotal.value = selectedScanTaskCount.value
  isBatchDeleteDialogOpen.value = true
  void nextTick(() => {
    batchDeleteDialogRef.value?.focus()
  })
}

function closeBatchDeleteDialog() {
  if (batchDeleteSubmitting.value) {
    return
  }

  isBatchDeleteDialogOpen.value = false
  resetBatchDeleteDialogState()
}

function resetBatchDeleteDialogState() {
  batchDeleteError.value = ''
  batchDeleteCompleted.value = 0
  batchDeleteTotal.value = 0
}

async function submitBatchDelete() {
  if (!canSubmitBatchDelete.value) {
    return
  }

  const scanTaskIds = normalizeSelectedScanTaskIds(selectedScanTaskIds.value)
  if (!scanTaskIds.length) {
    batchDeleteError.value = '选中的任务 ID 无效，请刷新列表后重试。'
    return
  }

  if (scanTaskIds.length !== selectedScanTaskIds.value.length) {
    batchDeleteError.value = '选中的任务包含无效 ID，请刷新列表后重新选择。'
    return
  }

  const batches = chunkArray(scanTaskIds, SCAN_TASK_BULK_DELETE_BATCH_SIZE)
  batchDeleteController?.abort()
  batchDeleteController = new AbortController()
  batchDeleteSubmitting.value = true
  batchDeleteError.value = ''
  batchDeleteCompleted.value = 0
  batchDeleteTotal.value = scanTaskIds.length

  try {
    for (const batch of batches) {
      const result = await deleteScanTasks(batch, batchDeleteController.signal)
      batchDeleteCompleted.value += Number(result?.deleted_count ?? batch.length)
    }

    isBatchDeleteDialogOpen.value = false
    clearScanTaskSelection()
    await loadScanTasks()
  } catch (error) {
    if (error?.name !== 'AbortError') {
      batchDeleteError.value = error instanceof Error ? error.message : '批量删除扫描任务失败，请稍后重试。'
    }
  } finally {
    batchDeleteSubmitting.value = false
    batchDeleteController = null
    if (!isBatchDeleteDialogOpen.value) {
      resetBatchDeleteDialogState()
    }
  }
}

const canSubmitBatchDelete = computed(() => selectedScanTaskCount.value > 0 && !batchDeleteSubmitting.value)

async function refreshSummaryStats() {
  try {
    const data = await getScanTaskStats()
    summaryStats.value = normalizeScanTaskStats(data)
  } catch {
    // Keep the latest visible stats when a best-effort refresh fails.
  }
}

function stopRequest() {
  if (fetchController) {
    fetchController.abort()
    fetchController = null
  }
}

function schedulePolling() {
  clearPolling()

  if (!shouldPoll.value || pageError.value) {
    return
  }

  pollTimer = window.setTimeout(() => {
    void loadScanTasks({ silent: true })
  }, SCAN_LIST_POLL_INTERVAL)
}

async function loadScanTasks(options = {}) {
  const { silent = false, forceLoading = false } = options

  clearPolling()
  stopRequest()

  const requestId = ++currentRequestId
  const controller = new AbortController()
  fetchController = controller

  if (!silent) {
    if (forceLoading || !tableRows.value.length) {
      isLoading.value = true
    } else {
      isRefreshing.value = true
    }
  }

  pageError.value = ''

  try {
    const [listResult, statsResult] = await Promise.allSettled([
      getScanTaskList(buildScanTaskListParams(currentPage.value, pageSize.value), controller.signal),
      getScanTaskStats(controller.signal)
    ])

    if (requestId !== currentRequestId) {
      return
    }

    if (listResult.status !== 'fulfilled') {
      throw listResult.reason
    }

    if (statsResult.status === 'fulfilled') {
      summaryStats.value = normalizeScanTaskStats(statsResult.value)
    }

    const normalized = normalizeScanTaskListResponse(listResult.value, currentPage.value, pageSize.value)
    tableRows.value = normalized.items
    total.value = normalized.total
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize
    totalPages.value = normalized.totalPages
    lastUpdatedAt.value = Date.now()
    schedulePolling()
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    pageError.value = error instanceof Error ? error.message : '扫描任务列表加载失败，请稍后重试。'
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
      isRefreshing.value = false
      fetchController = null
    }
  }
}

watch(keywordInput, () => {
  scheduleInputCommit()
})

watch(shouldPoll, () => {
  schedulePolling()
})

watch(activeTaskCount, (nextValue, previousValue) => {
  if (previousValue > 0 && nextValue === 0) {
    void refreshSummaryStats()
  }
})

onMounted(() => {
  setupSearchMagnetism()
  document.addEventListener('click', handleDocumentClick)
  void loadScanTasks({ forceLoading: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  clearPolling()
  stopRequest()
  window.clearTimeout(keywordTimer)
  selectAllController?.abort()
  batchDeleteController?.abort()
})
</script>

<template>
  <main class="scans-page">
    <section class="scans-hero">
      <div class="scans-hero-copy">
        <span class="scans-kicker">SCAN TASKS</span>
        <h1>任务总览</h1>

        <div class="scans-hero-meta">
          <span class="scans-hero-chip">总任务 {{ formatCount(totalTaskCount) }}</span>
          <span class="scans-hero-chip is-running">运行中 {{ formatCount(runningTaskCount) }}</span>
          <span class="scans-hero-chip is-saved">
            <span>模版聚类/缓存算法已为您节省请求数量：</span>
            <strong>{{ formatCount(savedRequestCount) }}</strong>
            <span class="scans-chip-tooltip-anchor" tabindex="0" aria-label="查看模版聚类与缓存算法说明">
              <span class="scans-chip-tooltip-icon">?</span>
              <span class="scans-chip-tooltip" role="tooltip">
                <span>了解关于模版聚类/缓存算法的更多细节：</span>
                <a
                  href="https://duxiaoman.feishu.cn/wiki/X4gNwtseeiXV7Jkg8lHcapJ5nQd?fromScene=spaceOverview"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  文档
                </a>
              </span>
            </span>
          </span>
        </div>
      </div>

      <div class="scans-hero-actions">
        <button
          class="scans-toolbar-icon"
          type="button"
          :disabled="isLoading || isRefreshing"
          :aria-busy="isRefreshing ? 'true' : 'false'"
          aria-label="刷新扫描任务列表"
          @click="handleRefresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>

        <button class="scans-upgrade-button" type="button" @click="props.navigateTo('/scans/create')">
          <span>发起任务</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>
    </section>

    <section class="scans-content">
      <div ref="filtersRef" class="scans-toolbar">
        <label class="scans-search">
          <input
            v-model="keywordInput"
            type="text"
            placeholder="搜索任务名称"
            autocomplete="off"
          />
          <span class="scans-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <div class="scans-toolbar-actions">
          <div class="scans-filter-wrap">
            <button
              class="scans-filter-chip"
              :class="{ active: isMenuOpen('status') || selectedStatus }"
              type="button"
              @click.stop="toggleFilterMenu('status')"
            >
              <span>{{ statusButtonLabel }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path :d="isMenuOpen('status') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
              </svg>
            </button>

            <div v-if="isMenuOpen('status')" class="scans-filter-menu">
              <button
                v-for="item in SCAN_STATUS_OPTIONS"
                :key="item.value || 'all-status'"
                class="scans-filter-menu-item"
                :class="{ selected: selectedStatus === item.value }"
                type="button"
                @click.stop="selectedStatus = item.value; handleStatusChange()"
              >
                <span class="scans-filter-menu-check" :class="{ selected: selectedStatus === item.value }"></span>
                <span class="scans-filter-menu-icon" :class="`is-${statusOptionTone(item.value)}`" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <template v-if="!item.value">
                      <path d="M4 7.5h16" />
                      <path d="M7 12h10" />
                      <path d="M10 16.5h4" />
                    </template>
                    <template v-else-if="item.value === 'pending'">
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="M12 8.4v4.2l2.6 1.7" />
                    </template>
                    <template v-else-if="item.value === 'running'">
                      <path d="M12 4.8a7.2 7.2 0 1 1-5.1 2.1" />
                      <path d="M12 7.5v4.8l3.2 1.8" />
                    </template>
                    <template v-else-if="item.value === 'paused'">
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="m10.3 9.4 4.6 2.6-4.6 2.6z" fill="currentColor" stroke="none" />
                    </template>
                    <template v-else-if="item.value === 'success'">
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="m8.8 12.3 2.2 2.2 4.4-4.7" />
                    </template>
                    <template v-else-if="item.value === 'failed'">
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="m9.4 9.4 5.2 5.2" />
                      <path d="m14.6 9.4-5.2 5.2" />
                    </template>
                    <template v-else>
                      <circle cx="12" cy="12" r="7.2" />
                      <path d="M8.8 8.8 15.2 15.2" />
                    </template>
                  </svg>
                </span>
                <span class="scans-filter-menu-label">{{ item.label }}</span>
              </button>
            </div>
          </div>

          <button
            class="scans-filter-chip scans-risk-chip"
            :class="{ active: hasHighRiskOnly }"
            type="button"
            :aria-pressed="hasHighRiskOnly ? 'true' : 'false'"
            @click="toggleHighRiskFilter"
          >
            <span>严/高风险</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M12 4.8 19 18H5L12 4.8Z" />
              <path d="M12 9.4v4.6" />
              <path d="M12 16.8h.01" />
            </svg>
          </button>

          <button
            v-if="hasFilters"
            class="scans-clear-chip"
            type="button"
            aria-label="清空筛选"
            @click="clearFilters"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M15.8 8.2 8.2 15.8" />
              <path d="M8.2 8.2 15.8 15.8" />
              <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
            </svg>
          </button>

          <div
            v-if="selectedScanTaskCount > 0"
            class="scans-bulk-action-wrap vulnerabilities-bulk-action-wrap"
          >
            <button
              class="vulnerabilities-filter-trigger vulnerabilities-bulk-action-trigger"
              :class="{ active: isBulkActionMenuOpen }"
              type="button"
              @click.stop="toggleBatchActionMenu"
            >
              <span>批量操作</span>
              <span class="vulnerabilities-filter-count">{{ selectedScanTaskCount }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path :d="isBulkActionMenuOpen ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
              </svg>
            </button>

            <div
              v-if="isBulkActionMenuOpen"
              class="vulnerabilities-filter-menu vulnerabilities-bulk-action-menu"
            >
              <button
                class="vulnerabilities-bulk-action-option is-danger"
                type="button"
                @click.stop="openBatchDeleteDialog"
              >
                <span class="vulnerabilities-bulk-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4.5 7h15" />
                    <path d="M9 7V4.8h6V7" />
                    <path d="M6.5 7.2 7.4 19a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-11.8" />
                    <path d="M10 11v5.5" />
                    <path d="M14 11v5.5" />
                  </svg>
                </span>
                <span>批量删除</span>
              </button>
            </div>
          </div>

          <div
            v-if="tableRows.length"
            class="scans-selection-tools vulnerabilities-selection-tools"
          >
            <button
              class="scans-selection-tool vulnerabilities-selection-tool"
              type="button"
              :disabled="
                isLoading ||
                isRefreshing ||
                isBatchOperationSubmitting ||
                !currentPageSelectableIds.length ||
                isCurrentPageFullySelected
              "
              @click="selectCurrentPageScanTasks"
            >
              选中当前页
            </button>
            <button
              class="scans-selection-tool vulnerabilities-selection-tool"
              type="button"
              :disabled="isLoading || isRefreshing || isBatchOperationSubmitting || isSelectingAll"
              :aria-busy="isSelectingAll ? 'true' : 'false'"
              @click="selectAllMatchingScanTasks"
            >
              {{ isSelectingAll ? '全选中...' : '全选' }}
            </button>
            <button
              v-if="selectedScanTaskCount"
              class="vulnerabilities-clear-button"
              type="button"
              :disabled="isBatchOperationSubmitting"
              aria-label="清除选择"
              title="清除选择"
              @click="clearScanTaskSelection"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M15.8 8.2 8.2 15.8" />
                <path d="M8.2 8.2 15.8 15.8" />
                <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div v-if="showInlineError" class="scans-status-row" aria-live="polite">
        <p class="scans-page-notice is-error">
          <span>{{ pageError }}</span>
          <button type="button" @click="handleRefresh">重试</button>
        </p>
      </div>

      <div v-if="selectionError" class="scans-status-row" aria-live="polite">
        <p class="scans-page-notice is-error">
          <span>{{ selectionError }}</span>
          <button type="button" @click="clearSelectionNotice">关闭</button>
        </p>
      </div>

      <section class="scans-table-card">
        <div class="scans-table-scroll">
          <div class="scans-table-inner">
            <header class="scans-table-head">
              <div>选择</div>
              <div class="scans-head-name">任务名称</div>
              <div>状态</div>
              <div>风险分布</div>
              <div>目标数</div>
              <div>进度</div>
              <div>时长</div>
              <div>启动时间</div>
              <div>结束时间</div>
              <div>创建人</div>
            </header>

            <div v-if="showInitialLoading" class="scans-loading-list" aria-hidden="true">
              <div v-for="index in 6" :key="index" class="scans-loading-row">
                <div class="scans-loading-task">
                  <span class="scans-loading-pill"></span>
                  <span class="scans-loading-line is-title"></span>
                  <span class="scans-loading-line"></span>
                  <span class="scans-loading-line is-short"></span>
                </div>
                <div class="scans-loading-status"></div>
                <div class="scans-loading-severity">
                  <span v-for="severityKey in SCAN_SEVERITY_ORDER" :key="severityKey" class="scans-loading-severity-dot"></span>
                </div>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
                <span class="scans-loading-box"></span>
              </div>
            </div>

            <div v-else-if="showBlockingError" class="scans-state-panel is-error">
              <h2>任务列表加载失败</h2>
              <p>{{ pageError }}</p>
              <button class="scans-state-button" type="button" @click="handleRefresh">重新加载</button>
            </div>

            <div v-else-if="showEmptyState" class="scans-state-panel">
              <h2>{{ hasFilters ? '没有匹配的扫描任务' : '还没有扫描任务' }}</h2>
              <p>
                {{ hasFilters ? '可以调整关键字或筛选条件后重试。' : '现在可以直接发起一个新的扫描任务。' }}
              </p>
              <div class="scans-state-actions">
                <button v-if="hasFilters" class="scans-state-button is-secondary" type="button" @click="clearFilters">清空筛选</button>
                <button class="scans-state-button" type="button" @click="props.navigateTo('/scans/create')">发起任务</button>
              </div>
            </div>

            <div v-else class="scans-table-body">
              <article
                v-for="row in tableRows"
                :key="row.id"
                v-memo="[row.memoKey, isScanTaskSelected(row.id)]"
                class="scans-table-row"
                :class="{ selected: isScanTaskSelected(row.id) }"
                tabindex="0"
                role="button"
                @click="goToScanDetail(row.id)"
                @keydown="handleRowKeydown($event, row.id)"
              >
                <div class="scans-row-select-cell">
                  <button
                    class="vulnerabilities-row-select"
                    :class="{ selected: isScanTaskSelected(row.id) }"
                    type="button"
                    :disabled="!canDeleteScanTask(row) || isBatchOperationSubmitting"
                    role="checkbox"
                    :aria-checked="isScanTaskSelected(row.id)"
                    :aria-label="
                      canDeleteScanTask(row)
                        ? `${isScanTaskSelected(row.id) ? '取消选择' : '选择'}任务：${row.name}`
                        : `任务 ${row.name} 当前状态不可删除`
                    "
                    :title="
                      canDeleteScanTask(row)
                        ? isScanTaskSelected(row.id)
                          ? '取消选择任务'
                          : '选择任务'
                        : '仅成功、失败、已取消、已暂停的任务可删除'
                    "
                    @click.stop="toggleScanTaskSelection(row.id)"
                  >
                    <span aria-hidden="true"></span>
                  </button>
                </div>

                <div class="scans-name-cell">
                  <strong class="scan-name-text">{{ row.name }}</strong>
                </div>

                <div class="scans-status-cell">
                  <span class="scan-status-pill" :class="`is-${row.statusMeta.tone}`">{{ row.statusMeta.label }}</span>
                </div>

                <div class="scans-severity-cell">
                  <div class="scans-severity-group">
                    <span
                      v-for="severityKey in SCAN_SEVERITY_ORDER"
                      :key="severityKey"
                      class="scans-severity-badge"
                      :class="`is-${severityKey}`"
                    >
                      <span class="scans-severity-value">{{ severityValue(row, severityKey) }}</span>
                      <span class="scans-severity-tooltip" role="tooltip">{{ severityLabel(severityKey) }}</span>
                    </span>
                  </div>
                </div>

                <div class="scans-muted-cell">{{ row.targetCountDisplay }}</div>
                <div class="scans-muted-cell">{{ row.progressPercentDisplay }}</div>
                <div class="scans-muted-cell">{{ row.durationDisplay }}</div>
                <div class="scans-updated-cell">{{ row.startedAtDisplay }}</div>
                <div class="scans-updated-cell">{{ row.finishedAtDisplay }}</div>
                <div class="scans-muted-cell">{{ row.createdBy }}</div>
              </article>
            </div>
          </div>
        </div>

        <footer v-if="!showInitialLoading && !showBlockingError" class="scans-pagination">
          <div class="scans-pagination-meta">
            <span>显示 {{ pageStart }} - {{ pageEnd }}，共 {{ formatCount(total) }} 条</span>
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <button
              class="scans-pagination-arrow"
              type="button"
              :disabled="currentPage <= 1 || isLoading || isRefreshing"
              aria-label="上一页"
              @click="goToPreviousPage"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m14.5 6.5-5 5 5 5" />
              </svg>
            </button>
            <button
              class="scans-pagination-arrow"
              type="button"
              :disabled="currentPage >= totalPages || isLoading || isRefreshing"
              aria-label="下一页"
              @click="goToNextPage"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m9.5 6.5 5 5-5 5" />
              </svg>
            </button>
          </div>
        </footer>
      </section>
    </section>

    <div
      v-if="isBatchDeleteDialogOpen"
      class="vulnerability-delete-dialog-overlay"
      role="presentation"
      @click.self="closeBatchDeleteDialog"
    >
      <section
        ref="batchDeleteDialogRef"
        class="vulnerability-delete-dialog vulnerability-delete-dialog--danger"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-scan-delete-dialog-title"
        tabindex="-1"
        @keydown.esc="closeBatchDeleteDialog"
      >
        <header class="vulnerability-delete-dialog-header">
          <div>
            <h2 id="batch-scan-delete-dialog-title">批量删除扫描任务</h2>
            <p>已选择 {{ selectedScanTaskCount }} 个任务</p>
          </div>
          <button
            class="vulnerability-delete-dialog-close"
            type="button"
            :disabled="batchDeleteSubmitting"
            aria-label="关闭批量删除弹窗"
            @click="closeBatchDeleteDialog"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M6 6l12 12" />
              <path d="M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="vulnerability-delete-dialog-warning">
          <span class="vulnerability-delete-dialog-warning-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
              <path d="M12 8.2v5" />
              <path d="M12 17h.01" />
              <path d="M10.3 4.8h3.4L21 18.2a1.8 1.8 0 0 1-1.6 2.7H4.6A1.8 1.8 0 0 1 3 18.2L10.3 4.8Z" />
            </svg>
          </span>
          <div>
            <strong>删除后无法恢复。</strong>
            <p>仅已完成、已失败、已取消和已暂停的任务可删除。</p>
          </div>
        </div>

        <p v-if="batchDeleteProgressText" class="vulnerability-delete-dialog-progress">
          {{ batchDeleteProgressText }}
        </p>

        <p v-if="batchDeleteError" class="vulnerability-delete-dialog-error">
          {{ batchDeleteError }}
        </p>

        <footer class="vulnerability-delete-dialog-actions">
          <button
            class="template-detail-secondary-button"
            type="button"
            :disabled="batchDeleteSubmitting"
            @click="closeBatchDeleteDialog"
          >
            取消
          </button>
          <button
            class="template-detail-primary-button is-danger"
            type="button"
            :disabled="!canSubmitBatchDelete"
            @click="submitBatchDelete"
          >
            {{ batchDeleteSubmitting ? '删除中...' : '确认删除' }}
          </button>
        </footer>
      </section>
    </div>
  </main>
</template>
