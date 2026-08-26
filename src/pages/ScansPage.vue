<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getScanTaskList } from '../api/scans'
import {
  SCAN_LIST_PAGE_SIZE_OPTIONS,
  SCAN_LIST_POLL_INTERVAL,
  SCAN_LIST_SEARCH_DEBOUNCE,
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
const activeFilterMenu = ref('')
const filtersRef = ref(null)
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(SCAN_LIST_PAGE_SIZE_OPTIONS[0])
const totalPages = ref(1)
const pageError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const lastUpdatedAt = ref(null)
const { setup: setupSearchMagnetism } = useSearchMagnetism('.scans-search')

let fetchController = null
let currentRequestId = 0
let pollTimer = null
let keywordTimer = null
let isSyncingFilters = false

const activeTaskCount = computed(() => tableRows.value.filter((item) => isActiveScanStatus(item.status)).length)
const hasData = computed(() => tableRows.value.length > 0)
const hasFilters = computed(() => Boolean(appliedKeyword.value || selectedStatus.value))
const showInitialLoading = computed(() => isLoading.value && !hasData.value)
const showBlockingError = computed(() => Boolean(pageError.value) && !hasData.value && !isLoading.value)
const showInlineError = computed(() => Boolean(pageError.value) && hasData.value)
const showEmptyState = computed(() => !showInitialLoading.value && !showBlockingError.value && !hasData.value)
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
const shouldPoll = computed(() => activeTaskCount.value > 0)
const autoRefreshLabel = computed(() => (shouldPoll.value ? '运行中任务自动刷新中' : '当前页无运行中任务'))
const lastUpdatedLabel = computed(() => (lastUpdatedAt.value ? formatDateTime(lastUpdatedAt.value) : '--'))
const statusButtonLabel = computed(() => formatFilterLabel('状态', SCAN_STATUS_OPTIONS, selectedStatus.value))

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
  activeFilterMenu.value = activeFilterMenu.value === name ? '' : name
}

function closeFilterMenus() {
  activeFilterMenu.value = ''
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenus()
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
  keywordInput.value = ''
  appliedKeyword.value = ''
  selectedStatus.value = ''
  currentPage.value = 1
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
    const response = await getScanTaskList(
      {
        page: currentPage.value,
        page_size: pageSize.value,
        keyword: appliedKeyword.value,
        status: selectedStatus.value
      },
      controller.signal
    )

    if (requestId !== currentRequestId) {
      return
    }

    const normalized = normalizeScanTaskListResponse(response, currentPage.value, pageSize.value)
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
})
</script>

<template>
  <main class="scans-page">
    <section class="scans-hero">
      <div class="scans-hero-copy">
        <span class="scans-kicker">SCAN TASKS</span>
        <h1>任务总览</h1>

        <div class="scans-hero-meta">
          <span class="scans-hero-chip">总任务 {{ formatCount(total) }}</span>
          <span class="scans-hero-chip is-running">运行中 {{ activeTaskCount }}</span>
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
        </div>
      </div>

      <div v-if="showInlineError" class="scans-status-row" aria-live="polite">
        <p class="scans-page-notice is-error">
          <span>{{ pageError }}</span>
          <button type="button" @click="handleRefresh">重试</button>
        </p>
      </div>

      <section class="scans-table-card">
        <div class="scans-table-scroll">
          <div class="scans-table-inner">
            <header class="scans-table-head">
              <div>任务名称</div>
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
                v-memo="[row.memoKey]"
                class="scans-table-row"
                tabindex="0"
                role="button"
                @click="goToScanDetail(row.id)"
                @keydown="handleRowKeydown($event, row.id)"
              >
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
  </main>
</template>
