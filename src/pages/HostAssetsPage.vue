<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import {
  DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS,
  DOMAIN_ASSET_RISK_META,
  DOMAIN_ASSET_RISK_OPTIONS
} from '../constants/domainAssets'
import { formatCount } from '../utils/scanTask'
import { iconPath } from '../utils/icons'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/assets/hosts'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  },
  currentUserName: {
    type: String,
    default: 'admin'
  }
})

const emit = defineEmits(['toggle-sidebar', 'logout'])

const HOST_ASSET_SEARCH_DEBOUNCE = 300
const HOST_ASSET_FILTER_OPTIONS = [
  { key: 'osType', label: '操作系统类型', placeholder: '输入操作系统类型' },
  { key: 'region', label: '区域', placeholder: '输入区域' },
  { key: 'riskLevel', label: '风险等级', type: 'select', options: DOMAIN_ASSET_RISK_OPTIONS }
]
const HOST_ASSET_FILTER_LABELS = HOST_ASSET_FILTER_OPTIONS.reduce((result, item) => {
  result[item.key] = item.label
  return result
}, {})

const hostAssetRows = [
  {
    id: 'host-1',
    ip: '10.12.4.18',
    osType: 'Linux / Ubuntu 22.04',
    region: '华北-生产区',
    riskLevel: 'high',
    vulnerabilityCount: 8,
    portComponentCount: 14
  },
  {
    id: 'host-2',
    ip: '10.12.8.31',
    osType: 'Windows Server 2019',
    region: '华东-办公网',
    riskLevel: 'medium',
    vulnerabilityCount: 4,
    portComponentCount: 9
  },
  {
    id: 'host-3',
    ip: '172.16.20.45',
    osType: 'Linux / CentOS 7',
    region: '华南-DMZ',
    riskLevel: 'critical',
    vulnerabilityCount: 13,
    portComponentCount: 21
  },
  {
    id: 'host-4',
    ip: '192.168.40.12',
    osType: 'macOS 14',
    region: '研发终端区',
    riskLevel: 'low',
    vulnerabilityCount: 1,
    portComponentCount: 5
  },
  {
    id: 'host-5',
    ip: '10.30.5.77',
    osType: 'Linux / Debian 12',
    region: '容器节点池',
    riskLevel: 'info',
    vulnerabilityCount: 0,
    portComponentCount: 18
  },
  {
    id: 'host-6',
    ip: '10.44.16.9',
    osType: 'FreeBSD 13',
    region: '边界服务区',
    riskLevel: 'unknown',
    vulnerabilityCount: 0,
    portComponentCount: 3
  }
]

const keywordInput = ref('')
const appliedKeyword = ref('')
const activeFilters = reactive(createEmptyFilters())
const isFilterDialogOpen = ref(false)
const filterDialogRef = ref(null)
const draftFilterKey = ref(HOST_ASSET_FILTER_OPTIONS[0].key)
const draftFilterValue = ref('')
const draftError = ref('')
const currentPage = ref(1)
const pageSize = ref(DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS[0])
const isPageSizeMenuOpen = ref(false)
const selectedHostAssetId = ref('')

let keywordTimer = null

const filteredRows = computed(() => {
  const keyword = appliedKeyword.value.trim().toLowerCase()

  return hostAssetRows.filter((row) =>
    matchesKeyword(row, keyword) &&
    matchesTextFilter(row.osType, activeFilters.osType) &&
    matchesTextFilter(row.region, activeFilters.region) &&
    matchesExactFilter(row.riskLevel, activeFilters.riskLevel)
  )
})
const total = computed(() => filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const tableRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const hasData = computed(() => tableRows.value.length > 0)
const pageStart = computed(() => (total.value && hasData.value ? (currentPage.value - 1) * pageSize.value + 1 : 0))
const pageEnd = computed(() => (total.value && hasData.value ? Math.min(total.value, pageStart.value + tableRows.value.length - 1) : 0))
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
      label: HOST_ASSET_FILTER_LABELS[key] ?? key,
      valueLabel: formatFilterValue(key, value)
    }))
)
const hasFilters = computed(() => Boolean(appliedKeyword.value || activeFilterChips.value.length > 0))
const selectedDraftFilter = computed(
  () => HOST_ASSET_FILTER_OPTIONS.find((item) => item.key === draftFilterKey.value) ?? HOST_ASSET_FILTER_OPTIONS[0]
)
const selectedDraftOptions = computed(() => selectedDraftFilter.value.options ?? [])
const dialogTitle = computed(() => (activeFilters[draftFilterKey.value] ? '编辑筛选条件' : '添加筛选条件'))
const canSaveDraft = computed(() => String(draftFilterValue.value ?? '').trim() !== '')

function createEmptyFilters() {
  return {
    osType: '',
    region: '',
    riskLevel: ''
  }
}

