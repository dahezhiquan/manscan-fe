<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import {
  ASSET_CONFIG_CATEGORY_ORDER,
  ASSET_CONFIG_CATEGORY_META,
  createAssetConfigState,
  getAssetConfigCategoryMeta
} from '../data/asset-config'
import { formatCount, formatDateTime } from '../utils/scanTask'
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

const categories = ref(loadAssetConfigState())
const activeCategoryKey = ref(categories.value[0]?.key ?? ASSET_CONFIG_CATEGORY_ORDER[0])
const activeGroupId = ref(categories.value[0]?.groups[0]?.id ?? '')
const groupSearch = ref('')
const lastActionMessage = ref('按分组管理四类全局配置。')
const isGroupDialogOpen = ref(false)
const isItemDialogOpen = ref(false)
const groupDialogMode = ref('create')
const itemDialogMode = ref('create')
const groupDialogError = ref('')
const itemDialogError = ref('')

const groupForm = reactive(createEmptyGroupForm())
const itemForm = reactive(createEmptyItemForm())

const statusMetaMap = {
  enabled: { label: '启用', tone: 'low' },
  paused: { label: '暂停', tone: 'medium' }
}

const summaryCards = computed(() => [
  {
    label: '配置分组',
    value: formatCount(totalGroupCount.value),
    note: '覆盖全部配置域'
  },
  {
    label: '配置条目',
    value: formatCount(totalEntryCount.value),
    note: '按组统一管理'
  },
  {
    label: '启用条目',
    value: formatCount(enabledEntryCount.value),
    note: '当前生效项'
  },
  {
    label: '最近更新',
    value: latestUpdatedLabel.value,
    note: lastActionMessage.value
  }
])

