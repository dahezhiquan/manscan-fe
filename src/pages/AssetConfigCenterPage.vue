<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  createAssetConfigCenter,
  deleteAssetConfigCenter,
  getAssetConfigCenterList,
  getAssetConfigCenterSmallCategoryOptions,
  updateAssetConfigCenter
} from '../api/asset-config'
import AppShell from '../components/layout/AppShell.vue'
import { formatCount } from '../utils/scanTask'
import { iconPath } from '../utils/icons'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/assets/config'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-sidebar'])

const CATEGORY_OPTIONS = [
  {
    value: '',
    label: '全部配置',
    icon: 'grid'
  },
  {
    value: 'scanDisabled',
    label: '全局扫描白名单',
    icon: 'shield'
  },
  {
    value: 'network',
    label: '网络网段信息',
    icon: 'stack'
  },
  {
    value: 'passive_traffic_addresses',
    label: '被动流量地址配置',
    icon: 'server'
  }
]

const CATEGORY_VALUE_SET = new Set(CATEGORY_OPTIONS.map((item) => item.value).filter(Boolean))
const STATUS_OPTIONS = [
  { value: '', label: '全部状态', tone: 'all' },
  { value: 'enabled', label: '启用', tone: 'low' },
  { value: 'disabled', label: '停用', tone: 'medium' }
]
const FORM_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((item) => item.value)
const FORM_STATUS_OPTIONS = STATUS_OPTIONS.filter((item) => item.value)
const DEFAULT_PAGE_SIZE = 10
const SEARCH_DEBOUNCE = 280

const filtersRef = ref(null)
const activeFilterMenu = ref('')
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const formMode = ref('create')
const currentPage = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const selectedCategory = ref('')
const selectedStatus = ref('')
const selectedSmallCategory = ref('')
const itemNameInput = ref('')
const appliedItemName = ref('')
const smallCategoryOptions = ref([])
const formSmallCategoryOptions = ref([])
const tableRows = ref([])
const total = ref(0)
const totalPages = ref(1)
const listError = ref('')
const smallCategoryOptionsError = ref('')
const formSmallCategoryOptionsError = ref('')
const isLoading = ref(true)
const isRefreshing = ref(false)
const isSmallCategoryOptionsLoading = ref(false)
const isFormSmallCategoryOptionsLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const formError = ref('')
const deleteError = ref('')
const deleteTarget = ref(null)
const formState = reactive(createEmptyForm())

let listController = null
let smallCategoryOptionsController = null
let formSmallCategoryOptionsController = null
let searchTimer = null
let listRequestId = 0
let smallCategoryOptionsRequestId = 0
let formSmallCategoryOptionsRequestId = 0

const activeCategoryMeta = computed(() => getCategoryMeta(selectedCategory.value))
const activeCategoryLabel = computed(() => activeCategoryMeta.value.label)
const selectedStatusLabel = computed(() => getFilterStatusMeta(selectedStatus.value).label)
const selectedSmallCategoryLabel = computed(() => selectedSmallCategory.value || '小分类')
const selectedFormCategoryLabel = computed(() => getCategoryLabel(formState.big_category))
const filteredFormSmallCategoryOptions = computed(() => {
  const keyword = normalizeText(formState.small_category).toLowerCase()

  return formSmallCategoryOptions.value.filter((option) => {
    if (!keyword) {
      return true
    }

    return option.toLowerCase().includes(keyword)
  })
})
const hasFilters = computed(
  () =>
    selectedCategory.value !== '' ||
    selectedStatus.value !== '' ||
    appliedItemName.value !== '' ||
    selectedSmallCategory.value !== ''
)
const hasData = computed(() => tableRows.value.length > 0)
const showInitialLoading = computed(() => isLoading.value && !hasData.value)
const showBlockingError = computed(() => Boolean(listError.value) && !hasData.value && !isLoading.value)
const showInlineError = computed(() => Boolean(listError.value) && hasData.value)
const showEmptyState = computed(() => !showInitialLoading.value && !showBlockingError.value && !hasData.value)
const currentPageStart = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return (currentPage.value - 1) * pageSize.value + 1
})
const currentPageEnd = computed(() => {
  if (!total.value || !tableRows.value.length) {
    return 0
  }

  return Math.min(total.value, currentPageStart.value + tableRows.value.length - 1)
})
const pageSummary = computed(() => {
  if (!total.value) {
    return '当前没有匹配到资产配置项'
  }

  return `第 ${currentPage.value} / ${Math.max(totalPages.value, 1)} 页，显示 ${formatCount(currentPageStart.value)} - ${formatCount(currentPageEnd.value)}，共 ${formatCount(total.value)} 条`
})
const categoryTabs = computed(() => CATEGORY_OPTIONS)
const formTitle = computed(() => (formMode.value === 'create' ? '新增资产配置项' : '编辑资产配置项'))
const deleteTargetLabel = computed(() => deleteTarget.value?.item_name || '')
const deleteTargetCategoryLabel = computed(() => getCategoryLabel(deleteTarget.value?.big_category))
const deleteTargetSummary = computed(() => {
  if (!deleteTarget.value) {
    return ''
  }

  const parts = [deleteTargetCategoryLabel.value]
  if (deleteTarget.value.small_category) {
    parts.push(deleteTarget.value.small_category)
  }
  if (deleteTarget.value.status) {
    parts.push(getStatusMeta(deleteTarget.value.status).label)
  }

  return parts.filter(Boolean).join(' · ')
})