function matchesKeyword(row, keyword) {
  if (!keyword) {
    return true
  }

  return String(row.ip).toLowerCase().includes(keyword)
}

function matchesTextFilter(value, filterValue) {
  const normalizedFilter = String(filterValue ?? '').trim().toLowerCase()

  if (!normalizedFilter) {
    return true
  }

  return String(value ?? '').toLowerCase().includes(normalizedFilter)
}

function matchesExactFilter(value, filterValue) {
  const normalizedFilter = String(filterValue ?? '').trim()
  return !normalizedFilter || String(value) === normalizedFilter
}

function getRiskMeta(riskLevel) {
  return DOMAIN_ASSET_RISK_META[riskLevel] ?? DOMAIN_ASSET_RISK_META.unknown
}

function scheduleKeywordCommit() {
  const nextKeyword = keywordInput.value.trim()

  if (nextKeyword === appliedKeyword.value) {
    return
  }

  window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(() => {
    appliedKeyword.value = nextKeyword
    currentPage.value = 1
    selectedHostAssetId.value = ''
  }, HOST_ASSET_SEARCH_DEBOUNCE)
}

function clearKeyword() {
  window.clearTimeout(keywordTimer)
  keywordInput.value = ''
  appliedKeyword.value = ''
  currentPage.value = 1
  selectedHostAssetId.value = ''
}

function openFilterDialog(filterKey = '') {
  const nextFilterKey = filterKey || HOST_ASSET_FILTER_OPTIONS.find((item) => !activeFilters[item.key])?.key || HOST_ASSET_FILTER_OPTIONS[0].key
  draftFilterKey.value = nextFilterKey
  draftFilterValue.value = activeFilters[nextFilterKey] || ''
  draftError.value = ''
  closePageSizeMenu()
  isFilterDialogOpen.value = true
  void nextTick(() => {
    filterDialogRef.value?.focus()
  })
}

function closeFilterDialog() {
  isFilterDialogOpen.value = false
  draftError.value = ''
}

function selectDraftFilterKey(filterKey) {
  if (draftFilterKey.value === filterKey) {
    return
  }

  draftFilterKey.value = filterKey
  draftFilterValue.value = activeFilters[filterKey] || ''
  draftError.value = ''
}

function selectDraftFilterValue(value) {
  draftFilterValue.value = value
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
  currentPage.value = 1
  selectedHostAssetId.value = ''
}

function removeFilter(filterKey) {
  activeFilters[filterKey] = ''
  currentPage.value = 1
  selectedHostAssetId.value = ''
}

function clearFilters() {
  clearKeyword()
  Object.assign(activeFilters, createEmptyFilters())
  closeFilterDialog()
  closePageSizeMenu()
}

function formatFilterValue(key, value) {
  if (key === 'riskLevel') {
    return DOMAIN_ASSET_RISK_OPTIONS.find((item) => item.value === value)?.shortLabel ?? value
  }

  return value
}

function closePageSizeMenu() {
  isPageSizeMenuOpen.value = false
}

function handleDocumentClick() {
  closePageSizeMenu()
}

function togglePageSizeMenu() {
  closeFilterDialog()
  isPageSizeMenuOpen.value = !isPageSizeMenuOpen.value
}

function selectPageSize(nextPageSize) {
  pageSize.value = nextPageSize
  currentPage.value = 1
  closePageSizeMenu()
}

function goToPreviousPage() {
  if (currentPage.value <= 1) {
    return
  }

  currentPage.value -= 1
}

function goToNextPage() {
  if (currentPage.value >= totalPages.value) {
    return
  }

  currentPage.value += 1
}

function selectHostAsset(assetId) {
  selectedHostAssetId.value = selectedHostAssetId.value === assetId ? '' : assetId
}

function handleHostAssetKeydown(event, assetId) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectHostAsset(assetId)
  }
}

watch(keywordInput, scheduleKeywordCommit)