const categoryTabs = computed(() =>
  ASSET_CONFIG_CATEGORY_ORDER.map((key) => {
    const category = categories.value.find((item) => item.key === key)
    const meta = getAssetConfigCategoryMeta(key)
    const groups = category?.groups ?? []
    return {
      key,
      meta,
      groupCount: groups.length,
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

const visibleGroups = computed(() => {
  const keyword = groupSearch.value.trim().toLowerCase()
  const groups = activeGroups.value

  if (!keyword) {
    return groups
  }

  return groups.filter((group) =>
    [group.name, group.description, group.owner, group.scope, ...(group.tags ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  )
})

const activeGroup = computed(
  () => activeGroups.value.find((group) => group.id === activeGroupId.value) ?? activeGroups.value[0] ?? null
)

const activeEntries = computed(() => activeGroup.value?.entries ?? [])
const activeGroupMeta = computed(() => ({
  status: getStatusMeta(activeGroup.value?.status),
  updatedAt: formatDisplayDate(activeGroup.value?.updatedAt),
  tags: activeGroup.value?.tags ?? []
}))

const activeGroupMetrics = computed(() => [
  { label: '条目数量', value: formatCount(activeEntries.value.length) },
  { label: '负责人', value: activeGroup.value?.owner || '--' },
  { label: '作用范围', value: activeGroup.value?.scope || '--' },
  { label: '最后更新', value: activeGroupMeta.value.updatedAt }
])

const activeGroupDialogTitle = computed(() =>
  groupDialogMode.value === 'create' ? '新增分组' : '编辑分组'
)

const activeItemDialogTitle = computed(() =>
  itemDialogMode.value === 'create' ? '新增条目' : '编辑条目'
)

const itemFieldMeta = computed(() => activeCategoryMeta.value)

const totalGroupCount = computed(() =>
  categories.value.reduce((total, category) => total + (category.groups?.length ?? 0), 0)
)

const totalEntryCount = computed(() =>
  categories.value.reduce(
    (total, category) =>
      total + (category.groups ?? []).reduce((groupTotal, group) => groupTotal + (group.entries?.length ?? 0), 0),
    0
  )
)

const enabledEntryCount = computed(() =>
  categories.value.reduce(
    (total, category) =>
      total +
      (category.groups ?? []).reduce(
        (groupTotal, group) =>
          groupTotal + (group.entries ?? []).filter((entry) => normalizeStatus(entry.status) === 'enabled').length,
        0
      ),
    0
  )
)

const latestUpdatedLabel = computed(() => {
  const latest = categories.value
    .flatMap((category) => category.groups ?? [])
    .map((group) => group.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  return latest ? formatSummaryDate(latest) : '--'
})

watch(
  activeCategoryKey,
  () => {
    syncActiveGroup()
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
    activeGroupId.value = ''
    return
  }

  const currentGroupExists = activeCategory.value.groups.some((group) => group.id === activeGroupId.value)
  if (!currentGroupExists) {
    activeGroupId.value = activeCategory.value.groups[0]?.id ?? ''
  }
}

function selectCategory(key) {
  if (!key || key === activeCategoryKey.value) {
    return
  }

  activeCategoryKey.value = key
  groupSearch.value = ''
}

function selectGroup(groupId) {
  activeGroupId.value = groupId
}

function openGroupDialog(mode, group = null) {
  if (mode === 'create') {
    groupDialogMode.value = mode
    groupDialogError.value = ''
    isGroupDialogOpen.value = true
    resetGroupForm()
    groupForm.categoryKey = activeCategoryKey.value
    return
  }

  const currentGroup = group ?? activeGroup.value
  if (!currentGroup) {
    groupDialogError.value = '请先选择一个分组。'
    return
  }

  groupDialogMode.value = mode
  groupDialogError.value = ''
  isGroupDialogOpen.value = true
  populateGroupForm(currentGroup)
}

function openItemDialog(mode, item = null) {
  if (mode === 'create') {
    if (!activeGroup.value) {
      itemDialogError.value = '请先选择一个分组。'
      return
    }

    itemDialogMode.value = mode
    itemDialogError.value = ''
    isItemDialogOpen.value = true
    resetItemForm()
    itemForm.groupId = activeGroup.value?.id ?? ''
    itemForm.scope = ''
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
}

function closeGroupDialog() {
  isGroupDialogOpen.value = false
  groupDialogError.value = ''
}

function closeItemDialog() {
  isItemDialogOpen.value = false
  itemDialogError.value = ''
}

function handleGroupSubmit() {
  const name = groupForm.name.trim()
  if (!name) {
    groupDialogError.value = '请先填写分组名称。'
    return
  }

  const category = activeCategory.value
  if (!category) {
    groupDialogError.value = '当前没有可用的配置域。'
    return
  }

  const tags = normalizeListInput(groupForm.tags)
  const payload = {
    id: groupForm.id || createKey('group'),
    name,
    description: groupForm.description.trim(),
    owner: groupForm.owner.trim() || 'SecOps',
    scope: groupForm.scope.trim() || '未指定',
    status: normalizeStatus(groupForm.status),
    tags,
    updatedAt: new Date().toISOString(),
    entries: groupForm.id
      ? findGroupById(groupForm.id)?.entries?.map((entry) => ({ ...entry })) ?? []
      : []
  }

  if (groupForm.id) {
    const targetGroup = findGroupById(groupForm.id)
    if (!targetGroup) {
      groupDialogError.value = '未找到要编辑的分组。'
      return
    }

    Object.assign(targetGroup, payload)
    lastActionMessage.value = `已更新「${payload.name}」分组。`
  } else {
    category.groups.unshift({
      ...payload,
      entries: []
    })
    lastActionMessage.value = `已新增「${payload.name}」分组。`
  }

  activeGroupId.value = payload.id
  closeGroupDialog()
}

function handleItemSubmit() {
  const group = activeGroup.value
  if (!group) {
    itemDialogError.value = '请先选择一个分组。'
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
    scope: itemForm.scope.trim() || '未指定',
    note: itemForm.note.trim(),
    status: normalizeStatus(itemForm.status)
  }

  const existingIndex = group.entries.findIndex((entry) => entry.id === itemForm.id)
  if (existingIndex >= 0) {
    group.entries.splice(existingIndex, 1, payload)
    lastActionMessage.value = `已更新「${value}」条目。`
  } else {
    group.entries.push(payload)
    lastActionMessage.value = `已新增「${value}」条目。`
  }

  group.updatedAt = new Date().toISOString()
  closeItemDialog()
}

function handleResetView() {
  groupSearch.value = ''
  activeCategoryKey.value = categories.value[0]?.key ?? ASSET_CONFIG_CATEGORY_ORDER[0]
  activeGroupId.value = categories.value[0]?.groups[0]?.id ?? ''
  lastActionMessage.value = '已恢复当前视图。'
}

function handleRefresh() {
  closeGroupDialog()
  closeItemDialog()
  handleResetView()
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }

  if (isItemDialogOpen.value) {
    closeItemDialog()
  }

  if (isGroupDialogOpen.value) {
    closeGroupDialog()
  }
}

function formatDisplayDate(value) {
  return formatDateTime(value)
}

function formatSummaryDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value ?? '--')
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date)
}

function formatStatusLabel(value) {
  return getStatusMeta(value).label
}

function getStatusMeta(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (!normalized) {
    return { label: '未知', tone: 'unknown' }
  }

  return statusMetaMap[normalized] ?? { label: '未知', tone: 'unknown' }
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase() || 'enabled'
}

function normalizeListInput(value) {
  return String(value ?? '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function createKey(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${Date.now()}-${randomPart}`
}

function createEmptyGroupForm() {
  return {
    id: '',
    name: '',
    description: '',
    owner: '',
    scope: '',
    tags: '',
    status: 'enabled',
    categoryKey: ''
  }
}

function createEmptyItemForm() {
  return {
    id: '',
    groupId: '',
    value: '',
    scope: '',
    note: '',
    status: 'enabled'
  }
}

function resetGroupForm() {
  Object.assign(groupForm, createEmptyGroupForm(), {
    categoryKey: activeCategoryKey.value
  })
}

function populateGroupForm(group) {
  Object.assign(groupForm, {
    id: group.id,
    name: group.name,
    description: group.description,
    owner: group.owner,
    scope: group.scope,
    tags: (group.tags ?? []).join(', '),
    status: normalizeStatus(group.status),
    categoryKey: activeCategoryKey.value
  })
}

function resetItemForm() {
  Object.assign(itemForm, createEmptyItemForm())
}

function populateItemForm(item) {
  Object.assign(itemForm, {
    id: item.id,
    groupId: activeGroup.value?.id ?? '',
    value: item.value,
    scope: item.scope,
    note: item.note,
    status: normalizeStatus(item.status)
  })
}

function findGroupById(groupId) {
  return categories.value.flatMap((category) => category.groups ?? []).find((group) => group.id === groupId) ?? null
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

    return parsed
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
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
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
        <section class="asset-config-hero">
          <div class="asset-config-hero-copy">
            <span class="asset-config-kicker">ASSET CONFIG</span>
            <h1>资产配置中心</h1>
            <p>
              统一维护全局扫描白名单、User-Agent、网络网段和被动流量地址，按分组查看、添加和编辑。
            </p>
            <div class="asset-config-hero-meta">
              <span
                v-for="card in summaryCards"
                :key="card.label"
                class="asset-config-hero-chip"
              >
                <strong>{{ card.value }}</strong>
                <span>{{ card.label }}</span>
              </span>
            </div>
          </div>

          <div class="asset-config-hero-actions">
            <button class="asset-config-action-button" type="button" @click="openGroupDialog('create')">
              <span class="asset-config-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </span>
              <span>新增分组</span>
            </button>

            <button
              class="asset-config-icon-button"
              type="button"
              aria-label="重置当前视图"
              @click="handleRefresh"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v5h-5" />
              </svg>
            </button>
          </div>
        </section>

        <section class="asset-config-summary">
          <article v-for="card in summaryCards" :key="card.label" class="asset-config-summary-card">
            <span class="asset-config-summary-label">{{ card.label }}</span>
            <strong class="asset-config-summary-value">{{ card.value }}</strong>
            <p>{{ card.note }}</p>
          </article>
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
              <small>{{ tab.groupCount }} 组 · {{ tab.entryCount }} 项</small>
            </span>
          </button>
        </section>

        <section class="asset-config-content">
          <aside class="asset-config-panel asset-config-groups-panel">
            <header class="asset-config-panel-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryMeta.label }}</span>
                <h2>分组列表</h2>
                <p>{{ activeCategoryMeta.summary }}</p>
              </div>

              <button class="asset-config-panel-link" type="button" @click="openGroupDialog('create')">
                新增分组
              </button>
            </header>

            <label class="asset-config-search">
              <input
                v-model="groupSearch"
                type="text"
                placeholder="搜索分组名称、负责人或标签"
                autocomplete="off"
              />
              <span class="asset-config-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
            </label>

            <div class="asset-config-group-list">
              <div
                v-for="group in visibleGroups"
                :key="group.id"
                class="asset-config-group-row"
                :class="{ active: group.id === activeGroupId }"
              >
                <button
                  class="asset-config-group-row-main"
                  type="button"
                  @click="selectGroup(group.id)"
                >
                  <div class="asset-config-group-row-top">
                    <strong>{{ group.name }}</strong>
                    <span class="asset-config-status-pill" :class="`is-${normalizeStatus(group.status)}`">
                      {{ formatStatusLabel(group.status) }}
                    </span>
                  </div>
                  <p>{{ group.description }}</p>
                  <div class="asset-config-group-row-meta">
                    <span>{{ group.owner }}</span>
                    <span>{{ group.scope }}</span>
                    <span>{{ group.entries.length }} 项</span>
                    <span>{{ formatDateTime(group.updatedAt) }}</span>
                  </div>
                  <div v-if="group.tags?.length" class="asset-config-tag-row">
                    <span v-for="tag in group.tags" :key="tag" class="asset-config-tag">#{{ tag }}</span>
                  </div>
                </button>

                <button
                  class="asset-config-row-action"
                  type="button"
                  :aria-label="`编辑分组 ${group.name}`"
                  @click.stop="openGroupDialog('edit', group)"
                >
                  编辑
                </button>
              </div>

              <div v-if="visibleGroups.length === 0" class="asset-config-empty-state">
                <strong>没有匹配到分组</strong>
                <p>换个关键词试试，或者直接新增一个分组。</p>
              </div>
            </div>
          </aside>

          <section class="asset-config-panel asset-config-detail-panel">
            <header class="asset-config-detail-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryMeta.label }}</span>
                <h2>{{ activeGroup?.name ?? '请选择一个分组' }}</h2>
                <p>{{ activeGroup?.description ?? '当前配置域里还没有可展示的分组。' }}</p>
              </div>

              <div class="asset-config-detail-actions">
                <button
                  class="asset-config-action-button"
                  type="button"
                  :disabled="!activeGroup"
                  @click="openItemDialog('create')"
                >
                  <span class="asset-config-action-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </span>
                  <span>新增条目</span>
                </button>

                <button
                  class="asset-config-action-button is-secondary"
                  type="button"
                  :disabled="!activeGroup"
                  @click="openGroupDialog('edit', activeGroup)"
                >
                  编辑分组
                </button>
              </div>
            </header>

            <div class="asset-config-detail-meta">
              <span class="asset-config-meta-pill">负责人 {{ activeGroup?.owner ?? '--' }}</span>
              <span class="asset-config-meta-pill">范围 {{ activeGroup?.scope ?? '--' }}</span>
              <span class="asset-config-meta-pill" :class="`is-${activeGroupMeta.status.tone}`">
                {{ activeGroupMeta.status.label }}
              </span>
              <span class="asset-config-meta-pill">更新于 {{ activeGroupMeta.updatedAt }}</span>
            </div>

            <div v-if="activeGroupMeta.tags.length" class="asset-config-tag-row asset-config-tag-row--detail">
              <span v-for="tag in activeGroupMeta.tags" :key="tag" class="asset-config-tag">#{{ tag }}</span>
            </div>

            <div class="asset-config-detail-stats">
              <article v-for="metric in activeGroupMetrics" :key="metric.label" class="asset-config-stat">
                <span>{{ metric.label }}</span>
                <strong>{{ metric.value }}</strong>
              </article>
            </div>

            <div class="asset-config-entry-board">
              <div class="asset-config-entry-head">
                <span class="asset-config-entry-col is-main">{{ itemFieldMeta.itemLabel }}</span>
                <span class="asset-config-entry-col">{{ itemFieldMeta.itemScopeLabel }}</span>
                <span class="asset-config-entry-col">状态</span>
                <span class="asset-config-entry-col">说明</span>
                <span class="asset-config-entry-col">操作</span>
              </div>

              <div v-if="activeEntries.length > 0" class="asset-config-entry-list">
                <div v-for="entry in activeEntries" :key="entry.id" class="asset-config-entry-row">
                  <div class="asset-config-entry-main">
                    <strong>{{ entry.value }}</strong>
                    <span>{{ entry.note || '暂无说明' }}</span>
                  </div>
                  <div class="asset-config-entry-text">{{ entry.scope }}</div>
                  <div class="asset-config-entry-status">
                    <span class="asset-config-status-pill" :class="`is-${normalizeStatus(entry.status)}`">
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
                <strong>当前分组还没有条目</strong>
                <p>先新增一个条目，补齐这组配置。</p>
              </div>
            </div>
          </section>
        </section>

        <div
          v-if="isGroupDialogOpen"
          class="asset-config-dialog-overlay"
          role="presentation"
          @click.self="closeGroupDialog"
        >
          <section
            class="asset-config-dialog"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="'asset-config-group-dialog-title'"
          >
            <header class="asset-config-dialog-head">
              <div>
                <span class="asset-config-panel-kicker">{{ activeCategoryMeta.label }}</span>
                <h2 id="asset-config-group-dialog-title">{{ activeGroupDialogTitle }}</h2>
              </div>
              <button class="asset-config-dialog-close" type="button" aria-label="关闭" @click="closeGroupDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </svg>
              </button>
            </header>

            <form class="asset-config-dialog-form" @submit.prevent="handleGroupSubmit">
              <div class="asset-config-dialog-grid">
                <label>
                  <span>分组名称</span>
                  <input v-model="groupForm.name" type="text" placeholder="例如：生产核心系统" />
                </label>

                <label>
                  <span>负责人</span>
                  <input v-model="groupForm.owner" type="text" placeholder="例如：SecOps" />
                </label>

                <label>
                  <span>生效范围</span>
                  <input v-model="groupForm.scope" type="text" placeholder="例如：主动扫描 / 被动采集" />
                </label>

                <label>
                  <span>状态</span>
                  <select v-model="groupForm.status">
                    <option value="enabled">启用</option>
                    <option value="paused">暂停</option>
                  </select>
                </label>
              </div>

              <label class="asset-config-dialog-textarea">
                <span>分组说明</span>
                <textarea v-model="groupForm.description" rows="3" placeholder="描述这组配置的使用边界和注意事项"></textarea>
              </label>

              <label class="asset-config-dialog-textarea">
                <span>标签</span>
                <textarea
                  v-model="groupForm.tags"
                  rows="2"
                  placeholder="多个标签用英文逗号或换行分隔"
                ></textarea>
              </label>

              <p v-if="groupDialogError" class="asset-config-dialog-error">{{ groupDialogError }}</p>

              <footer class="asset-config-dialog-actions">
                <button class="asset-config-dialog-button is-ghost" type="button" @click="closeGroupDialog">
                  取消
                </button>
                <button class="asset-config-dialog-button" type="submit">保存分组</button>
              </footer>
            </form>
          </section>
        </div>

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
                  <span>{{ itemFieldMeta.itemValueLabel }}</span>
                  <input v-model="itemForm.value" type="text" :placeholder="itemFieldMeta.itemPlaceholder" />
                </label>

                <label>
                  <span>{{ itemFieldMeta.itemScopeLabel }}</span>
                  <input v-model="itemForm.scope" type="text" :placeholder="itemFieldMeta.itemScopePlaceholder" />
                </label>

                <label>
                  <span>状态</span>
                  <select v-model="itemForm.status">
                    <option value="enabled">启用</option>
                    <option value="paused">暂停</option>
                  </select>
                </label>
              </div>

              <label class="asset-config-dialog-textarea">
                <span>说明</span>
                <textarea v-model="itemForm.note" rows="3" placeholder="补充这个条目的用途、来源或约束"></textarea>
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