const normalizedRows = computed(() =>
  tableRows.value.map((item) => ({
    id: item.id,
    item_name: item.item_name,
    big_category: item.big_category,
    bigCategoryLabel: getCategoryLabel(item.big_category),
    small_category: item.small_category,
    status: normalizeStatus(item.status),
    statusLabel: getStatusMeta(item.status).label,
    description: item.description
  }))
)

watch(
  [selectedCategory, selectedStatus, appliedItemName, selectedSmallCategory, currentPage, pageSize],
  () => {
    void loadAssetConfigList()
  },
  { immediate: true }
)

watch(itemNameInput, scheduleSearchCommit)

watch(
  selectedCategory,
  () => {
    void loadSmallCategoryOptions()
  },
  { immediate: true }
)

watch(
  [isFormDialogOpen, () => formState.big_category],
  ([isOpen, nextCategory], [wasOpen, previousCategory] = []) => {
    if (!isOpen) {
      return
    }

    if (wasOpen && nextCategory !== previousCategory) {
      formState.small_category = ''
    }

    void loadFormSmallCategoryOptions(nextCategory)
  }
)

function getCategoryMeta(value) {
  return CATEGORY_OPTIONS.find((item) => item.value === value) ?? CATEGORY_OPTIONS[0]
}

function getCategoryLabel(value) {
  return getCategoryMeta(value).label
}

function getStatusMeta(value) {
  const normalized = normalizeStatus(value)
  return STATUS_OPTIONS.find((item) => item.value === normalized) ?? STATUS_OPTIONS[0]
}

function getFilterStatusMeta(value) {
  const normalized = normalizeFilterStatus(value)
  return STATUS_OPTIONS.find((item) => item.value === normalized) ?? STATUS_OPTIONS[0]
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase() === 'enabled' ? 'enabled' : 'disabled'
}

function normalizeFilterStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'enabled' || normalized === 'disabled' ? normalized : ''
}

function normalizeCategory(value) {
  const normalized = String(value ?? '').trim()
  return CATEGORY_VALUE_SET.has(normalized) ? normalized : ''
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback
}

function createEmptyForm() {
  return {
    id: '',
    item_name: '',
    big_category: CATEGORY_OPTIONS[1]?.value ?? '',
    small_category: '',
    status: 'enabled',
    description: ''
  }
}

function resetForm(nextCategory = '') {
  Object.assign(formState, createEmptyForm(), {
    big_category: normalizeCategory(nextCategory) || CATEGORY_OPTIONS[1]?.value || ''
  })
}

function populateForm(row) {
  Object.assign(formState, {
    id: row.id,
    item_name: row.item_name,
    big_category: normalizeCategory(row.big_category) || CATEGORY_OPTIONS[1]?.value || '',
    small_category: row.small_category || '',
    status: normalizeStatus(row.status),
    description: row.description || ''
  })
}

function normalizeListResponse(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  const nextPageSize = toPositiveInt(payload?.pageSize ?? payload?.page_size, pageSize.value)
  const nextTotal = toNonNegativeInt(payload?.total, 0)
  const nextTotalPages = toPositiveInt(
    payload?.totalPages ?? payload?.total_pages,
    nextTotal > 0 ? Math.max(1, Math.ceil(nextTotal / nextPageSize)) : 1
  )

  return {
    page: toPositiveInt(payload?.page, currentPage.value),
    pageSize: nextPageSize,
    total: nextTotal,
    totalPages: nextTotalPages,
    items: items.map(normalizeAssetConfigItem)
  }
}

