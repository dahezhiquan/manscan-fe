<template>
  <main class="vuln-page">
    <section class="vulnerabilities-hero">
      <div>
        <span class="vulnerabilities-kicker">VULNERABILITIES</span>
        <h1>漏洞查询</h1>
        <div class="vulnerabilities-hero-meta">
          <span class="vulnerabilities-hero-chip">总数 {{ formatVulnerabilityCount(total) }}</span>
        </div>
      </div>

      <div class="vulnerabilities-hero-actions">
        <button
          v-if="hasFilters"
          class="vulnerabilities-clear-button"
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

        <button
          class="vulnerabilities-icon-button"
          type="button"
          :disabled="isLoading || isRefreshing"
          :aria-busy="isRefreshing ? 'true' : 'false'"
          aria-label="刷新漏洞列表"
          @click="handleRefresh"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>
      </div>
    </section>

    <section class="vulnerabilities-content">
      <section ref="filtersRef" class="vulnerabilities-filter-panel" aria-label="漏洞筛选条件">
        <label class="vulnerabilities-search-field is-main">
          <input
            v-model="filterInput.searchQuery"
            type="text"
            placeholder="搜索漏洞名称或 Template ID..."
            aria-label="搜索漏洞名称或 Template ID"
            autocomplete="off"
          />
          <span class="vulnerabilities-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <label class="vulnerabilities-search-field is-host">
          <input
            v-model="filterInput.assetHost"
            type="text"
            placeholder="搜索 Asset Host..."
            aria-label="搜索 Asset Host"
            autocomplete="off"
          />
          <span class="vulnerabilities-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <div
          v-for="filter in filterMenus"
          :key="filter.key"
          class="vulnerabilities-filter-wrap"
        >
          <button
            class="vulnerabilities-filter-trigger"
            :class="{ active: isMenuOpen(filter.key) || getSelectedFilterCount(filter.key) > 0 }"
            type="button"
            @click.stop="toggleFilterMenu(filter.key)"
          >
            <span
              v-if="filter.icon"
              class="vulnerabilities-filter-trigger-icon"
              :class="`is-${filter.icon}`"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <template v-if="filter.icon === 'status'">
                  <path d="M12 4.5 18.5 7v5.2c0 4.1-2.7 6.5-6.5 7.3-3.8-.8-6.5-3.2-6.5-7.3V7L12 4.5Z" />
                  <path d="M9.2 12.2 11 14l3.8-4" />
                </template>
                <template v-else>
                  <path d="M12 4.5 19 18.5H5L12 4.5Z" />
                  <path d="M12 9.2v4.4" />
                  <path d="M12 16.4h.01" />
                </template>
              </svg>
            </span>
            <span>{{ getFilterButtonLabel(filter) }}</span>
            <span v-if="getSelectedFilterCount(filter.key) > 1" class="vulnerabilities-filter-count">
              {{ getSelectedFilterCount(filter.key) }}
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path :d="isMenuOpen(filter.key) ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen(filter.key)" class="vulnerabilities-filter-menu">
            <button
              v-for="option in filter.options"
              :key="option.value || `${filter.key}-all`"
              class="vulnerabilities-filter-option"
              :class="{ selected: isOptionSelected(filter.key, option.value) }"
              type="button"
              @click.stop="toggleEnumFilter(filter.key, option.value)"
            >
              <span
                class="vulnerabilities-filter-check"
                :class="{ selected: isOptionSelected(filter.key, option.value) }"
                aria-hidden="true"
              ></span>
              <span
                v-if="filter.key === 'severity'"
                class="vulnerabilities-filter-option-icon"
                :class="`is-${option.value || 'all'}`"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 4.8 18 7v4.8c0 3.8-2.5 6-6 6.8-3.5-.8-6-3-6-6.8V7l6-2.2Z" />
                </svg>
              </span>
              <span
                v-else-if="filter.key === 'status'"
                class="vulnerabilities-filter-option-icon"
                :class="`is-status-${option.value || 'all'}`"
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <template v-if="!option.value">
                    <path d="M4 7.5h16" />
                    <path d="M7 12h10" />
                    <path d="M10 16.5h4" />
                  </template>
                  <template v-else-if="option.value === 'unreviewed'">
                    <circle cx="12" cy="12" r="7.2" />
                    <path d="M12 8.2v4.4l2.8 1.7" />
                    <path d="M17.5 5.7 19 4.2" />
                  </template>
                  <template v-else-if="option.value === 'confirmed'">
                    <path d="M12 4.8 18 7v4.8c0 3.8-2.5 6-6 6.8-3.5-.8-6-3-6-6.8V7l6-2.2Z" />
                    <path d="m9.2 12.1 1.8 1.8 3.9-4.1" />
                  </template>
                  <template v-else-if="option.value === 'ticketed'">
                    <path d="M5.2 7.4a2 2 0 0 1 2-2h9.6a2 2 0 0 1 2 2v2.1a2.2 2.2 0 0 0 0 5v2.1a2 2 0 0 1-2 2H7.2a2 2 0 0 1-2-2v-2.1a2.2 2.2 0 0 0 0-5V7.4Z" />
                    <path d="M10 8.5h4" />
                    <path d="M10 12h4" />
                    <path d="M10 15.5h2.6" />
                  </template>
                  <template v-else-if="option.value === 'fixed'">
                    <path d="M14.2 5.2a4.2 4.2 0 0 0 4.6 5.4l-7.9 7.9a2.4 2.4 0 0 1-3.4-3.4l7.9-7.9a4.2 4.2 0 0 0-1.2-2Z" />
                    <path d="m15.4 14.2 1.5 1.5 3-3" />
                  </template>
                  <template v-else-if="option.value === 'false_positive'">
                    <path d="M7.2 5.6h9.6l3.2 3.2v6.4l-3.2 3.2H7.2L4 15.2V8.8l3.2-3.2Z" />
                    <path d="m9.2 9.2 5.6 5.6" />
                    <path d="m14.8 9.2-5.6 5.6" />
                  </template>
                  <template v-else-if="option.value === 'ignored'">
                    <path d="M4.5 12s2.8-5.2 7.5-5.2S19.5 12 19.5 12s-2.8 5.2-7.5 5.2S4.5 12 4.5 12Z" />
                    <path d="M9.8 12a2.2 2.2 0 0 0 2.2 2.2" />
                    <path d="M3.8 4.2 20.2 20.6" />
                  </template>
                  <template v-else>
                    <circle cx="12" cy="12" r="7.2" />
                    <path d="M12 8.8v3.7" />
                    <path d="M12 15.6h.01" />
                  </template>
                </svg>
              </span>
              <span class="vulnerabilities-filter-option-label">{{ option.label }}</span>
            </button>
          </div>
        </div>
      </section>

      <div v-if="showInlineError" class="vulnerabilities-page-notice is-error" aria-live="polite">
        <span>{{ pageError }}</span>
        <button type="button" @click="handleRefresh">重试</button>
      </div>

      <section class="vulnerabilities-list-card">
        <div v-if="showInitialLoading" class="vulnerabilities-loading-list" aria-hidden="true">
          <div v-for="index in 6" :key="index" class="vulnerabilities-loading-row">
            <span class="vulnerabilities-loading-pill"></span>
            <div class="vulnerabilities-loading-main">
              <span class="vulnerabilities-loading-line is-title"></span>
              <span class="vulnerabilities-loading-line"></span>
            </div>
            <span class="vulnerabilities-loading-chip"></span>
          </div>
        </div>

        <div v-else-if="showBlockingError" class="vulnerabilities-state-panel is-error">
          <h2>漏洞列表加载失败</h2>
          <p>{{ pageError }}</p>
          <button class="vulnerabilities-state-button" type="button" @click="handleRefresh">重新加载</button>
        </div>

        <div v-else-if="showEmptyState" class="vulnerabilities-state-panel">
          <h2>{{ hasFilters ? '没有匹配的漏洞' : '暂未发现漏洞' }}</h2>
          <p>{{ hasFilters ? '可以调整筛选条件后重试。' : '完成扫描后，命中的漏洞会出现在这里。' }}</p>
          <button
            v-if="hasFilters"
            class="vulnerabilities-state-button is-secondary"
            type="button"
            @click="clearFilters"
          >
            清空筛选
          </button>
        </div>

        <div v-else class="vulnerabilities-list">
          <article
            v-for="row in tableRows"
            :key="row.id"
            v-memo="[row.memoKey]"
            class="vulnerabilities-row"
          >
            <div class="vulnerabilities-row-main">
              <span
                class="vulnerabilities-severity-pill"
                :class="`is-${row.severityMeta.tone}`"
              >
                {{ row.severityMeta.label }}
              </span>

              <div class="vulnerabilities-title-block">
                <div class="vulnerabilities-title-line">
                  <h3>{{ row.name }}</h3>
                  <span v-if="row.protocol" class="vulnerabilities-protocol-tag">{{ row.protocol }}</span>
                  <span class="vulnerabilities-status-pill" :class="`is-${row.statusMeta.tone}`">
                    {{ row.statusMeta.label }}
                  </span>
                </div>

                <div class="vulnerabilities-asset-line">
                  <span class="vulnerabilities-asset-host">{{ row.assetHost }}</span>
                  <span class="vulnerabilities-muted-text">最近任务 {{ row.latestScanTaskName }}</span>
                  <span class="vulnerabilities-muted-text">发现时间 {{ row.lastFoundAtDisplay }}</span>
                </div>

                <div v-if="row.tags.length" class="vulnerabilities-tag-row">
                  <span v-for="tag in row.tags" :key="`${row.id}-${tag}`" class="vulnerabilities-tag">{{ tag }}</span>
                </div>
              </div>
            </div>

            <div class="vulnerabilities-template-id" :title="row.templateId">
              {{ row.templateId }}
            </div>
          </article>
        </div>

        <footer v-if="!showInitialLoading && !showBlockingError" class="vulnerabilities-pagination">
          <div class="vulnerabilities-page-size" @click.stop>
            <span>每页</span>
            <button
              class="vulnerabilities-page-size-trigger"
              :class="{ active: isPageSizeMenuOpen }"
              type="button"
              :disabled="isLoading || isRefreshing"
              aria-label="选择每页数量"
              @click="togglePageSizeMenu"
            >
              <span>{{ pageSize }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path :d="isPageSizeMenuOpen ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
              </svg>
            </button>

            <div v-if="isPageSizeMenuOpen" class="vulnerabilities-page-size-menu">
              <button
                v-for="item in VULNERABILITY_LIST_PAGE_SIZE_OPTIONS"
                :key="item"
                class="vulnerabilities-page-size-option"
                :class="{ selected: pageSize === item }"
                type="button"
                @click="selectPageSize(item)"
              >
                <span
                  class="vulnerabilities-page-size-check"
                  :class="{ selected: pageSize === item }"
                  aria-hidden="true"
                ></span>
                <span>{{ item }}</span>
              </button>
            </div>
          </div>

          <div class="vulnerabilities-pagination-meta">
            <span>显示 {{ pageStart }} - {{ pageEnd }}，共 {{ formatVulnerabilityCount(total) }} 条</span>
            <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
            <button
              class="vulnerabilities-pagination-arrow"
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
              class="vulnerabilities-pagination-arrow"
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

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getTemplateProtocols } from '../api/templates'
import { getVulnerabilityList } from '../api/vulnerabilities'
import {
  VULNERABILITY_LIST_PAGE_SIZE_OPTIONS,
  VULNERABILITY_LIST_SEARCH_DEBOUNCE,
  VULNERABILITY_PROTOCOL_OPTIONS,
  VULNERABILITY_SEVERITY_OPTIONS,
  VULNERABILITY_STATUS_OPTIONS,
  VULNERABILITY_TAG_OPTIONS
} from '../constants/vulnerabilities'
import {
  formatVulnerabilityCount,
  normalizeVulnerabilityListResponse
} from '../utils/vulnerability'
import { normalizeProtocolOptions } from '../utils/template'

