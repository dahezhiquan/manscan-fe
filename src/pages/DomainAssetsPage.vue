<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { getDomainAssetList } from '../api/domain-assets'
import AppShell from '../components/layout/AppShell.vue'
import {
  DOMAIN_ASSET_ALIVE_OPTIONS,
  DOMAIN_ASSET_FILTER_LABELS,
  DOMAIN_ASSET_FILTER_OPTIONS,
  DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS,
  DOMAIN_ASSET_RISK_OPTIONS,
  DOMAIN_ASSET_SEARCH_DEBOUNCE
} from '../constants/domainAssets'
import { sampleDomainAssets } from '../data/domain-assets'
import { normalizeDomainAssetListResponse } from '../utils/domainAsset'
import { formatCount } from '../utils/scanTask'
import { iconPath } from '../utils/icons'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/assets/domains'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-sidebar'])

const keywordInput = ref('')
const appliedKeyword = ref('')
const activeFilters = reactive(createEmptyFilters())
const isFilterDialogOpen = ref(false)
const filterDialogRef = ref(null)
const draftFilterKey = ref(DOMAIN_ASSET_FILTER_OPTIONS[0].key)
const draftFilterValue = ref('')
const includeSubOrganization = ref(true)
const draftError = ref('')
const tableRows = ref([])
const selectedDomainAssetId = ref('')
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS[0])
const totalPages = ref(1)
const isPageSizeMenuOpen = ref(false)
const pageError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)

let fetchController = null
let keywordTimer = null
let currentRequestId = 0
let isSyncingKeyword = false

const selectedDraftFilter = computed(
  () => DOMAIN_ASSET_FILTER_OPTIONS.find((item) => item.key === draftFilterKey.value) ?? DOMAIN_ASSET_FILTER_OPTIONS[0]
)
const selectedDraftOptions = computed(() => selectedDraftFilter.value.options ?? [])
const hasActiveFilterChips = computed(() => activeFilterChips.value.length > 0)
const hasFilters = computed(() => Boolean(appliedKeyword.value || hasActiveFilterChips.value))
const hasData = computed(() => tableRows.value.length > 0)
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
const pageSummary = computed(() => {
  if (!total.value) {
    return '暂无数据'
  }

  return `显示 ${pageStart.value} - ${pageEnd.value}，共 ${formatCount(total.value)} 条`
})
const activeFilterChips = computed(() =>
  Object.entries(activeFilters)
    .filter(([, value]) => String(value ?? '').trim() !== '')
    .map(([key, value]) => ({
      key,
      label: DOMAIN_ASSET_FILTER_LABELS[key] ?? key,
      valueLabel: formatFilterValue(key, value)
    }))
)
const dialogTitle = computed(() => (activeFilters[draftFilterKey.value] ? '编辑筛选条件' : '添加筛选条件'))
const canSaveDraft = computed(() => String(draftFilterValue.value ?? '').trim() !== '')

function createEmptyFilters() {
  return {
    organization: '',
    owner: '',
    scanTask: '',
    region: '',
    assetAddress: '',
    riskLevel: '',
    businessSystem: '',
    alive: ''
  }
}

function buildDomainAssetListParams() {
  return {
    page: currentPage.value,
    page_size: pageSize.value,
    keyword: appliedKeyword.value,
    organization: activeFilters.organization,
    include_sub_organization: activeFilters.organization ? includeSubOrganization.value : undefined,
    owner: activeFilters.owner,
    scan_task: activeFilters.scanTask,
    region: activeFilters.region,
    asset_address: activeFilters.assetAddress,
    risk_level: activeFilters.riskLevel,
    business_system: activeFilters.businessSystem,
    is_alive: activeFilters.alive
  }
}

function scheduleKeywordCommit() {
  if (isSyncingKeyword) {
    return
  }

  const nextKeyword = keywordInput.value.trim()
  if (nextKeyword === appliedKeyword.value) {
    return
  }

  window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(() => {
    appliedKeyword.value = nextKeyword
    currentPage.value = 1
    void loadDomainAssets()
  }, DOMAIN_ASSET_SEARCH_DEBOUNCE)
}