function normalizeSmallCategoryOptionsResponse(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  const values = items
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      return item?.value ?? item?.label ?? item?.small_category ?? item?.name ?? ''
    })
    .map(normalizeText)
    .filter(Boolean)

  return [...new Set(values)]
}

function normalizeAssetConfigItem(item) {
  return {
    id: item?.id,
    item_name: normalizeText(item?.item_name),
    big_category: normalizeCategory(item?.big_category),
    small_category: normalizeText(item?.small_category),
    status: normalizeStatus(item?.status),
    description: normalizeText(item?.description)
  }
}

function buildListFilters() {
  return {
    page: currentPage.value,
    pageSize: pageSize.value,
    itemName: appliedItemName.value,
    bigCategory: selectedCategory.value || undefined,
    smallCategory: selectedSmallCategory.value,
    status: selectedStatus.value || undefined
  }
}

function buildSmallCategoryOptionFilters() {
  return {
    bigCategory: selectedCategory.value || [...CATEGORY_VALUE_SET]
  }
}

function buildFormSmallCategoryOptionFilters(category = formState.big_category) {
  return {
    bigCategory: normalizeCategory(category) || CATEGORY_OPTIONS[1]?.value || ''
  }
}

function scheduleSearchCommit() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    appliedItemName.value = normalizeText(itemNameInput.value)
    currentPage.value = 1
  }, SEARCH_DEBOUNCE)
}

function selectCategory(value) {
  selectedCategory.value = normalizeCategory(value)
  selectedSmallCategory.value = ''
  currentPage.value = 1
}

function selectSmallCategory(value) {
  selectedSmallCategory.value = normalizeText(value)
  currentPage.value = 1
  closeFilterMenu()
}

function selectStatus(value) {
  selectedStatus.value = normalizeFilterStatus(value)
  currentPage.value = 1
  closeFilterMenu()
}

function clearFilters() {
  selectedCategory.value = ''
  selectedStatus.value = ''
  selectedSmallCategory.value = ''
  itemNameInput.value = ''
  appliedItemName.value = ''
  currentPage.value = 1
  closeFilterMenu()
}

function toggleSmallCategoryMenu() {
  activeFilterMenu.value = activeFilterMenu.value === 'smallCategory' ? '' : 'smallCategory'
}

function toggleStatusMenu() {
  activeFilterMenu.value = activeFilterMenu.value === 'status' ? '' : 'status'
}

function toggleFormCategoryMenu() {
  activeFilterMenu.value = activeFilterMenu.value === 'formCategory' ? '' : 'formCategory'
}

function closeFilterMenu() {
  activeFilterMenu.value = ''
}

function isSmallCategoryMenuOpen() {
  return activeFilterMenu.value === 'smallCategory'
}

function isStatusMenuOpen() {
  return activeFilterMenu.value === 'status'
}

function isFormCategoryMenuOpen() {
  return activeFilterMenu.value === 'formCategory'
}

function isFormSmallCategoryMenuOpen() {
  return activeFilterMenu.value === 'formSmallCategory'
}

function selectFormCategory(value) {
  const nextCategory = normalizeCategory(value) || CATEGORY_OPTIONS[1]?.value || ''
  formState.big_category = nextCategory
  closeFilterMenu()
}

function openFormSmallCategoryMenu() {
  activeFilterMenu.value = 'formSmallCategory'
}

function handleFormSmallCategoryInput() {
  openFormSmallCategoryMenu()
}

function selectFormSmallCategoryOption(value) {
  formState.small_category = normalizeText(value)
  closeFilterMenu()
}

function openCreateDialog() {
  formMode.value = 'create'
  formError.value = ''
  resetForm(selectedCategory.value)
  closeFilterMenu()
  isFormDialogOpen.value = true
}

function openEditDialog(row) {
  if (!row) {
    return
  }

  formMode.value = 'edit'
  formError.value = ''
  populateForm(row)
  closeFilterMenu()
  isFormDialogOpen.value = true
}

function closeFormDialog() {
  isFormDialogOpen.value = false
  formError.value = ''
  closeFilterMenu()
}

function openDeleteDialog(row) {
  if (!row) {
    return
  }

  deleteTarget.value = row
  deleteError.value = ''
  isDeleteDialogOpen.value = true
}

function closeDeleteDialog() {
  isDeleteDialogOpen.value = false
  deleteError.value = ''
  deleteTarget.value = null
}