const filtersRef = ref(null)
const filterInput = ref(createEmptyFilterInput())
const appliedFilters = ref(createEmptyAppliedFilters())
const activeFilterMenu = ref('')
const isPageSizeMenuOpen = ref(false)
const tableRows = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(VULNERABILITY_LIST_PAGE_SIZE_OPTIONS[0])
const totalPages = ref(1)
const pageError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const protocolOptions = ref(VULNERABILITY_PROTOCOL_OPTIONS)

let fetchController = null
let protocolOptionsController = null
let currentRequestId = 0
let filterTimer = null
let isSyncingFilters = false
const seenScanTaskNames = ref([])

const hasData = computed(() => tableRows.value.length > 0)
const hasFilters = computed(() => {
  const filters = appliedFilters.value

  return Boolean(
    filters.searchQuery ||
      filters.assetHost ||
      filters.statuses.length ||
      filters.tags.length ||
      filters.severities.length ||
      filters.latestScanTaskName ||
      filters.protocols.length
  )
})
const latestScanTaskOptions = computed(() => [
  { value: '', label: '全部任务' },
  ...seenScanTaskNames.value.map((name) => ({ value: name, label: name }))
])
const filterMenus = computed(() => [
  {
    key: 'severity',
    label: '风险等级',
    icon: 'severity',
    options: VULNERABILITY_SEVERITY_OPTIONS,
    multi: true
  },
  {
    key: 'status',
    label: '状态',
    icon: 'status',
    options: VULNERABILITY_STATUS_OPTIONS,
    multi: true
  },
  {
    key: 'tags',
    label: '标签',
    options: VULNERABILITY_TAG_OPTIONS,
    multi: true
  },
  {
    key: 'protocol',
    label: '协议',
    options: protocolOptions.value,
    multi: true
  },
  {
    key: 'latestScanTaskName',
    label: '扫描任务',
    options: latestScanTaskOptions.value,
    multi: false
  }
])
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

