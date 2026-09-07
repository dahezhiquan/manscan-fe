<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import {
  ASSET_CONFIG_CATEGORY_ORDER,
  ASSET_CONFIG_CATEGORY_META,
  createAssetConfigState,
  normalizeAssetConfigState,
  getAssetConfigCategoryMeta
} from '../data/asset-config'
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

const STORAGE_KEY = 'manscan.asset-config-center.v1'
const FILTER_MENU_KEYS = {
  group: 'group',
  status: 'status'
}

const categories = ref(loadAssetConfigState())
const activeCategoryKey = ref(categories.value[0]?.key ?? ASSET_CONFIG_CATEGORY_ORDER[0])
const filtersRef = ref(null)
const entrySearch = ref('')
const selectedGroupFilter = ref('all')
const selectedStatusFilter = ref('all')
const activeFilterMenu = ref('')
const isItemDialogOpen = ref(false)
const itemDialogMode = ref('create')
const itemDialogError = ref('')
const groupInfoMenuOpen = ref(false)

const itemForm = reactive(createEmptyItemForm())
let groupInfoCloseTimer = null

const statusMetaMap = {
  enabled: { label: '启用', tone: 'low' },
  disabled: { label: '未启用', tone: 'medium' }
}

const categoryTabs = computed(() =>
  ASSET_CONFIG_CATEGORY_ORDER.map((key) => {
    const category = categories.value.find((item) => item.key === key)
    const meta = getAssetConfigCategoryMeta(key)
    const groups = category?.groups ?? []
    return {
      key,
      meta,
      entryCount: groups.reduce((total, group) => total + (group.entries?.length ?? 0), 0)
    }
  })
)

const activeCategory = computed(
  () => categories.value.find((category) => category.key === activeCategoryKey.value) ?? categories.value[0] ?? null
)

const activeCategoryMeta = computed(() =>
  activeCategory.value ? getAssetConfigCategoryMeta(activeCategory.value.key) : ASSET_CONFIG_CATEGORY_META.whitelist
)

const activeGroups = computed(() => activeCategory.value?.groups ?? [])

const activeEntryRows = computed(() =>
  activeGroups.value.flatMap((group) =>
    (group.entries ?? []).map((entry) => ({
      id: entry.id,
      value: entry.value,
      note: entry.note,
      scope: entry.scope,
      status: normalizeStatus(entry.status),
      groupId: group.id,
      groupName: group.name,
      groupDescription: group.description,
      groupOwner: group.owner,
      groupScope: group.scope,
      groupTags: group.tags ?? []
    }))
  )
)

const groupFilterOptions = computed(() => {
  const allCount = activeEntryRows.value.length
  return [
    { value: 'all', label: '全部组', count: allCount },
    ...activeGroups.value.map((group) => ({
      value: group.id,
      label: group.name,
      count: (group.entries ?? []).length
    }))
  ]
})

const statusFilterOptions = computed(() => {
  const rows = activeEntryRows.value
  const statusKeys = ['enabled', 'disabled']

  return [
    { value: 'all', label: '全部状态', count: rows.length },
    ...statusKeys.map((value) => ({
      value,
      label: formatStatusLabel(value),
      count: rows.filter((row) => row.status === value).length
    }))
  ]
})

const selectedGroupLabel = computed(
  () => groupFilterOptions.value.find((item) => item.value === selectedGroupFilter.value)?.label ?? '组'
)

const selectedStatusLabel = computed(
  () => statusFilterOptions.value.find((item) => item.value === selectedStatusFilter.value)?.label ?? '状态'
)