async function submitForm() {
  const nextItemName = normalizeText(formState.item_name)
  const nextBigCategory = normalizeCategory(formState.big_category)
  const nextSmallCategory = normalizeText(formState.small_category)
  const nextDescription = normalizeText(formState.description)
  const nextStatus = normalizeStatus(formState.status)

  if (!nextItemName) {
    formError.value = '项名称不能为空。'
    return
  }

  if (!nextBigCategory) {
    formError.value = '请选择有效的大分类。'
    return
  }

  if (!nextSmallCategory) {
    formError.value = '小分类不能为空。'
    return
  }

  if (!['enabled', 'disabled'].includes(nextStatus)) {
    formError.value = '状态仅支持启用或停用。'
    return
  }

  const payload = {
    item_name: nextItemName,
    big_category: nextBigCategory,
    small_category: nextSmallCategory,
    status: nextStatus,
    description: nextDescription
  }

  const request = formMode.value === 'create'
    ? createAssetConfigCenter(payload)
    : updateAssetConfigCenter(formState.id, payload)

  isSaving.value = true
  formError.value = ''

  try {
    await request
    closeFormDialog()
    await refreshData()
  } catch (error) {
    formError.value = error instanceof Error ? error.message : '保存失败，请稍后重试。'
  } finally {
    isSaving.value = false
  }
}

async function confirmDelete() {
  if (!deleteTarget.value?.id) {
    deleteError.value = '未找到要删除的资产配置项。'
    return
  }

  isDeleting.value = true
  deleteError.value = ''

  try {
    await deleteAssetConfigCenter(deleteTarget.value.id)
    closeDeleteDialog()
    await refreshData()
  } catch (error) {
    deleteError.value = error instanceof Error ? error.message : '删除失败，请稍后重试。'
  } finally {
    isDeleting.value = false
  }
}

async function refreshData() {
  await Promise.all([loadAssetConfigList(), loadSmallCategoryOptions()])
}

async function loadAssetConfigList() {
  if (typeof window === 'undefined') {
    return
  }

  if (listController) {
    listController.abort()
  }

  const controller = new AbortController()
  listController = controller
  const requestId = ++listRequestId
  const shouldShowBlockingLoader = !hasData.value && isLoading.value
  const wasLoading = isLoading.value

  if (shouldShowBlockingLoader) {
    isLoading.value = true
  } else if (wasLoading) {
    isLoading.value = true
  } else {
    isRefreshing.value = true
  }

  listError.value = ''

  try {
    const payload = await getAssetConfigCenterList(buildListFilters(), controller.signal)

    if (requestId !== listRequestId || controller.signal.aborted) {
      return
    }

    const normalized = normalizeListResponse(payload)
    tableRows.value = normalized.items
    total.value = normalized.total
    totalPages.value = normalized.totalPages
    currentPage.value = normalized.page
    pageSize.value = normalized.pageSize

    if (!normalized.items.length && normalized.total > 0 && currentPage.value > normalized.totalPages) {
      currentPage.value = normalized.totalPages
      return
    }
  } catch (error) {
    if (controller.signal.aborted || requestId !== listRequestId) {
      return
    }

    listError.value = error instanceof Error ? error.message : '资产配置中心列表加载失败，请稍后重试。'
  } finally {
    if (requestId === listRequestId) {
      isLoading.value = false
      isRefreshing.value = false
    }
  }
}

async function loadSmallCategoryOptions() {
  if (typeof window === 'undefined') {
    return
  }

  if (smallCategoryOptionsController) {
    smallCategoryOptionsController.abort()
  }

  const controller = new AbortController()
  smallCategoryOptionsController = controller
  const requestId = ++smallCategoryOptionsRequestId

  isSmallCategoryOptionsLoading.value = true
  smallCategoryOptionsError.value = ''

  try {
    const payload = await getAssetConfigCenterSmallCategoryOptions(buildSmallCategoryOptionFilters(), controller.signal)

    if (requestId !== smallCategoryOptionsRequestId || controller.signal.aborted) {
      return
    }

    const options = normalizeSmallCategoryOptionsResponse(payload)
    smallCategoryOptions.value = options

    if (selectedSmallCategory.value && !options.includes(selectedSmallCategory.value)) {
      selectedSmallCategory.value = ''
      currentPage.value = 1
    }
  } catch (error) {
    if (controller.signal.aborted || requestId !== smallCategoryOptionsRequestId) {
      return
    }

    smallCategoryOptions.value = []
    smallCategoryOptionsError.value = error instanceof Error ? error.message : '小分类选项加载失败，请稍后重试。'
  } finally {
    if (requestId === smallCategoryOptionsRequestId) {
      isSmallCategoryOptionsLoading.value = false
    }
  }
}