function createEmptyFilterInput() {
  return {
    searchQuery: '',
    assetHost: '',
    statuses: [],
    tags: [],
    severities: [],
    latestScanTaskName: '',
    protocols: []
  }
}

function createEmptyAppliedFilters() {
  return {
    searchQuery: '',
    assetHost: '',
    statuses: [],
    tags: [],
    severities: [],
    latestScanTaskName: '',
    protocols: []
  }
}

function buildAppliedFilters() {
  return {
    searchQuery: filterInput.value.searchQuery.trim(),
    assetHost: filterInput.value.assetHost.trim(),
    statuses: [...filterInput.value.statuses],
    tags: [...filterInput.value.tags],
    severities: [...filterInput.value.severities],
    latestScanTaskName: filterInput.value.latestScanTaskName.trim(),
    protocols: [...filterInput.value.protocols]
  }
}

function scheduleFilterCommit() {
  if (isSyncingFilters) {
    return
  }

  window.clearTimeout(filterTimer)

  filterTimer = window.setTimeout(() => {
    commitFilters()
  }, VULNERABILITY_LIST_SEARCH_DEBOUNCE)
}

function commitFilters() {
  const nextFilters = buildAppliedFilters()
  if (JSON.stringify(nextFilters) === JSON.stringify(appliedFilters.value)) {
    return
  }

  appliedFilters.value = nextFilters
  currentPage.value = 1
  void loadVulnerabilities()
}