watch(totalPages, (nextTotalPages) => {
  if (currentPage.value > nextTotalPages) {
    currentPage.value = nextTotalPages
  }
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.clearTimeout(keywordTimer)
})
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    :current-user-name="props.currentUserName"
    main-class="domain-assets-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
    @logout="emit('logout')"
  >
    <template #default>
      <main class="domain-assets-page host-assets-page">
        <section class="domain-assets-page-crumbs" aria-label="当前位置">
          <div class="domain-assets-page-crumb">
            <span class="domain-assets-page-crumb-separator">/</span>
            <span class="domain-assets-page-crumb-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath('server')" />
            </span>
            <span>主机资产清单</span>
          </div>
        </section>

        <section class="domain-assets-content">
          <section class="domain-assets-panel">
            <div class="domain-assets-toolbar" aria-label="主机资产筛选">
              <label class="domain-assets-search-field">
                <span class="sr-only">搜索主机 IP</span>
                <input
                  v-model="keywordInput"
                  type="text"
                  placeholder="搜索主机 IP"
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

            <section class="domain-assets-table-card host-assets-table-card">
              <div class="domain-assets-table-scroll">
                <div class="domain-assets-table-inner host-assets-table-inner">
                  <header class="domain-assets-table-head host-assets-table-grid">
                    <div>IP</div>
                    <div>操作系统类型</div>
                    <div>区域</div>
                    <div>风险等级</div>
                    <div>漏洞数量</div>
                    <div>端口组件数量</div>
                  </header>

                  <div v-if="!hasData" class="domain-assets-state-panel">
                    <h2>{{ hasFilters ? '没有匹配的主机资产' : '暂无主机资产' }}</h2>
                    <p>{{ hasFilters ? '可以调整 IP 搜索、操作系统、区域或风险等级后重试。' : '后续接入主机资产接口后会在这里展示。' }}</p>
                    <button v-if="hasFilters" class="domain-assets-state-button" type="button" @click="clearFilters">清空筛选</button>
                  </div>

                  <div v-else class="domain-assets-table-body">
                    <article
                      v-for="row in tableRows"
                      :key="row.id"
                      class="domain-assets-table-row host-assets-table-grid"
                      :class="{ selected: selectedHostAssetId === row.id }"
                      tabindex="0"
                      role="button"
                      :aria-pressed="selectedHostAssetId === row.id ? 'true' : 'false'"
                      @click="selectHostAsset(row.id)"
                      @keydown="handleHostAssetKeydown($event, row.id)"
                    >
                      <div class="domain-assets-address-cell">
                        <strong>{{ row.ip }}</strong>
                      </div>

                      <div class="domain-assets-title-cell">{{ row.osType }}</div>

                      <div class="domain-assets-region-cell">
                        <span>{{ row.region }}</span>
                      </div>

                      <div class="domain-assets-risk-cell">
                        <span class="domain-assets-risk-pill" :class="`is-${getRiskMeta(row.riskLevel).tone}`">
                          {{ getRiskMeta(row.riskLevel).label }}
                        </span>
                      </div>

                      <div class="domain-assets-component-cell">
                        <span>{{ formatCount(row.vulnerabilityCount) }}</span>
                      </div>

                      <div class="domain-assets-component-cell">
                        <span>{{ formatCount(row.portComponentCount) }}</span>
                      </div>
                    </article>
                  </div>
                </div>
              </div>

              <footer class="domain-assets-pagination">
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
                    :disabled="currentPage <= 1"
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
                    :disabled="currentPage >= totalPages"
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
            aria-labelledby="host-assets-dialog-title"
            tabindex="-1"
          >
            <form @submit.prevent="saveDraftFilter">
              <header class="domain-assets-dialog-head">
                <h2 id="host-assets-dialog-title">{{ dialogTitle }}</h2>
                <button class="domain-assets-dialog-close" type="button" aria-label="关闭" @click="closeFilterDialog">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </header>

              <div class="domain-assets-dialog-body">
                <section class="domain-assets-dialog-field is-filter-type">
                  <span>筛选字段</span>
                  <div class="domain-assets-filter-option-grid" role="radiogroup" aria-label="筛选字段">
                    <button
                      v-for="option in HOST_ASSET_FILTER_OPTIONS"
                      :key="option.key"
                      class="domain-assets-filter-option"
                      :class="{ selected: draftFilterKey === option.key }"
                      type="button"
                      :aria-checked="draftFilterKey === option.key ? 'true' : 'false'"
                      role="radio"
                      @click="selectDraftFilterKey(option.key)"
                    >
                      <span class="domain-assets-filter-option-check" :class="{ selected: draftFilterKey === option.key }"></span>
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </section>

                <section class="domain-assets-dialog-field is-filter-value">
                  <span>{{ selectedDraftFilter.label }}</span>
                  <div
                    v-if="selectedDraftFilter.type === 'select'"
                    class="domain-assets-value-option-grid"
                    role="radiogroup"
                    :aria-label="selectedDraftFilter.label"
                  >
                    <button
                      v-for="option in selectedDraftOptions.filter((item) => item.value)"
                      :key="option.value"
                      class="domain-assets-value-option"
                      :class="{ selected: draftFilterValue === option.value }"
                      type="button"
                      :aria-checked="draftFilterValue === option.value ? 'true' : 'false'"
                      role="radio"
                      @click="selectDraftFilterValue(option.value)"
                    >
                      <span class="domain-assets-filter-option-check" :class="{ selected: draftFilterValue === option.value }"></span>
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                  <input
                    v-else
                    v-model="draftFilterValue"
                    type="text"
                    :aria-label="selectedDraftFilter.label"
                    :placeholder="selectedDraftFilter.placeholder"
                    autocomplete="off"
                  />
                  <small v-if="draftError">{{ draftError }}</small>
                </section>
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