async function loadFormSmallCategoryOptions(category = formState.big_category) {
  if (typeof window === 'undefined') {
    return
  }

  if (formSmallCategoryOptionsController) {
    formSmallCategoryOptionsController.abort()
  }

  const controller = new AbortController()
  formSmallCategoryOptionsController = controller
  const requestId = ++formSmallCategoryOptionsRequestId

  isFormSmallCategoryOptionsLoading.value = true
  formSmallCategoryOptionsError.value = ''

  try {
    const payload = await getAssetConfigCenterSmallCategoryOptions(
      buildFormSmallCategoryOptionFilters(category),
      controller.signal
    )

    if (requestId !== formSmallCategoryOptionsRequestId || controller.signal.aborted) {
      return
    }

    formSmallCategoryOptions.value = normalizeSmallCategoryOptionsResponse(payload)
  } catch (error) {
    if (controller.signal.aborted || requestId !== formSmallCategoryOptionsRequestId) {
      return
    }

    formSmallCategoryOptions.value = []
    formSmallCategoryOptionsError.value = error instanceof Error ? error.message : '小分类选项加载失败，请稍后重试。'
  } finally {
    if (requestId === formSmallCategoryOptionsRequestId) {
      isFormSmallCategoryOptionsLoading.value = false
    }
  }
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenu()
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }

  if (activeFilterMenu.value) {
    closeFilterMenu()
    return
  }

  if (isDeleteDialogOpen.value) {
    closeDeleteDialog()
    return
  }

  if (isFormDialogOpen.value) {
    closeFormDialog()
    return
  }

  closeFilterMenu()
}