function openFilterDialog(filterKey = '') {
  const nextFilterKey = filterKey || DOMAIN_ASSET_FILTER_OPTIONS.find((item) => !activeFilters[item.key])?.key || DOMAIN_ASSET_FILTER_OPTIONS[0].key
  draftFilterKey.value = nextFilterKey
  draftFilterValue.value = activeFilters[nextFilterKey] || ''
  draftError.value = ''
  isFilterDialogOpen.value = true
  void nextTick(() => {
    filterDialogRef.value?.focus()
  })
}

function closeFilterDialog() {
  isFilterDialogOpen.value = false
  draftError.value = ''
}

function closePageSizeMenu() {
  isPageSizeMenuOpen.value = false
}

function handleDocumentClick() {
  closePageSizeMenu()
}

function handleDraftFilterKeyChange() {
  draftFilterValue.value = activeFilters[draftFilterKey.value] || ''
  draftError.value = ''
}

function saveDraftFilter() {
  const value = String(draftFilterValue.value ?? '').trim()

  if (!value) {
    draftError.value = `${selectedDraftFilter.value.label}不能为空`
    return
  }

  activeFilters[draftFilterKey.value] = value
  closeFilterDialog()
  closePageSizeMenu()
  currentPage.value = 1
  void loadDomainAssets()
}

function removeFilter(filterKey) {
  activeFilters[filterKey] = ''
  currentPage.value = 1
  void loadDomainAssets()
}

function clearFilters() {
  isSyncingKeyword = true
  window.clearTimeout(keywordTimer)
  keywordInput.value = ''
  appliedKeyword.value = ''
  Object.assign(activeFilters, createEmptyFilters())
  includeSubOrganization.value = true
  currentPage.value = 1
  closeFilterDialog()
  closePageSizeMenu()
  void loadDomainAssets()
  window.setTimeout(() => {
    isSyncingKeyword = false
  }, 0)
}

function handleRefresh() {
  void loadDomainAssets({ forceLoading: !hasData.value })
}

function goToPreviousPage() {
  if (currentPage.value <= 1 || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value -= 1
  void loadDomainAssets()
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value || isLoading.value || isRefreshing.value) {
    return
  }

  currentPage.value += 1
  void loadDomainAssets()
}

function handlePageSizeChange() {
  currentPage.value = 1
  void loadDomainAssets()
}

function togglePageSizeMenu() {
  if (isLoading.value || isRefreshing.value) {
    return
  }

  closeFilterDialog()
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

function selectDomainAsset(assetId) {
  selectedDomainAssetId.value = selectedDomainAssetId.value === assetId ? '' : assetId
}

function handleDomainAssetKeydown(event, assetId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectDomainAsset(assetId)
  }
}

function stopRequest() {
  fetchController?.abort()
  fetchController = null
}

async function loadDomainAssets(options = {}) {
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
    const data = await getDomainAssetList(buildDomainAssetListParams(), controller.signal)

    if (requestId !== currentRequestId) {
      return
    }

    const normalized = normalizeDomainAssetListResponse(data, currentPage.value, pageSize.value)
    tableRows.value = normalized.items
    syncSelectedDomainAsset()
    total.value = normalized.total
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize
    totalPages.value = normalized.totalPages
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }

    const normalized = buildSampleDomainAssetListResponse()
    tableRows.value = normalized.items
    syncSelectedDomainAsset()
    total.value = normalized.total
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize
    totalPages.value = normalized.totalPages
    pageError.value = ''
  } finally {
    if (requestId === currentRequestId) {
      isLoading.value = false
      isRefreshing.value = false
      fetchController = null
    }
  }
}

function buildSampleDomainAssetListResponse() {
  const params = buildDomainAssetListParams()
  const matchedItems = sampleDomainAssets.filter((item) => matchSampleDomainAsset(item, params))
  const normalizedPageSize = Math.max(1, Number(params.page_size) || DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS[0])
  const normalizedTotalPages = Math.max(1, Math.ceil(matchedItems.length / normalizedPageSize))
  const normalizedPage = Math.min(Math.max(1, Number(params.page) || 1), normalizedTotalPages)
  const start = (normalizedPage - 1) * normalizedPageSize

  return normalizeDomainAssetListResponse(
    {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: matchedItems.length,
      totalPages: normalizedTotalPages,
      items: matchedItems.slice(start, start + normalizedPageSize)
    },
    normalizedPage,
    normalizedPageSize
  )
}