const filteredEntryRows = computed(() => {
  const keyword = entrySearch.value.trim().toLowerCase()
  const groupFilter = selectedGroupFilter.value
  const statusFilter = selectedStatusFilter.value

  return activeEntryRows.value.filter((row) => {
    if (groupFilter !== 'all' && row.groupId !== groupFilter) {
      return false
    }

    if (statusFilter !== 'all' && row.status !== statusFilter) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      row.value,
      row.note,
      row.groupName,
      row.groupOwner,
      row.groupScope,
      row.status,
      ...row.groupTags
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const activeItemDialogTitle = computed(() =>
  itemDialogMode.value === 'create' ? '新增条目' : '编辑条目'
)

const itemFieldMeta = computed(() => activeCategoryMeta.value)
const itemSearchPlaceholder = computed(() => `搜索${itemFieldMeta.value.itemLabel}...`)
const groupInfoSuggestions = computed(() => {
  const keyword = normalizeGroupInfo(itemForm.groupInfo)
  const groups = activeGroups.value

  return groups
    .map((group, index) => {
      if (!keyword) {
        return { group, index, rank: 0 }
      }

      const fields = [group.id, group.name, group.scope, formatGroupDisplay(group)].map(normalizeGroupInfo)
      const exactMatch = fields.some((value) => value === keyword)
      const partialMatch = fields.some((value) => value.includes(keyword))

      return {
        group,
        index,
        rank: exactMatch ? 0 : partialMatch ? 1 : 2
      }
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.group)
})
const statusOptions = [
  { value: 'enabled', label: '启用', summary: '当前生效', tone: 'low' },
  { value: 'disabled', label: '未启用', summary: '暂不生效', tone: 'medium' }
]

const hasFilters = computed(
  () =>
    entrySearch.value.trim() !== '' ||
    selectedGroupFilter.value !== 'all' ||
    selectedStatusFilter.value !== 'all'
)

watch(
  activeCategoryKey,
  () => {
    syncFilterState()
  },
  { immediate: true }
)

watch(
  categories,
  () => {
    persistAssetConfigState()
  },
  { deep: true }
)

function syncActiveGroup() {
  if (!activeCategory.value) {
    return
  }

  const currentGroupExists = activeGroups.value.some((group) => group.id === selectedGroupFilter.value)
  if (!currentGroupExists) {
    selectedGroupFilter.value = 'all'
  }
}

function syncFilterState() {
  syncActiveGroup()
  closeFilterMenus()
}

function selectCategory(key) {
  if (!key || key === activeCategoryKey.value) {
    return
  }

  activeCategoryKey.value = key
}

function isMenuOpen(key) {
  return activeFilterMenu.value === key
}

function toggleFilterMenu(key) {
  activeFilterMenu.value = activeFilterMenu.value === key ? '' : key
}

function closeFilterMenus() {
  activeFilterMenu.value = ''
}

function selectGroupFilter(groupId) {
  selectedGroupFilter.value = groupId || 'all'
  closeFilterMenus()
}

function selectStatusFilter(status) {
  selectedStatusFilter.value = status || 'all'
  closeFilterMenus()
}

function openItemDialog(mode, item = null) {
  if (mode === 'create') {
    const defaultGroupInfo = resolveDefaultGroupInfo()
    if (!defaultGroupInfo) {
      itemDialogError.value = '请先选择一个筛选项。'
      return
    }

    itemDialogMode.value = mode
    itemDialogError.value = ''
    isItemDialogOpen.value = true
    resetItemForm(defaultGroupInfo)
    closeGroupInfoMenu()
    return
  }

  if (!item) {
    itemDialogError.value = '未找到要编辑的条目。'
    return
  }

  itemDialogMode.value = mode
  itemDialogError.value = ''
  isItemDialogOpen.value = true
  populateItemForm(item)
  closeGroupInfoMenu()
}

function closeItemDialog() {
  isItemDialogOpen.value = false
  itemDialogError.value = ''
  closeGroupInfoMenu()
}

function handleItemSubmit() {
  const groupInfo = itemForm.groupInfo.trim()
  const targetGroup = findGroupByInput(groupInfo)
  if (!targetGroup) {
    itemDialogError.value = '请输入有效的组信息。'
    return
  }

  const value = itemForm.value.trim()
  if (!value) {
    itemDialogError.value = `${itemFieldMeta.value.itemValueLabel}不能为空。`
    return
  }

  const payload = {
    id: itemForm.id || createKey('item'),
    value,
    scope: targetGroup.scope || '未指定',
    note: itemForm.note.trim(),
    status: normalizeStatus(itemForm.status)
  }

  const sourceGroup = findGroupById(itemForm.sourceGroupId || itemForm.groupId)
  if (sourceGroup && sourceGroup.id !== targetGroup.id) {
    const sourceIndex = sourceGroup.entries.findIndex((entry) => entry.id === itemForm.id)
    if (sourceIndex >= 0) {
      sourceGroup.entries.splice(sourceIndex, 1)
      sourceGroup.updatedAt = new Date().toISOString()
    }
  }

  const existingIndex = targetGroup.entries.findIndex((entry) => entry.id === itemForm.id)
  if (existingIndex >= 0) {
    targetGroup.entries.splice(existingIndex, 1, payload)
  } else {
    targetGroup.entries.push(payload)
  }

  targetGroup.updatedAt = new Date().toISOString()
  closeItemDialog()
}

function openGroupInfoMenu() {
  if (activeGroups.value.length === 0) {
    return
  }

  if (groupInfoCloseTimer) {
    window.clearTimeout(groupInfoCloseTimer)
    groupInfoCloseTimer = null
  }

  groupInfoMenuOpen.value = true
}

function closeGroupInfoMenu() {
  if (groupInfoCloseTimer) {
    window.clearTimeout(groupInfoCloseTimer)
    groupInfoCloseTimer = null
  }

  groupInfoMenuOpen.value = false
}

function handleGroupInfoInput() {
  openGroupInfoMenu()
}

function handleGroupInfoBlur() {
  groupInfoCloseTimer = window.setTimeout(() => {
    groupInfoMenuOpen.value = false
    groupInfoCloseTimer = null
  }, 120)
}

function selectGroupInfoOption(group) {
  if (!group) {
    return
  }

  itemForm.groupId = group.id
  itemForm.groupInfo = formatGroupDisplay(group)
  closeGroupInfoMenu()
}

function selectItemStatus(status) {
  itemForm.status = normalizeStatus(status)
}

function clearEntryFilters() {
  entrySearch.value = ''
  selectedGroupFilter.value = 'all'
  selectedStatusFilter.value = 'all'
  closeFilterMenus()
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    closeFilterMenus()
  }
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }

  if (groupInfoMenuOpen.value) {
    closeGroupInfoMenu()
    return
  }

  if (activeFilterMenu.value) {
    closeFilterMenus()
    return
  }

  if (isItemDialogOpen.value) {
    closeItemDialog()
  }
}

function isGroupFilterSelected(value) {
  return selectedGroupFilter.value === value
}

function isStatusFilterSelected(value) {
  return selectedStatusFilter.value === value
}

function formatStatusLabel(value) {
  return getStatusMeta(value).label
}

function getStatusMeta(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'enabled') {
    return statusMetaMap.enabled
  }

  return statusMetaMap.disabled
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase() === 'enabled' ? 'enabled' : 'disabled'
}

function resolveDefaultGroupId() {
  if (selectedGroupFilter.value !== 'all' && findGroupById(selectedGroupFilter.value)) {
    return selectedGroupFilter.value
  }

  return activeGroups.value[0]?.id ?? ''
}

function resolveDefaultGroupInfo() {
  const groupId = resolveDefaultGroupId()
  const group = groupId ? findGroupById(groupId) : null
  return group ? formatGroupDisplay(group) : ''
}

function findGroupById(groupId) {
  return activeGroups.value.find((group) => group.id === groupId) ?? null
}

function findGroupByInput(groupInfo) {
  const normalized = String(groupInfo ?? '').trim()
  if (!normalized) {
    return null
  }

  const normalizedKey = normalizeGroupInfo(normalized)
  const exactMatch = activeGroups.value.find((group) => {
    return [
      group.id,
      group.name,
      group.scope,
      formatGroupDisplay(group)
    ].some((value) => normalizeGroupInfo(value) === normalizedKey)
  })

  if (exactMatch) {
    return exactMatch
  }

  const partialMatches = activeGroups.value.filter((group) => {
    return [group.name, formatGroupDisplay(group)].some((value) => normalizeGroupInfo(value).includes(normalizedKey))
  })

  return partialMatches.length === 1 ? partialMatches[0] : null
}

function createKey(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${Date.now()}-${randomPart}`
}

function createEmptyItemForm() {
  return {
    id: '',
    sourceGroupId: '',
    groupId: '',
    groupInfo: '',
    value: '',
    note: '',
    status: 'enabled'
  }
}

function resetItemForm(groupInfo = '') {
  const group = findGroupByInput(groupInfo) ?? activeGroups.value[0] ?? null
  Object.assign(itemForm, createEmptyItemForm(), {
    groupId: group?.id ?? '',
    sourceGroupId: group?.id ?? '',
    groupInfo: group ? formatGroupDisplay(group) : ''
  })
}

function populateItemForm(item) {
  const group = findGroupById(item.groupId) ?? activeGroups.value[0] ?? null
  Object.assign(itemForm, {
    id: item.id,
    sourceGroupId: item.groupId,
    groupId: item.groupId || group?.id || '',
    groupInfo: group ? formatGroupDisplay(group) : '',
    value: item.value,
    note: item.note,
    status: normalizeStatus(item.status)
  })
}

function formatGroupDisplay(group) {
  if (!group) {
    return ''
  }

  return `${group.name} · ${group.scope}`
}

function normalizeGroupInfo(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function loadAssetConfigState() {
  if (typeof window === 'undefined') {
    return createAssetConfigState()
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) {
      return createAssetConfigState()
    }

    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) {
      return createAssetConfigState()
    }

    return normalizeAssetConfigState(parsed)
  } catch {
    return createAssetConfigState()
  }
}

function persistAssetConfigState() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories.value))
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('click', handleDocumentClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('click', handleDocumentClick)
  if (groupInfoCloseTimer) {
    window.clearTimeout(groupInfoCloseTimer)
    groupInfoCloseTimer = null
  }
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
            :key="tab.key"
            class="asset-config-tab"
            :class="{ active: tab.key === activeCategoryKey }"
            type="button"
            @click="selectCategory(tab.key)"
          >
            <span class="asset-config-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath(tab.meta.icon)" />
            </span>
            <span class="asset-config-tab-label">
              <strong>{{ tab.meta.label }}</strong>
              <small>{{ tab.entryCount }} 项</small>
            </span>
          </button>
        </section>

        <section class="asset-config-content">
          <section class="asset-config-panel asset-config-detail-panel">
            <header class="asset-config-detail-head">
              <div>
                <h2>配置内容</h2>
              </div>
            </header>

            <div ref="filtersRef" class="asset-config-toolbar" aria-label="配置筛选">
              <label class="asset-config-search-field">
                <input
                  v-model="entrySearch"
                  type="text"
                  :placeholder="itemSearchPlaceholder"
                  autocomplete="off"
                />
              </label>

              <div class="asset-config-filter-wrap" @click.stop>
                <button
                  class="asset-config-filter-trigger"
                  :class="{ active: isMenuOpen(FILTER_MENU_KEYS.group) || selectedGroupFilter !== 'all' }"
                  type="button"
                  @click.stop="toggleFilterMenu(FILTER_MENU_KEYS.group)"
                >
                  <span>{{ selectedGroupFilter === 'all' ? '筛选组' : selectedGroupLabel }}</span>
                </button>

                <div v-if="isMenuOpen(FILTER_MENU_KEYS.group)" class="asset-config-filter-menu">
                  <button
                    v-for="option in groupFilterOptions"
                    :key="option.value"
                    class="asset-config-filter-option"
                    :class="{ selected: isGroupFilterSelected(option.value) }"
                    type="button"
                    @click.stop="selectGroupFilter(option.value)"
                  >
                    <span class="asset-config-filter-check" :class="{ selected: isGroupFilterSelected(option.value) }"></span>
                    <span class="asset-config-filter-option-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div class="asset-config-filter-wrap" @click.stop>
                <button
                  class="asset-config-filter-trigger"
                  :class="{ active: isMenuOpen(FILTER_MENU_KEYS.status) || selectedStatusFilter !== 'all' }"
                  type="button"
                  @click.stop="toggleFilterMenu(FILTER_MENU_KEYS.status)"
                >
                  <span>{{ selectedStatusFilter === 'all' ? '状态' : selectedStatusLabel }}</span>
                </button>

                <div v-if="isMenuOpen(FILTER_MENU_KEYS.status)" class="asset-config-filter-menu">
                  <button
                    v-for="option in statusFilterOptions"
                    :key="option.value"
                    class="asset-config-filter-option"
                    :class="{ selected: isStatusFilterSelected(option.value) }"
                    type="button"
                    @click.stop="selectStatusFilter(option.value)"
                  >
                    <span class="asset-config-filter-check" :class="{ selected: isStatusFilterSelected(option.value) }"></span>
                    <span class="asset-config-filter-option-label">{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <button
                v-if="hasFilters"
                class="asset-config-clear-button"
                type="button"
                aria-label="清空筛选"
                title="清空筛选"
                @click="clearEntryFilters"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M15.8 8.2 8.2 15.8" />
                  <path d="M8.2 8.2 15.8 15.8" />
                  <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
                </svg>
              </button>

              <button
                class="asset-config-filter-trigger asset-config-create-trigger"
                type="button"
                :disabled="activeGroups.length === 0"
                @click="openItemDialog('create')"
              >
                <span>新增条目</span>
              </button>
            </div>

            <div class="asset-config-entry-board">
              <div class="asset-config-entry-head">
                <span class="asset-config-entry-col is-main">{{ itemFieldMeta.itemLabel }}</span>
                <span class="asset-config-entry-col">组信息</span>
                <span class="asset-config-entry-col">状态</span>
                <span class="asset-config-entry-col">说明</span>
                <span class="asset-config-entry-col">操作</span>
              </div>

              <div v-if="filteredEntryRows.length > 0" class="asset-config-entry-list">
                <div v-for="entry in filteredEntryRows" :key="`${entry.groupId}-${entry.id}`" class="asset-config-entry-row">
                  <div class="asset-config-entry-main">
                    <strong>{{ entry.value }}</strong>
                  </div>
                  <div class="asset-config-entry-group">
                    <div class="asset-config-entry-group-top">
                      <strong>{{ entry.groupName }}</strong>
                    </div>
                    <div class="asset-config-entry-group-meta">
                      <span>{{ entry.groupOwner }}</span>
                      <span>{{ entry.groupScope }}</span>
                    </div>
                  </div>
                  <div class="asset-config-entry-status">
                    <span class="asset-config-status-pill" :class="`is-${entry.status}`">
                      {{ formatStatusLabel(entry.status) }}
                    </span>
                  </div>
                  <div class="asset-config-entry-text">{{ entry.note || '--' }}</div>
                  <div class="asset-config-entry-actions">
                    <button
                      class="asset-config-row-action is-inline"
                      type="button"
                      :aria-label="`编辑条目 ${entry.value}`"
                      @click="openItemDialog('edit', entry)"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              </div>

              <div v-else class="asset-config-empty-state asset-config-empty-state--detail">
                <strong>没有匹配的条目</strong>
                <p>试试换个关键词，或者清空筛选条件。</p>
              </div>
            </div>
          </section>
        </section>

        <div
          v-if="isItemDialogOpen"
          class="asset-config-dialog-overlay"
          role="presentation"
          @click.self="closeItemDialog"
        >
          <section
            class="asset-config-dialog"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'asset-config-item-dialog-title'"
          >
            <header class="asset-config-dialog-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryMeta.label }}</span>
                <h2 id="asset-config-item-dialog-title">{{ activeItemDialogTitle }}</h2>
              </div>
              <button class="asset-config-dialog-close" type="button" aria-label="关闭" @click="closeItemDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </header>

            <form class="asset-config-dialog-form" @submit.prevent="handleItemSubmit">
              <div class="asset-config-dialog-grid">
                <label>
                  <span>{{ itemFieldMeta.itemLabel }}</span>
                  <input v-model="itemForm.value" type="text" :placeholder="itemFieldMeta.itemPlaceholder" />
                </label>

                <label>
                  <span>组信息</span>
                  <div class="asset-config-dialog-combobox">
                    <input
                      v-model.trim="itemForm.groupInfo"
                      type="text"
                      placeholder="输入组名称筛选，或直接手填"
                      autocomplete="off"
                      spellcheck="false"
                      @focus="openGroupInfoMenu"
                      @input="handleGroupInfoInput"
                      @blur="handleGroupInfoBlur"
                    />
                    <div v-if="groupInfoMenuOpen" class="asset-config-dialog-combobox-menu">
                      <button
                        v-for="group in groupInfoSuggestions"
                        :key="group.id"
                        class="asset-config-dialog-combobox-option"
                        type="button"
                        @mousedown.prevent="selectGroupInfoOption(group)"
                      >
                        <span class="asset-config-dialog-combobox-option-main">{{ group.name }}</span>
                        <span class="asset-config-dialog-combobox-option-sub">{{ group.scope }}</span>
                      </button>
                      <div v-if="groupInfoSuggestions.length === 0" class="asset-config-dialog-combobox-empty">
                        没有匹配项，仍可直接手填
                      </div>
                    </div>
                  </div>
                </label>

                <label>
                  <span>状态</span>
                  <div class="asset-config-dialog-status" role="radiogroup" aria-label="状态">
                    <button
                      v-for="option in statusOptions"
                      :key="option.value"
                      type="button"
                      class="asset-config-dialog-status-option"
                      :class="{ active: itemForm.status === option.value }"
                      :aria-pressed="itemForm.status === option.value"
                      @click="selectItemStatus(option.value)"
                    >
                      <span class="asset-config-dialog-status-mark" :class="`is-${option.tone}`" aria-hidden="true"></span>
                      <span class="asset-config-dialog-status-copy">
                        <strong>{{ option.label }}</strong>
                        <small>{{ option.summary }}</small>
                      </span>
                    </button>
                  </div>
                </label>
              </div>
              <label class="asset-config-dialog-textarea">
                <span>说明</span>
                <textarea v-model="itemForm.note" rows="3" placeholder="补充这个条目的说明"></textarea>
              </label>

              <p v-if="itemDialogError" class="asset-config-dialog-error">{{ itemDialogError }}</p>

              <footer class="asset-config-dialog-actions">
                <button class="asset-config-dialog-button is-ghost" type="button" @click="closeItemDialog">
                  取消
                </button>
                <button class="asset-config-dialog-button" type="submit">保存条目</button>
              </footer>
            </form>
          </section>
        </div>
      </main>
    </template>
  </AppShell>
</template>