function handleSelectFilterChange() {
  window.clearTimeout(filterTimer)
  commitFilters()
}

function isMenuOpen(name) {
  return activeFilterMenu.value === name
}

function toggleFilterMenu(name) {
  isPageSizeMenuOpen.value = false
  activeFilterMenu.value = activeFilterMenu.value === name ? '' : name
}

function closeFilterMenus() {
  activeFilterMenu.value = ''
}

function closePageSizeMenu() {
  isPageSizeMenuOpen.value = false
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenus()
  }

  closePageSizeMenu()
}

function toggleEnumFilter(key, value) {
  if (!value) {
    clearEnumFilter(key)
    return
  }

  if (key === 'latestScanTaskName') {
    filterInput.value.latestScanTaskName = value
    closeFilterMenus()
    handleSelectFilterChange()
    return
  }

  const fieldName = resolveMultiFilterFieldName(key)
  const currentValues = filterInput.value[fieldName]
  const nextValues = currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value]

  filterInput.value[fieldName] = nextValues
  handleSelectFilterChange()
}

function clearEnumFilter(key) {
  if (key === 'latestScanTaskName') {
    filterInput.value.latestScanTaskName = ''
  } else {
    filterInput.value[resolveMultiFilterFieldName(key)] = []
  }

  closeFilterMenus()
  handleSelectFilterChange()
}

function isOptionSelected(key, value) {
  if (!value) {
    return getSelectedFilterCount(key) === 0
  }

  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName === value
  }

  return filterInput.value[resolveMultiFilterFieldName(key)].includes(value)
}

function getSelectedFilterCount(key) {
  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName ? 1 : 0
  }

  return filterInput.value[resolveMultiFilterFieldName(key)].length
}

function getFilterButtonLabel(filter) {
  const selectedValues = getSelectedFilterValues(filter.key)

  if (!selectedValues.length) {
    return filter.label
  }

  if (selectedValues.length === 1) {
    return filter.options.find((item) => item.value === selectedValues[0])?.label ?? filter.label
  }

  return filter.label
}