function syncSelectedDomainAsset() {
  if (!selectedDomainAssetId.value) {
    return
  }

  const selectedStillVisible = tableRows.value.some((row) => row.id === selectedDomainAssetId.value)

  if (!selectedStillVisible) {
    selectedDomainAssetId.value = ''
  }
}

function matchSampleDomainAsset(item, params) {
  return (
    matchLooseText([item.domain, item.asset_address, item.title], params.keyword) &&
    matchOrganization(item, params.organization, params.include_sub_organization) &&
    matchLooseText([item.owner], params.owner) &&
    matchLooseText([item.scan_task], params.scan_task) &&
    matchLooseText([item.region], params.region) &&
    matchLooseText([item.domain, item.asset_address], params.asset_address) &&
    matchExactText(item.risk_level, params.risk_level) &&
    matchLooseText([item.business_system], params.business_system) &&
    matchAliveState(item.is_alive, params.is_alive)
  )
}

function matchOrganization(item, value, includeSubOrganizationValue) {
  if (!value) {
    return true
  }

  if (includeSubOrganizationValue === false) {
    return matchExactText(item.organization, value)
  }

  return matchLooseText([item.organization], value)
}

function matchLooseText(values, keyword) {
  const normalizedKeyword = normalizeSearchText(keyword)

  if (!normalizedKeyword) {
    return true
  }

  return values.some((value) => normalizeSearchText(value).includes(normalizedKeyword))
}

function matchExactText(value, expectedValue) {
  const normalizedExpectedValue = normalizeSearchText(expectedValue)

  if (!normalizedExpectedValue) {
    return true
  }

  return normalizeSearchText(value) === normalizedExpectedValue
}

function matchAliveState(value, expectedValue) {
  if (!expectedValue) {
    return true
  }

  return String(Boolean(value)) === String(expectedValue)
}

function normalizeSearchText(value) {
  return String(value ?? '').trim().toLowerCase()
}

function formatFilterValue(key, value) {
  if (key === 'riskLevel') {
    return DOMAIN_ASSET_RISK_OPTIONS.find((item) => item.value === value)?.shortLabel ?? value
  }

  if (key === 'alive') {
    return DOMAIN_ASSET_ALIVE_OPTIONS.find((item) => item.value === value)?.shortLabel ?? value
  }

  return value
}