function retryLoad() {
  void refreshData()
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleGlobalKeydown)
  if (listController) {
    listController.abort()
  }
  if (smallCategoryOptionsController) {
    smallCategoryOptionsController.abort()
  }
  if (formSmallCategoryOptionsController) {
    formSmallCategoryOptionsController.abort()
  }
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    main-class="asset-config-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
  >
    <template #default>
      <main class="asset-config-page">
        <section class="asset-config-page-crumbs" aria-label="当前位置">
          <div class="asset-config-page-crumb">
            <span class="asset-config-page-crumb-separator">/</span>
            <span class="asset-config-page-crumb-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath('gear')" />
            </span>
            <span>资产配置中心</span>
          </div>
        </section>

        <section class="asset-config-tabs" aria-label="配置域切换">
          <button
            v-for="tab in categoryTabs"
            :key="tab.value || 'all'"
            class="asset-config-tab"
            :class="{ active: tab.value === selectedCategory }"
            type="button"
            @click="selectCategory(tab.value)"
          >
            <span class="asset-config-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath(tab.icon)" />
            </span>
            <span class="asset-config-tab-label">
              <strong>{{ tab.label }}</strong>
            </span>
          </button>

          <button class="asset-config-tab asset-config-tab--action" type="button" @click="openCreateDialog">
            <span class="asset-config-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span class="asset-config-tab-label">
              <strong>新增配置项</strong>
            </span>
          </button>
        </section>

        <section class="asset-config-content">
          <section class="asset-config-panel">
            <header class="asset-config-panel-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryLabel }}</span>
                <h2>资产配置项</h2>
              </div>

              <div class="asset-config-panel-head-meta">
                <span class="asset-config-panel-head-chip">{{ formatCount(total) }} 条</span>
              </div>
            </header>

            <div ref="filtersRef" class="asset-config-toolbar" aria-label="配置筛选">
              <label class="asset-config-search-field">
                <span class="sr-only">项名称</span>
                <input
                  v-model="itemNameInput"
                  type="text"
                  placeholder="按项名称搜索"
                  autocomplete="off"
                />
                <span class="asset-config-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16 16 4 4" />
                  </svg>
                </span>
              </label>

              <div class="asset-config-filter-wrap" @click.stop>
                <button
                  class="asset-config-filter-trigger asset-config-filter-trigger--wide"
                  :class="{ active: isSmallCategoryMenuOpen() || selectedSmallCategory !== '' }"
                  type="button"
                  @click.stop="toggleSmallCategoryMenu"
                >
                  <span>{{ selectedSmallCategoryLabel }}</span>
                  <span class="asset-config-filter-trigger-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path :d="isSmallCategoryMenuOpen() ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
                    </svg>
                  </span>
                </button>

                <div v-if="isSmallCategoryMenuOpen()" class="asset-config-filter-menu asset-config-filter-menu--small-category">
                  <button
                    class="asset-config-filter-option"
                    :class="{ selected: selectedSmallCategory === '' }"
                    type="button"
                    @click.stop="selectSmallCategory('')"
                  >
                    <span class="asset-config-filter-check" :class="{ selected: selectedSmallCategory === '' }"></span>
                    <span class="asset-config-filter-option-label">全部小类</span>
                  </button>

                  <div v-if="isSmallCategoryOptionsLoading" class="asset-config-filter-message">加载中...</div>

                  <template v-else-if="smallCategoryOptions.length">
                    <button
                      v-for="option in smallCategoryOptions"
                      :key="option"
                      class="asset-config-filter-option"
                      :class="{ selected: selectedSmallCategory === option }"
                      type="button"
                      @click.stop="selectSmallCategory(option)"
                    >
                      <span class="asset-config-filter-check" :class="{ selected: selectedSmallCategory === option }"></span>
                      <span class="asset-config-filter-option-label">{{ option }}</span>
                    </button>
                  </template>

                  <div v-else class="asset-config-filter-message">
                    <span>{{ smallCategoryOptionsError || '暂无小类选项' }}</span>
                    <button
                      v-if="smallCategoryOptionsError"
                      type="button"
                      @click.stop="loadSmallCategoryOptions"
                    >
                      重试
                    </button>
                  </div>
                </div>
              </div>

              <div class="asset-config-filter-wrap" @click.stop>
                <button
                  class="asset-config-filter-trigger"
                  :class="{ active: isStatusMenuOpen() || selectedStatus !== '' }"
                  type="button"
                  @click.stop="toggleStatusMenu"
                >
                  <span>{{ selectedStatus ? selectedStatusLabel : '状态' }}</span>
                  <span class="asset-config-filter-trigger-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path :d="isStatusMenuOpen() ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
                    </svg>
                  </span>
                </button>

                <div v-if="isStatusMenuOpen()" class="asset-config-filter-menu">
                  <button
                    v-for="option in STATUS_OPTIONS"
                    :key="option.value || 'all'"
                    class="asset-config-filter-option"
                    :class="{ selected: selectedStatus === option.value }"
                    type="button"
                    @click.stop="selectStatus(option.value)"
                  >
                    <span class="asset-config-filter-check" :class="{ selected: selectedStatus === option.value }"></span>
                    <span class="asset-config-filter-option-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <button
                v-if="hasFilters"
                class="vulnerabilities-clear-button"
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

            <div v-if="showInlineError || showBlockingError" class="asset-config-alert" :class="{ 'is-blocking': showBlockingError }" role="alert">
              <div>
                <strong>资产配置中心加载失败</strong>
                <p>{{ listError }}</p>
              </div>
              <button class="asset-config-panel-link" type="button" @click="retryLoad">重试</button>
            </div>

            <div class="asset-config-table">
              <div class="asset-config-table-head">
                <span class="asset-config-col is-main">项名称</span>
                <span class="asset-config-col">大分类</span>
                <span class="asset-config-col">小分类</span>
                <span class="asset-config-col">状态</span>
                <span class="asset-config-col">说明</span>
                <span class="asset-config-col is-actions">操作</span>
              </div>

              <div v-if="showInitialLoading" class="asset-config-skeleton-list" aria-hidden="true">
                <div v-for="index in 6" :key="index" class="asset-config-skeleton-row">
                  <span class="asset-config-skeleton is-main"></span>
                  <span class="asset-config-skeleton"></span>
                  <span class="asset-config-skeleton"></span>
                  <span class="asset-config-skeleton is-status"></span>
                  <span class="asset-config-skeleton"></span>
                  <span class="asset-config-skeleton is-actions"></span>
                </div>
              </div>

              <template v-else>
                <div v-if="normalizedRows.length" class="asset-config-table-body">
                  <div v-for="row in normalizedRows" :key="row.id" class="asset-config-table-row">
                    <div class="asset-config-cell is-main">
                      <strong>{{ row.item_name }}</strong>
                    </div>

                    <div class="asset-config-cell">
                      <strong>{{ row.bigCategoryLabel }}</strong>
                    </div>

                    <div class="asset-config-cell">
                      <span>{{ row.small_category || '--' }}</span>
                    </div>

                    <div class="asset-config-cell asset-config-cell--status">
                      <span class="asset-config-status-pill" :class="`is-${row.status}`">{{ row.statusLabel }}</span>
                    </div>

                    <div class="asset-config-cell asset-config-cell--description">
                      <span>{{ row.description || '--' }}</span>
                    </div>

                    <div class="asset-config-cell is-actions">
                      <button
                        class="asset-config-row-action"
                        type="button"
                        :aria-label="`编辑 ${row.item_name}`"
                        @click="openEditDialog(row)"
                      >
                        <span class="asset-config-row-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M4 20h4" />
                            <path d="M14.5 5.5 18.5 9.5 9 19H5v-4Z" />
                            <path d="m13 7 4 4" />
                          </svg>
                        </span>
                      </button>

                      <button
                        class="asset-config-row-action is-danger"
                        type="button"
                        :aria-label="`删除 ${row.item_name}`"
                        @click="openDeleteDialog(row)"
                      >
                        <span class="asset-config-row-action-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                            <path d="M5 7h14" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
                            <path d="M7 7l1 12h8l1-12" />
                          </svg>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div v-else-if="showEmptyState" class="asset-config-empty-state">
                  <strong>没有匹配的资产配置项</strong>
                  <p>试试调整筛选条件，或者新建一条配置项。</p>
                </div>
              </template>
            </div>

            <footer class="asset-config-pagination">
              <div class="asset-config-pagination-meta">
                <span>{{ pageSummary }}</span>
              </div>
              <div class="asset-config-pagination-actions">
                <button
                  class="asset-config-pagination-arrow"
                  type="button"
                  :disabled="currentPage <= 1 || isLoading || isRefreshing"
                  aria-label="上一页"
                  @click="currentPage = Math.max(1, currentPage - 1)"
                >
                  <span class="sr-only">上一页</span>
                  <span class="asset-config-pagination-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                  </span>
                </button>

                <button
                  class="asset-config-pagination-arrow"
                  type="button"
                  :disabled="currentPage >= totalPages || isLoading || isRefreshing"
                  aria-label="下一页"
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                >
                  <span class="sr-only">下一页</span>
                  <span class="asset-config-pagination-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </button>
              </div>
            </footer>
          </section>
        </section>

        <div v-if="isFormDialogOpen" class="asset-config-dialog-overlay" role="presentation" @click.self="closeFormDialog">
          <section
            class="asset-config-dialog"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'asset-config-dialog-title'"
          >
            <header class="asset-config-dialog-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryLabel }}</span>
                <h2 id="asset-config-dialog-title">{{ formTitle }}</h2>
              </div>
              <button class="asset-config-dialog-close" type="button" aria-label="关闭" @click="closeFormDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </header>

            <form class="asset-config-dialog-form" @submit.prevent="submitForm">
              <div class="asset-config-dialog-grid">
                <label>
                  <span>项名称 *</span>
                  <input v-model="formState.item_name" type="text" placeholder="例如：10.12.0.0/17" autocomplete="off" />
                </label>

                <label>
                  <span>大分类 *</span>
                  <div
                    class="asset-config-dialog-select"
                    :class="{ 'is-open': isFormCategoryMenuOpen() }"
                    @click.stop
                  >
                    <button
                      class="asset-config-dialog-select-button"
                      type="button"
                      @click.stop="toggleFormCategoryMenu"
                    >
                      <span>{{ selectedFormCategoryLabel }}</span>
                      <svg class="asset-config-dialog-select-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
                        <path d="M3.5 6 8 10.5 12.5 6" />
                      </svg>
                    </button>

                    <div v-if="isFormCategoryMenuOpen()" class="asset-config-dialog-select-menu">
                      <button
                        v-for="option in FORM_CATEGORY_OPTIONS"
                        :key="option.value"
                        class="asset-config-dialog-select-option"
                        :class="{ 'is-selected': formState.big_category === option.value }"
                        type="button"
                        @click.stop="selectFormCategory(option.value)"
                      >
                        <span class="asset-config-dialog-select-check" :class="{ 'is-selected': formState.big_category === option.value }" aria-hidden="true"></span>
                        <span class="asset-config-dialog-select-option-copy">
                          <strong>{{ option.label }}</strong>
                        </span>
                      </button>
                    </div>
                  </div>
                </label>

                <label>
                  <span>小分类 *</span>
                  <div
                    class="asset-config-dialog-combobox"
                    :class="{ 'is-open': isFormSmallCategoryMenuOpen() }"
                    @click.stop
                  >
                    <input
                      v-model="formState.small_category"
                      type="text"
                      placeholder="例如：BFE 资产 / 办公接入区"
                      autocomplete="off"
                      role="combobox"
                      :aria-expanded="isFormSmallCategoryMenuOpen() ? 'true' : 'false'"
                      aria-controls="asset-config-small-category-options"
                      @focus="openFormSmallCategoryMenu"
                      @input="handleFormSmallCategoryInput"
                      @keydown.escape.stop="closeFilterMenu"
                    />
                    <span class="asset-config-dialog-combobox-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor">
                        <path d="M3.5 6 8 10.5 12.5 6" />
                      </svg>
                    </span>

                    <div
                      v-if="isFormSmallCategoryMenuOpen()"
                      id="asset-config-small-category-options"
                      class="asset-config-dialog-combobox-menu"
                      role="listbox"
                    >
                      <div v-if="isFormSmallCategoryOptionsLoading" class="asset-config-dialog-combobox-message">加载中...</div>

                      <template v-else-if="filteredFormSmallCategoryOptions.length">
                        <button
                          v-for="option in filteredFormSmallCategoryOptions"
                          :key="option"
                          class="asset-config-dialog-combobox-option"
                          :class="{ 'is-selected': formState.small_category === option }"
                          type="button"
                          role="option"
                          :aria-selected="formState.small_category === option ? 'true' : 'false'"
                          @click.stop="selectFormSmallCategoryOption(option)"
                        >
                          <span class="asset-config-dialog-combobox-check" :class="{ 'is-selected': formState.small_category === option }" aria-hidden="true"></span>
                          <span class="asset-config-dialog-combobox-option-copy">
                            <strong>{{ option }}</strong>
                          </span>
                        </button>
                      </template>

                      <div v-else class="asset-config-dialog-combobox-message">
                        <span>{{ formSmallCategoryOptionsError || '暂无匹配小类，可直接输入' }}</span>
                        <button
                          v-if="formSmallCategoryOptionsError"
                          type="button"
                          @click.stop="loadFormSmallCategoryOptions(formState.big_category)"
                        >
                          重试
                        </button>
                      </div>
                    </div>
                  </div>
                </label>

                <label>
                  <span>状态 *</span>
                  <div class="asset-config-dialog-status" role="radiogroup" aria-label="状态">
                    <button
                      v-for="option in FORM_STATUS_OPTIONS"
                      :key="option.value"
                      type="button"
                      class="asset-config-dialog-status-option"
                      :class="{ active: formState.status === option.value }"
                      :aria-pressed="formState.status === option.value"
                      @click="formState.status = option.value"
                    >
                      <span class="asset-config-dialog-status-mark" :class="`is-${option.tone}`" aria-hidden="true"></span>
                      <span class="asset-config-dialog-status-copy">
                        <strong>{{ option.label }}</strong>
                      </span>
                    </button>
                  </div>
                </label>
              </div>

              <label class="asset-config-dialog-textarea">
                <span>说明</span>
                <textarea v-model="formState.description" rows="4" placeholder="补充配置项说明，可选"></textarea>
              </label>

              <p v-if="formError" class="asset-config-dialog-error">{{ formError }}</p>

              <footer class="asset-config-dialog-actions">
                <button class="asset-config-dialog-button is-ghost" type="button" @click="closeFormDialog">
                  取消
                </button>
                <button class="asset-config-dialog-button" type="submit" :disabled="isSaving">
                  {{ isSaving ? '保存中...' : '保存配置项' }}
                </button>
              </footer>
            </form>
          </section>
        </div>

        <div v-if="isDeleteDialogOpen" class="asset-config-dialog-overlay" role="presentation" @click.self="closeDeleteDialog">
          <section class="asset-config-dialog asset-config-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="asset-config-delete-title">
            <header class="asset-config-dialog-head">
              <div>
                <span class="asset-config-panel-kicker">删除确认</span>
                <h2 id="asset-config-delete-title">删除资产配置项</h2>
              </div>
              <button class="asset-config-dialog-close" type="button" aria-label="关闭" @click="closeDeleteDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </header>

            <div class="asset-config-dialog-body">
              <p>
                确认删除 <strong>{{ deleteTargetLabel }}</strong> 吗？
              </p>
              <p class="asset-config-dialog-summary">{{ deleteTargetSummary || '--' }}</p>
            </div>

            <p v-if="deleteError" class="asset-config-dialog-error">{{ deleteError }}</p>

            <footer class="asset-config-dialog-actions">
              <button class="asset-config-dialog-button is-ghost" type="button" @click="closeDeleteDialog">
                取消
              </button>
              <button class="asset-config-dialog-button is-danger" type="button" :disabled="isDeleting" @click="confirmDelete">
                {{ isDeleting ? '删除中...' : '确认删除' }}
              </button>
            </footer>
          </section>
        </div>
      </main>
    </template>
  </AppShell>
</template>