function getSelectedFilterValues(key) {
  if (key === 'latestScanTaskName') {
    return filterInput.value.latestScanTaskName ? [filterInput.value.latestScanTaskName] : []
  }

  return filterInput.value[resolveMultiFilterFieldName(key)]
}

function resolveMultiFilterFieldName(key) {
  switch (key) {
    case 'severity':
      return 'severities'
    case 'status':
      return 'statuses'
    case 'protocol':
      return 'protocols'
    default:
      return key
  }
}

function rememberScanTaskOptions(rows) {
  const nextNames = new Set(seenScanTaskNames.value)

  rows.forEach((row) => {
    if (row.latestScanTaskName && row.latestScanTaskName !== '--') {
      nextNames.add(row.latestScanTaskName)
    }
  })

  seenScanTaskNames.value = [...nextNames].sort((first, second) => first.localeCompare(second, 'zh-CN'))
}

async function fetchProtocolOptions() {
  protocolOptionsController?.abort()
  protocolOptionsController = new AbortController()

  try {
    const data = await getTemplateProtocols(protocolOptionsController.signal)
    const normalized = normalizeProtocolOptions(data)

    if (normalized.length) {
      protocolOptions.value = [
        { value: '', label: '全部协议' },
        ...normalized
      ]
    }
  } catch (error) {
    if (error?.name !== 'AbortError') {
      protocolOptions.value = VULNERABILITY_PROTOCOL_OPTIONS
    }
  }
}

function clearFilters() {
  isSyncingFilters = true
  window.clearTimeout(filterTimer)
  filterInput.value = createEmptyFilterInput()
  appliedFilters.value = createEmptyAppliedFilters()
  currentPage.value = 1
  void loadVulnerabilities()
  window.setTimeout(() => {
    isSyncingFilters = false
  }, 0)
}

function handleRefresh() {
  void loadVulnerabilities({ forceLoading: !hasData.value })
}

function handlePageSizeChange() {
  currentPage.value = 1
  void loadVulnerabilities()
}

function togglePageSizeMenu() {
  if (isLoading.value || isRefreshing.value) {
    return
  }

  closeFilterMenus()
  isPageSizeMenuOpen.value = !isPageSizeMenuOpen.value
}

function selectPageSize(nextPageSize) {
  if (pageSize.value === nextPageSize) {
    closePageSizeMenu()
    return
  }

  pageSize.value = nextPageSize
  closePageSizeMenu()
  handlePageSizeChange()
}

function goToPreviousPage() {
  if (currentPage.value <= 1 || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value -= 1
  void loadVulnerabilities()
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value += 1
  void loadVulnerabilities()
}

function stopRequest() {
  if (fetchController) {
    fetchController.abort()
    fetchController = null
  }
}

async function loadVulnerabilities(options = {}) {
  const { forceLoading = false } = options

  stopRequest()

  const requestId = ++currentRequestId
  const controller = new AbortController()
  fetchController = controller

  if (forceLoading || !tableRows.value.length) {
    isLoading.value = true
  } else {
    isRefreshing.value = true
  }

  pageError.value = ''

  try {
    const filters = appliedFilters.value
    const data = await getVulnerabilityList(
      {
        page: currentPage.value,
        page_size: pageSize.value,
        keyword: filters.searchQuery,
        asset_host: filters.assetHost,
        status: filters.statuses,
        tags: filters.tags,
        severity: filters.severities,
        latest_scan_task_name: filters.latestScanTaskName,
        protocol: filters.protocols
      },
      controller.signal
    )

    if (requestId !== currentRequestId) {
      return
    }

    const normalized = normalizeVulnerabilityListResponse(data, currentPage.value, pageSize.value)
    tableRows.value = normalized.items
    rememberScanTaskOptions(normalized.items)
    total.value = normalized.total
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize
    totalPages.value = normalized.totalPages
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    pageError.value = error instanceof Error ? error.message : '漏洞列表加载失败，请稍后重试。'
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
      isRefreshing.value = false
      fetchController = null
    }
  }
}

watch(filterInput, scheduleFilterCommit, { deep: true })

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  void fetchProtocolOptions()
  void loadVulnerabilities({ forceLoading: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  protocolOptionsController?.abort()
  stopRequest()
  window.clearTimeout(filterTimer)
})
</script>