watch(keywordInput, scheduleKeywordCommit)

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  void loadDomainAssets({ forceLoading: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.clearTimeout(keywordTimer)
  stopRequest()
})
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    main-class="domain-assets-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
  >
    <template #default>
      <main class="domain-assets-page">
        <section class="domain-assets-page-crumbs" aria-label="当前位置">
          <div class="domain-assets-page-crumb">
            <span class="domain-assets-page-crumb-separator">/</span>
            <span class="domain-assets-page-crumb-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath('domain')" />
            </span>
            <span>域名资产清单</span>
          </div>
        </section>

        <section class="domain-assets-content">
          <section class="domain-assets-panel">
            <div class="domain-assets-toolbar" aria-label="域名资产筛选">
              <label class="domain-assets-search-field">
                <span class="sr-only">模糊搜索域名</span>
                <input
                  v-model="keywordInput"
                  type="text"
                  placeholder="模糊搜索域名"
                  autocomplete="off"
                />
                <span class="domain-assets-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16 16 4 4" />
                  </svg>
                </span>
              </label>

              <div class="domain-assets-filter-strip" aria-label="已添加筛选条件">
                <button
                  v-for="filter in activeFilterChips"
                  :key="filter.key"
                  class="domain-assets-filter-chip"
                  type="button"
                  @click="openFilterDialog(filter.key)"
                >
                  <span>{{ filter.label }} {{ filter.valueLabel }}</span>
                  <span
                    class="domain-assets-filter-chip-remove"
                    role="button"
                    tabindex="0"
                    :aria-label="`移除${filter.label}筛选`"
                    @click.stop="removeFilter(filter.key)"
                    @keydown.enter.stop.prevent="removeFilter(filter.key)"
                    @keydown.space.stop.prevent="removeFilter(filter.key)"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="M16 8 8 16" />
                      <path d="M8 8l8 8" />
                    </svg>
                  </span>
                </button>

                <button class="domain-assets-add-filter" type="button" @click="openFilterDialog()">
                  <span class="domain-assets-add-filter-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                  <span>添加筛选条件</span>
                </button>

                <button
                  v-if="hasFilters"
                  class="domain-assets-clear-button"
                  type="button"
                  aria-label="清空筛选"
                  title="清空筛选"
                  @click="clearFilters"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="M15.8 8.2 8.2 15.8" />
                    <path d="M8.2 8.2 15.8 15.8" />
                    <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="showInlineError || showBlockingError" class="domain-assets-alert" :class="{ 'is-blocking': showBlockingError }" role="alert">
              <div>
                <strong>域名资产加载失败</strong>
                <p>{{ pageError }}</p>
              </div>
              <button type="button" @click="handleRefresh">重试</button>
            </div>

            <section class="domain-assets-table-card">
              <div class="domain-assets-table-scroll">
                <div class="domain-assets-table-inner">
                  <header class="domain-assets-table-head">
                    <div>资产地址</div>
                    <div>站点标题</div>
                    <div>风险等级</div>
                    <div>漏洞数量</div>
                    <div>组件数量</div>
                  </header>

                  <div v-if="showInitialLoading" class="domain-assets-skeleton-list" aria-hidden="true">
                    <div v-for="index in 6" :key="index" class="domain-assets-skeleton-row">
                      <span class="domain-assets-skeleton is-main"></span>
                      <span class="domain-assets-skeleton"></span>
                      <span class="domain-assets-skeleton is-pill"></span>
                      <span class="domain-assets-skeleton is-count"></span>
                      <span class="domain-assets-skeleton is-count"></span>
                    </div>
                  </div>

                  <div v-else-if="showBlockingError" class="domain-assets-state-panel is-error">
                    <h2>清单加载失败</h2>
                    <p>{{ pageError }}</p>
                    <button class="domain-assets-state-button" type="button" @click="handleRefresh">重新加载</button>
                  </div>

                  <div v-else-if="showEmptyState" class="domain-assets-state-panel">
                    <h2>{{ hasFilters ? '没有匹配的域名资产' : '暂无域名资产' }}</h2>
                    <p>{{ hasFilters ? '可以调整域名关键字或筛选条件后重试。' : '后端同步资产后会在这里展示。' }}</p>
                    <button v-if="hasFilters" class="domain-assets-state-button" type="button" @click="clearFilters">清空筛选</button>
                  </div>

                  <div v-else class="domain-assets-table-body">
                    <article
                      v-for="row in tableRows"
                      :key="row.id"
                      v-memo="[row.memoKey, selectedDomainAssetId === row.id]"
                      class="domain-assets-table-row"
                      :class="{ selected: selectedDomainAssetId === row.id }"
                      tabindex="0"
                      role="button"
                      :aria-pressed="selectedDomainAssetId === row.id ? 'true' : 'false'"
                      @click="selectDomainAsset(row.id)"
                      @keydown="handleDomainAssetKeydown($event, row.id)"
                    >
                      <div class="domain-assets-address-cell">
                        <strong>{{ row.assetAddress }}</strong>
                      </div>

                      <div class="domain-assets-title-cell">{{ row.title }}</div>

                      <div class="domain-assets-risk-cell">
                        <span class="domain-assets-risk-pill" :class="`is-${row.riskMeta.tone}`">
                          {{ row.riskMeta.label }}
                        </span>
                      </div>

                      <div class="domain-assets-vuln-cell">
                        <span class="domain-assets-vuln-count" :class="{ active: row.vulnerabilityCount > 0 }">
                          {{ row.vulnerabilityCountDisplay }}
                        </span>
                      </div>

                      <div class="domain-assets-component-cell">
                        <span>{{ row.componentCountDisplay }}</span>
                        <small v-if="row.componentPreview">{{ row.componentPreview }}</small>
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <footer v-if="!showInitialLoading && !showBlockingError" class="domain-assets-pagination">
                <div class="domain-assets-pagination-meta">
                  <span>{{ pageSummary }}</span>
                  <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
                </div>

                <div class="domain-assets-pagination-actions">
                  <div class="domain-assets-page-size" @click.stop>
                    <span>每页</span>
                    <button
                      class="domain-assets-page-size-trigger"
                      :class="{ active: isPageSizeMenuOpen }"
                      type="button"
                      :disabled="isLoading || isRefreshing"
                      aria-label="选择每页数量"
                      :aria-expanded="isPageSizeMenuOpen ? 'true' : 'false'"
                      aria-haspopup="listbox"
                      @click="togglePageSizeMenu"
                    >
                      <span>{{ pageSize }}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                        <path :d="isPageSizeMenuOpen ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
                      </svg>
                    </button>

                    <div v-if="isPageSizeMenuOpen" class="domain-assets-page-size-menu" role="listbox" aria-label="每页展示数量">
                      <button
                        v-for="item in DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS"
                        :key="item"
                        class="domain-assets-page-size-option"
                        :class="{ selected: pageSize === item }"
                        type="button"
                        role="option"
                        :aria-selected="pageSize === item ? 'true' : 'false'"
                        @click="selectPageSize(item)"
                      >
                        <span
                          class="domain-assets-page-size-check"
                          :class="{ selected: pageSize === item }"
                          aria-hidden="true"
                        ></span>
                        <span>{{ item }}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    class="domain-assets-pagination-arrow"
                    type="button"
                    :disabled="currentPage <= 1 || isLoading || isRefreshing"
                    aria-label="上一页"
                    @click="goToPreviousPage"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                  </button>

                  <button
                    class="domain-assets-pagination-arrow"
                    type="button"
                    :disabled="currentPage >= totalPages || isLoading || isRefreshing"
                    aria-label="下一页"
                    @click="goToNextPage"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </footer>
            </section>
          </section>
        </section>

        <div v-if="isFilterDialogOpen" class="domain-assets-dialog-overlay" role="presentation" @click.self="closeFilterDialog">
          <section
            ref="filterDialogRef"
            class="domain-assets-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="domain-assets-dialog-title"
            tabindex="-1"
          >
            <form @submit.prevent="saveDraftFilter">
              <header class="domain-assets-dialog-head">
                <h2 id="domain-assets-dialog-title">{{ dialogTitle }}</h2>
                <button class="domain-assets-dialog-close" type="button" aria-label="关闭" @click="closeFilterDialog">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div class="domain-assets-dialog-body">
                <label class="domain-assets-dialog-field is-filter-type">
                  <span>筛选字段</span>
                  <select v-model="draftFilterKey" @change="handleDraftFilterKeyChange">
                    <option v-for="option in DOMAIN_ASSET_FILTER_OPTIONS" :key="option.key" :value="option.key">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label class="domain-assets-dialog-field is-filter-value">
                  <span>{{ selectedDraftFilter.label }}</span>
                  <select v-if="selectedDraftFilter.type === 'select'" v-model="draftFilterValue">
                    <option value="">请选择{{ selectedDraftFilter.label }}</option>
                    <option
                      v-for="option in selectedDraftOptions.filter((item) => item.value)"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="draftFilterValue"
                    type="text"
                    :placeholder="selectedDraftFilter.placeholder"
                    autocomplete="off"
                  />
                  <small v-if="draftError">{{ draftError }}</small>
                </label>

                <label v-if="draftFilterKey === 'organization'" class="domain-assets-checkbox-field">
                  <input v-model="includeSubOrganization" type="checkbox" />
                  <span>包含下级组织单位</span>
                </label>
              </div>

              <footer class="domain-assets-dialog-actions">
                <button class="domain-assets-dialog-button is-secondary" type="button" @click="closeFilterDialog">取消</button>
                <button class="domain-assets-dialog-button" type="submit" :disabled="!canSaveDraft">保存</button>
              </footer>
            </form>
          </section>
        </div>
      </main>
    </template>
  </AppShell>
</template>
