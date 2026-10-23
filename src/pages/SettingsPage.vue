<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { getThemeSettings, updateThemeSettings } from '../api/settings'
import { createUser, deleteUser, getUserList, updateUser } from '../api/users'
import ThirdPartyApiKeyManagement from '../components/settings/ThirdPartyApiKeyManagement.vue'
import AppShell from '../components/layout/AppShell.vue'
import { applyThemeSettings, cacheThemeSettings, getAppliedThemeSettings } from '../composables/useTheme'
import { THEME_OPTIONS } from '../constants/themes'
import { iconPath } from '../utils/icons'
import { normalizeThemeSettings } from '../utils/themeSettings'
import {
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
  normalizeUser,
  normalizeUserListResponse
} from '../utils/userManagement'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/settings'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  },
  currentUserName: {
    type: String,
    default: 'admin'
  },
  currentUserRole: {
    type: String,
    default: 'user'
  }
})

const emit = defineEmits(['toggle-sidebar', 'logout'])

const SETTINGS_TABS = [
  { id: 'users', label: '用户管理', icon: 'server' },
  { id: 'apiKeys', label: 'API Key 管理', icon: 'shield' },
  { id: 'theme', label: '主题管理', icon: 'editor' },
  { id: 'notifications', label: '通知策略', icon: 'shield' }
]

const NOTIFICATION_POLICIES = [
  { id: 'scanFinished', label: '扫描完成通知', description: '任务完成或失败时通知任务创建人。' },
  { id: 'criticalVulnerability', label: '严重漏洞提醒', description: '发现严重漏洞后立即提醒负责人。' },
  { id: 'dailyDigest', label: '每日安全摘要', description: '每天汇总新增资产、漏洞和任务执行情况。' }
]

const activeTab = ref('users')
const initialThemeSettings = getAppliedThemeSettings()
const settingsState = reactive({
  selectedTheme: initialThemeSettings.theme,
  darkModeEnabled: initialThemeSettings.darkModeEnabled,
  scanFinished: true,
  criticalVulnerability: true,
  dailyDigest: false,
  notifyChannel: 'email',
  notifyThreshold: 'high'
})
const savedSnapshot = ref(JSON.stringify(settingsState))
const saveState = ref('idle')
const themeSettingsState = reactive({
  loading: false,
  loaded: false,
  error: ''
})
const usersState = reactive({
  items: [],
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  loading: false,
  error: ''
})
const createUserState = reactive({
  isOpen: false,
  username: '',
  password: '',
  role: 'user',
  status: 'enabled',
  submitting: false,
  error: ''
})
const editUserState = reactive({
  isOpen: false,
  username: '',
  password: '',
  role: 'user',
  status: 'enabled',
  submitting: false,
  error: ''
})
const deleteUserState = reactive({
  isOpen: false,
  user: null,
  submitting: false,
  error: ''
})

let usersAbortController = null
let createUserAbortController = null
let editUserAbortController = null
let deleteUserAbortController = null
let themeSettingsAbortController = null
let saveThemeSettingsAbortController = null
let usersRequestId = 0
let themeSettingsRequestId = 0
let createUserFeedbackTimer = null

const USERNAME_MAX_LENGTH = 64
const PASSWORD_MAX_LENGTH = 72
const PASSWORD_MIN_LENGTH = 9
const userFeedbackMessage = ref('')

const isAdminUser = computed(() => props.currentUserRole === 'admin')
const visibleSettingsTabs = computed(() =>
  SETTINGS_TABS.filter((item) => !['users', 'apiKeys'].includes(item.id) || isAdminUser.value)
)
const activeTabMeta = computed(
  () => visibleSettingsTabs.value.find((item) => item.id === activeTab.value) ?? visibleSettingsTabs.value[0]
)
const isThemeTabActive = computed(() => activeTab.value === 'theme')
const isApiKeysTabActive = computed(() => activeTab.value === 'apiKeys')
const enabledNotificationCount = computed(() =>
  NOTIFICATION_POLICIES.filter((item) => Boolean(settingsState[item.id])).length
)
const isDirty = computed(() => JSON.stringify(settingsState) !== savedSnapshot.value)
const canSaveSettings = computed(() =>
  isDirty.value && saveState.value !== 'saving' && !(isThemeTabActive.value && themeSettingsState.loading)
)
const saveButtonLabel = computed(() => {
  if (saveState.value === 'saving') {
    return '保存中'
  }

  if (saveState.value === 'saved') {
    return '已保存'
  }

  return '保存设置'
})
const saveBarDescription = computed(() => {
  if (isThemeTabActive.value) {
    if (themeSettingsState.loading) {
      return '正在读取后端保存的主题设置。'
    }

    if (themeSettingsState.error) {
      return '主题设置加载或保存失败，请重试。'
    }

    return '暗夜模式会即时切换界面，保存后会同步到当前登录用户。'
  }

  return '当前设置保存在前端状态，后续接入接口后可替换保存逻辑。'
})
const usersRangeStart = computed(() => {
  if (!usersState.total) {
    return 0
  }

  return (usersState.page - 1) * usersState.pageSize + 1
})
const usersRangeEnd = computed(() =>
  Math.min(usersState.page * usersState.pageSize, usersState.total)
)
const createUserValidationMessage = computed(() => {
  const username = createUserState.username.trim()
  const passwordMessage = validatePassword(createUserState.password, true)

  if (!username) {
    return '请输入用户名'
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `用户名不能超过 ${USERNAME_MAX_LENGTH} 个字符`
  }

  return passwordMessage
})
const canCreateUser = computed(() =>
  !createUserState.submitting && !createUserValidationMessage.value
)
const editUserValidationMessage = computed(() => validatePassword(editUserState.password, false))
const canUpdateUser = computed(() =>
  !editUserState.submitting && !editUserValidationMessage.value
)
const deleteTargetName = computed(() => deleteUserState.user?.username ?? '')

function selectTab(tabId) {
  if (!visibleSettingsTabs.value.some((item) => item.id === tabId)) {
    return
  }

  activeTab.value = tabId
}

function refreshUsers() {
  void fetchUsers(usersState.page)
}

function goToPreviousUsersPage() {
  if (usersState.page <= 1 || usersState.loading) {
    return
  }

  void fetchUsers(usersState.page - 1)
}

function goToNextUsersPage() {
  if (usersState.page >= usersState.totalPages || usersState.loading) {
    return
  }

  void fetchUsers(usersState.page + 1)
}

function openCreateUserDialog() {
  resetCreateUserForm()
  createUserState.isOpen = true
}

function closeCreateUserDialog() {
  if (createUserState.submitting) {
    return
  }

  createUserState.isOpen = false
  createUserState.error = ''
}

function openEditUserDialog(user) {
  resetEditUserForm()
  editUserState.username = user.username
  editUserState.role = user.role
  editUserState.status = user.status
  editUserState.isOpen = true
}

function closeEditUserDialog() {
  if (editUserState.submitting) {
    return
  }

  editUserState.isOpen = false
  editUserState.error = ''
}

function openDeleteUserDialog(user) {
  deleteUserState.user = user
  deleteUserState.error = ''
  deleteUserState.isOpen = true
}

function closeDeleteUserDialog() {
  if (deleteUserState.submitting) {
    return
  }

  deleteUserState.isOpen = false
  deleteUserState.error = ''
  deleteUserState.user = null
}

async function saveSettings() {
  if (isThemeTabActive.value) {
    await saveThemeSettings()
    return
  }

  saveState.value = 'saving'

  await new Promise((resolve) => {
    window.setTimeout(resolve, 360)
  })

  savedSnapshot.value = JSON.stringify(settingsState)
  saveState.value = 'saved'

  window.setTimeout(() => {
    if (saveState.value === 'saved') {
      saveState.value = 'idle'
    }
  }, 1600)
}

function resetSettings() {
  Object.assign(settingsState, JSON.parse(savedSnapshot.value))
  saveState.value = 'idle'
  themeSettingsState.error = ''
}

function refreshThemeSettings() {
  void fetchThemeSettings({ force: true })
}

async function fetchThemeSettings(options = {}) {
  if (themeSettingsState.loading) {
    return
  }

  if (themeSettingsState.loaded && !options.force) {
    return
  }

  themeSettingsAbortController?.abort()
  themeSettingsAbortController = new AbortController()
  const requestId = ++themeSettingsRequestId
  themeSettingsState.loading = true
  themeSettingsState.error = ''

  try {
    const data = await getThemeSettings(themeSettingsAbortController.signal)
    const normalized = normalizeThemeSettings(data, THEME_OPTIONS)

    if (requestId === themeSettingsRequestId) {
      settingsState.selectedTheme = normalized.theme
      settingsState.darkModeEnabled = normalized.darkModeEnabled
      updateSavedThemeSnapshot(normalized)
      cacheThemeSettings(normalized)
      themeSettingsState.loaded = true
      saveState.value = 'idle'
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && requestId === themeSettingsRequestId) {
      themeSettingsState.error = error instanceof Error ? error.message : '主题设置加载失败，请稍后重试。'
    }
  } finally {
    if (requestId === themeSettingsRequestId) {
      themeSettingsState.loading = false
      themeSettingsAbortController = null
    }
  }
}

async function saveThemeSettings() {
  saveThemeSettingsAbortController?.abort()
  saveThemeSettingsAbortController = new AbortController()
  saveState.value = 'saving'
  themeSettingsState.error = ''

  try {
    const data = await updateThemeSettings(
      {
        theme: settingsState.selectedTheme,
        darkModeEnabled: settingsState.darkModeEnabled
      },
      saveThemeSettingsAbortController.signal
    )
    const normalized = normalizeThemeSettings(data, THEME_OPTIONS)
    settingsState.selectedTheme = normalized.theme
    settingsState.darkModeEnabled = normalized.darkModeEnabled
    updateSavedThemeSnapshot(normalized)
    cacheThemeSettings(normalized)
    themeSettingsState.loaded = true
    saveState.value = 'saved'

    window.setTimeout(() => {
      if (saveState.value === 'saved') {
        saveState.value = 'idle'
      }
    }, 1600)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      themeSettingsState.error = error instanceof Error ? error.message : '主题设置保存失败，请稍后重试。'
      saveState.value = 'idle'
    }
  } finally {
    saveThemeSettingsAbortController = null
  }
}

async function fetchUsers(page = usersState.page) {
  usersAbortController?.abort()
  usersAbortController = new AbortController()
  const requestId = ++usersRequestId
  usersState.loading = true
  usersState.error = ''

  try {
    const data = await getUserList(
      {
        page,
        pageSize: usersState.pageSize
      },
      usersAbortController.signal
    )
    const normalized = normalizeUserListResponse(data, page, usersState.pageSize)

    if (requestId === usersRequestId) {
      usersState.items = normalized.items
      usersState.page = normalized.page
      usersState.pageSize = normalized.pageSize
      usersState.total = normalized.total
      usersState.totalPages = normalized.totalPages
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && requestId === usersRequestId) {
      usersState.error = error instanceof Error ? error.message : '用户列表加载失败，请稍后重试。'
    }
  } finally {
    if (requestId === usersRequestId) {
      usersState.loading = false
      usersAbortController = null
    }
  }
}

async function submitCreateUser() {
  if (!canCreateUser.value) {
    createUserState.error = createUserValidationMessage.value
    return
  }

  createUserAbortController?.abort()
  createUserAbortController = new AbortController()
  createUserState.submitting = true
  createUserState.error = ''
  userFeedbackMessage.value = ''

  try {
    const data = await createUser(
      {
        username: createUserState.username.trim(),
        password: createUserState.password,
        role: createUserState.role,
        status: createUserState.status
      },
      createUserAbortController.signal
    )
    const createdUser = normalizeUser(data)
    userFeedbackMessage.value = `已新增用户 ${createdUser.username}`
    createUserState.isOpen = false
    resetCreateUserForm()
    startUserFeedbackTimer()
    await fetchUsers(1)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      createUserState.error = error instanceof Error ? error.message : '新增用户失败，请稍后重试。'
    }
  } finally {
    createUserState.submitting = false
    createUserAbortController = null
  }
}

async function submitUpdateUser() {
  if (!canUpdateUser.value) {
    editUserState.error = editUserValidationMessage.value
    return
  }

  editUserAbortController?.abort()
  editUserAbortController = new AbortController()
  editUserState.submitting = true
  editUserState.error = ''
  userFeedbackMessage.value = ''

  try {
    const data = await updateUser(
      editUserState.username,
      {
        password: editUserState.password,
        role: editUserState.role,
        status: editUserState.status
      },
      editUserAbortController.signal
    )
    const updatedUser = normalizeUser(data)
    userFeedbackMessage.value = `已更新用户 ${updatedUser.username}`
    editUserState.isOpen = false
    resetEditUserForm()
    startUserFeedbackTimer()
    await fetchUsers(usersState.page)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      editUserState.error = error instanceof Error ? error.message : '修改用户失败，请稍后重试。'
    }
  } finally {
    editUserState.submitting = false
    editUserAbortController = null
  }
}

async function confirmDeleteUser() {
  if (!deleteTargetName.value) {
    deleteUserState.error = '未找到要删除的用户。'
    return
  }

  deleteUserAbortController?.abort()
  deleteUserAbortController = new AbortController()
  deleteUserState.submitting = true
  deleteUserState.error = ''
  userFeedbackMessage.value = ''

  try {
    await deleteUser(deleteTargetName.value, deleteUserAbortController.signal)
    const deletedName = deleteTargetName.value
    const nextPage = usersState.items.length <= 1 && usersState.page > 1
      ? usersState.page - 1
      : usersState.page

    userFeedbackMessage.value = `已删除用户 ${deletedName}`
    deleteUserState.isOpen = false
    deleteUserState.error = ''
    deleteUserState.user = null
    startUserFeedbackTimer()
    await fetchUsers(nextPage)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      deleteUserState.error = error instanceof Error ? error.message : '删除用户失败，请稍后重试。'
    }
  } finally {
    deleteUserState.submitting = false
    deleteUserAbortController = null
  }
}

function resetCreateUserForm() {
  createUserState.username = ''
  createUserState.password = ''
  createUserState.role = 'user'
  createUserState.status = 'enabled'
  createUserState.error = ''
}

function resetEditUserForm() {
  editUserState.username = ''
  editUserState.password = ''
  editUserState.role = 'user'
  editUserState.status = 'enabled'
  editUserState.error = ''
}

function updateSavedThemeSnapshot(themeSettings) {
  const snapshot = parseSavedSettingsSnapshot()
  snapshot.selectedTheme = themeSettings.theme
  snapshot.darkModeEnabled = themeSettings.darkModeEnabled
  savedSnapshot.value = JSON.stringify(snapshot)
}

function parseSavedSettingsSnapshot() {
  try {
    return JSON.parse(savedSnapshot.value)
  } catch {
    return { ...settingsState }
  }
}

function startUserFeedbackTimer() {
  window.clearTimeout(createUserFeedbackTimer)
  createUserFeedbackTimer = window.setTimeout(() => {
    userFeedbackMessage.value = ''
  }, 1800)
}

function validatePassword(password, required) {
  if (!password) {
    return required ? '请输入密码' : ''
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `密码长度必须大于 ${PASSWORD_MIN_LENGTH - 1} 个字符`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `密码不能超过 ${PASSWORD_MAX_LENGTH} 个字符`
  }

  if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[^\w\s]|_/.test(password)) {
    return '密码需同时包含字母、数字和标点或符号'
  }

  return ''
}

watch(
  [activeTab, isAdminUser],
  ([tabId, isAdmin]) => {
    if (!visibleSettingsTabs.value.some((item) => item.id === tabId)) {
      activeTab.value = visibleSettingsTabs.value[0]?.id ?? 'theme'
      return
    }

    if (!isAdmin) {
      usersAbortController?.abort()
      editUserAbortController?.abort()
      deleteUserAbortController?.abort()
      createUserState.isOpen = false
      editUserState.isOpen = false
      deleteUserState.isOpen = false
    }

    if (isAdmin && tabId === 'users' && !usersState.items.length && !usersState.loading) {
      void fetchUsers()
    }

    if (tabId === 'theme') {
      void fetchThemeSettings()
    }
  },
  { immediate: true }
)

watch(
  () => [settingsState.selectedTheme, settingsState.darkModeEnabled],
  ([theme, darkModeEnabled]) => {
    applyThemeSettings({ theme, darkModeEnabled })
  }
)

onBeforeUnmount(() => {
  usersAbortController?.abort()
  createUserAbortController?.abort()
  editUserAbortController?.abort()
  deleteUserAbortController?.abort()
  themeSettingsAbortController?.abort()
  saveThemeSettingsAbortController?.abort()
  window.clearTimeout(createUserFeedbackTimer)
})
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    :current-user-name="props.currentUserName"
    main-class="settings-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
    @logout="emit('logout')"
  >
    <main class="settings-page">
      <div class="settings-workspace">
        <nav class="settings-tabs" aria-label="设置二级导航">
          <button
            v-for="tab in visibleSettingsTabs"
            :key="tab.id"
            type="button"
            class="settings-tab"
            :class="{ active: activeTab === tab.id }"
            @click="selectTab(tab.id)"
          >
            <span class="settings-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath(tab.icon)" />
            </span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <div class="settings-layout">
          <section class="settings-panel settings-panel--wide">
            <div class="settings-panel-head">
              <div>
                <span class="settings-panel-kicker">Settings</span>
                <h2>{{ activeTabMeta.label }}</h2>
              </div>
              <div class="settings-panel-actions">
                <span class="settings-panel-meta">当前用户：{{ props.currentUserName }}</span>
                <button
                  v-if="activeTab === 'users'"
                  class="settings-button settings-button--primary"
                  type="button"
                  @click="openCreateUserDialog"
                >
                  新增用户
                </button>
              </div>
            </div>

            <div v-if="activeTab === 'apiKeys'" class="settings-api-key-management">
              <ThirdPartyApiKeyManagement v-if="isAdminUser" />
            </div>

            <div v-else-if="activeTab === 'users'" class="settings-user-management">
              <div v-if="userFeedbackMessage" class="settings-alert is-success" role="status">
                {{ userFeedbackMessage }}
              </div>

              <div v-if="usersState.error" class="settings-alert is-error" role="alert">
                <span>{{ usersState.error }}</span>
                <button type="button" @click="refreshUsers">重试</button>
              </div>

              <section class="settings-user-table-card">
                <div class="settings-user-table-scroll">
                  <div class="settings-user-table">
                    <header class="settings-user-table-head">
                      <span>用户名</span>
                      <span>角色</span>
                      <span>状态</span>
                      <span>最近登录</span>
                      <span>操作</span>
                    </header>

                    <div v-if="usersState.loading" class="settings-user-table-body" aria-hidden="true">
                      <div v-for="index in 5" :key="index" class="settings-user-skeleton-row">
                        <span class="settings-user-skeleton is-main"></span>
                        <span class="settings-user-skeleton"></span>
                        <span class="settings-user-skeleton is-pill"></span>
                        <span class="settings-user-skeleton"></span>
                        <span class="settings-user-skeleton is-actions"></span>
                      </div>
                    </div>

                    <div v-else-if="!usersState.items.length" class="settings-user-empty">
                      <strong>暂无用户</strong>
                      <p>当前没有可展示的用户账号。</p>
                    </div>

                    <div v-else class="settings-user-table-body">
                      <div v-for="user in usersState.items" :key="user.key" class="settings-user-table-row">
                        <strong>{{ user.username }}</strong>
                        <span>{{ user.roleLabel }}</span>
                        <span class="settings-status-pill" :class="`is-${user.statusTone}`">
                          {{ user.statusLabel }}
                        </span>
                        <span>{{ user.lastLoginAtDisplay }}</span>
                        <span class="settings-user-row-actions">
                          <button class="settings-row-action" type="button" :aria-label="`编辑用户 ${user.username}`" @click="openEditUserDialog(user)">
                            编辑
                          </button>
                          <button
                            class="settings-row-action is-danger"
                            type="button"
                            :aria-label="`删除用户 ${user.username}`"
                            @click="openDeleteUserDialog(user)"
                          >
                            删除
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <footer class="settings-user-pagination">
                  <span>
                    第 {{ usersState.page }} / {{ usersState.totalPages }} 页，
                    {{ usersRangeStart }}-{{ usersRangeEnd }} / {{ usersState.total }}
                  </span>
                  <div class="settings-user-pagination-actions">
                    <button
                      class="settings-button"
                      type="button"
                      :disabled="usersState.page <= 1 || usersState.loading"
                      @click="goToPreviousUsersPage"
                    >
                      上一页
                    </button>
                    <button
                      class="settings-button"
                      type="button"
                      :disabled="usersState.page >= usersState.totalPages || usersState.loading"
                      @click="goToNextUsersPage"
                    >
                      下一页
                    </button>
                  </div>
                </footer>
              </section>
            </div>

            <div v-else-if="activeTab === 'theme'" class="settings-theme-section">
              <div v-if="themeSettingsState.loading" class="settings-alert" role="status">
                正在加载主题设置
              </div>
              <div v-if="themeSettingsState.error" class="settings-alert is-error" role="alert">
                <span>{{ themeSettingsState.error }}</span>
                <button type="button" @click="refreshThemeSettings">重试</button>
              </div>

              <div class="settings-theme-control-panel">
                <label class="settings-toggle-row settings-theme-mode-toggle">
                  <span>
                    <strong>暗夜模式</strong>
                    <small>{{ settingsState.darkModeEnabled ? '已开启暗夜模式，界面已即时切换。' : '关闭暗夜模式，界面保持浅色显示。' }}</small>
                  </span>
                  <input
                    v-model="settingsState.darkModeEnabled"
                    type="checkbox"
                    class="settings-switch-input"
                    :disabled="themeSettingsState.loading || saveState === 'saving'"
                  />
                  <span class="settings-switch" aria-hidden="true"></span>
                </label>
              </div>

              <div class="settings-theme-grid" aria-label="主题选项">
                <label
                  v-for="theme in THEME_OPTIONS"
                  :key="theme.id"
                  class="settings-theme-card"
                  :class="{
                    active: settingsState.selectedTheme === theme.id,
                    'is-disabled': themeSettingsState.loading || saveState === 'saving'
                  }"
                >
                  <input
                    v-model="settingsState.selectedTheme"
                    type="radio"
                    name="settings-theme"
                    :value="theme.id"
                    :disabled="themeSettingsState.loading || saveState === 'saving'"
                  />
                  <span class="settings-theme-swatches" aria-hidden="true">
                    <span v-for="color in theme.swatches" :key="color" :style="{ backgroundColor: color }"></span>
                  </span>
                  <span class="settings-theme-copy">
                    <strong>{{ theme.label }}</strong>
                    <small>{{ theme.description }}</small>
                  </span>
                  <span v-if="settingsState.selectedTheme === theme.id" class="settings-theme-current">当前主题</span>
                </label>
              </div>
            </div>

            <div v-else class="settings-notification-grid">
              <div class="settings-toggle-list">
                <label v-for="policy in NOTIFICATION_POLICIES" :key="policy.id" class="settings-toggle-row">
                  <span>
                    <strong>{{ policy.label }}</strong>
                    <small>{{ policy.description }}</small>
                  </span>
                  <input v-model="settingsState[policy.id]" type="checkbox" class="settings-switch-input" />
                  <span class="settings-switch" aria-hidden="true"></span>
                </label>
              </div>

              <div class="settings-detail-panel">
                <div class="settings-panel-head">
                  <div>
                    <span class="settings-panel-kicker">Policy</span>
                    <h2>{{ enabledNotificationCount }} 项启用</h2>
                  </div>
                </div>
                <div class="settings-form-grid">
                  <label class="settings-field">
                    <span>通知渠道</span>
                    <select v-model="settingsState.notifyChannel">
                      <option value="email">邮件</option>
                      <option value="webhook">Webhook</option>
                      <option value="both">邮件 + Webhook</option>
                    </select>
                  </label>
                  <label class="settings-field">
                    <span>提醒阈值</span>
                    <select v-model="settingsState.notifyThreshold">
                      <option value="critical">严重及以上</option>
                      <option value="high">高危及以上</option>
                      <option value="medium">中危及以上</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <div v-if="activeTab !== 'users' && !isApiKeysTabActive" class="settings-save-bar" :class="{ 'is-dirty': isDirty }">
            <div>
              <strong>{{ isDirty ? '有未保存的设置' : '设置已同步' }}</strong>
              <p>{{ saveBarDescription }}</p>
            </div>
            <div class="settings-save-actions">
              <button type="button" class="settings-button" :disabled="!isDirty || saveState === 'saving' || themeSettingsState.loading" @click="resetSettings">
                撤销
              </button>
              <button type="button" class="settings-button settings-button--primary" :disabled="!canSaveSettings" @click="saveSettings">
                {{ saveButtonLabel }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="createUserState.isOpen" class="settings-dialog-overlay" role="presentation" @click.self="closeCreateUserDialog">
        <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-create-user-title">
          <form @submit.prevent="submitCreateUser">
            <header class="settings-dialog-head">
              <h2 id="settings-create-user-title">新增用户</h2>
              <button
                class="settings-dialog-close"
                type="button"
                aria-label="关闭"
                :disabled="createUserState.submitting"
                @click="closeCreateUserDialog"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div class="settings-dialog-body">
              <label class="settings-field">
                <span>用户名</span>
                <input
                  v-model.trim="createUserState.username"
                  type="text"
                  name="username"
                  autocomplete="username"
                  :maxlength="USERNAME_MAX_LENGTH"
                  placeholder="例如 operator"
                />
              </label>

              <label class="settings-field">
                <span>密码</span>
                <input
                  v-model="createUserState.password"
                  type="password"
                  name="password"
                  autocomplete="new-password"
                  :maxlength="PASSWORD_MAX_LENGTH"
                  placeholder="需大于 8 个字符，包含数字字母标点符号"
                />
              </label>

              <div class="settings-dialog-grid">
                <section class="settings-field">
                  <span>角色</span>
                  <div class="settings-option-group" role="radiogroup" aria-label="角色">
                    <button
                      v-for="role in USER_ROLE_OPTIONS"
                      :key="role.value"
                      type="button"
                      class="settings-option-button"
                      :class="{ active: createUserState.role === role.value }"
                      :aria-pressed="createUserState.role === role.value"
                      @click="createUserState.role = role.value"
                    >
                      {{ role.label }}
                    </button>
                  </div>
                </section>

                <section class="settings-field">
                  <span>状态</span>
                  <div class="settings-option-group" role="radiogroup" aria-label="状态">
                    <button
                      v-for="status in USER_STATUS_OPTIONS"
                      :key="status.value"
                      type="button"
                      class="settings-option-button"
                      :class="{ active: createUserState.status === status.value }"
                      :aria-pressed="createUserState.status === status.value"
                      @click="createUserState.status = status.value"
                    >
                      {{ status.label }}
                    </button>
                  </div>
                </section>
              </div>

              <div v-if="createUserState.error" class="settings-alert is-error" role="alert">
                {{ createUserState.error }}
              </div>
            </div>

            <footer class="settings-dialog-actions">
              <button class="settings-button" type="button" :disabled="createUserState.submitting" @click="closeCreateUserDialog">
                取消
              </button>
              <button class="settings-button settings-button--primary" type="submit" :disabled="!canCreateUser">
                {{ createUserState.submitting ? '创建中' : '确认创建' }}
              </button>
            </footer>
          </form>
        </section>
      </div>

      <div v-if="editUserState.isOpen" class="settings-dialog-overlay" role="presentation" @click.self="closeEditUserDialog">
        <section class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-edit-user-title">
          <form @submit.prevent="submitUpdateUser">
            <header class="settings-dialog-head">
              <h2 id="settings-edit-user-title">编辑用户</h2>
              <button
                class="settings-dialog-close"
                type="button"
                aria-label="关闭"
                :disabled="editUserState.submitting"
                @click="closeEditUserDialog"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div class="settings-dialog-body">
              <label class="settings-field">
                <span>用户名</span>
                <input :value="editUserState.username" type="text" name="username" disabled />
              </label>

              <label class="settings-field">
                <span>新密码</span>
                <input
                  v-model="editUserState.password"
                  type="password"
                  name="password"
                  autocomplete="new-password"
                  :maxlength="PASSWORD_MAX_LENGTH"
                  placeholder="留空则不修改密码"
                />
              </label>

              <div class="settings-dialog-grid">
                <section class="settings-field">
                  <span>角色</span>
                  <div class="settings-option-group" role="radiogroup" aria-label="角色">
                    <button
                      v-for="role in USER_ROLE_OPTIONS"
                      :key="role.value"
                      type="button"
                      class="settings-option-button"
                      :class="{ active: editUserState.role === role.value }"
                      :aria-pressed="editUserState.role === role.value"
                      @click="editUserState.role = role.value"
                    >
                      {{ role.label }}
                    </button>
                  </div>
                </section>

                <section class="settings-field">
                  <span>状态</span>
                  <div class="settings-option-group" role="radiogroup" aria-label="状态">
                    <button
                      v-for="status in USER_STATUS_OPTIONS"
                      :key="status.value"
                      type="button"
                      class="settings-option-button"
                      :class="{ active: editUserState.status === status.value }"
                      :aria-pressed="editUserState.status === status.value"
                      @click="editUserState.status = status.value"
                    >
                      {{ status.label }}
                    </button>
                  </div>
                </section>
              </div>

              <div v-if="editUserState.error" class="settings-alert is-error" role="alert">
                {{ editUserState.error }}
              </div>
            </div>

            <footer class="settings-dialog-actions">
              <button class="settings-button" type="button" :disabled="editUserState.submitting" @click="closeEditUserDialog">
                取消
              </button>
              <button class="settings-button settings-button--primary" type="submit" :disabled="!canUpdateUser">
                {{ editUserState.submitting ? '保存中' : '保存修改' }}
              </button>
            </footer>
          </form>
        </section>
      </div>

      <div v-if="deleteUserState.isOpen" class="settings-dialog-overlay" role="presentation" @click.self="closeDeleteUserDialog">
        <section class="settings-dialog settings-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="settings-delete-user-title">
          <header class="settings-dialog-head">
            <h2 id="settings-delete-user-title">删除用户</h2>
            <button
              class="settings-dialog-close"
              type="button"
              aria-label="关闭"
              :disabled="deleteUserState.submitting"
              @click="closeDeleteUserDialog"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div class="settings-dialog-body">
            <div class="settings-delete-copy">
              <strong>删除后无法恢复。</strong>
              <p>
                确认删除用户
                <span>{{ deleteTargetName }}</span>
                吗？
              </p>
            </div>

            <div v-if="deleteUserState.error" class="settings-alert is-error" role="alert">
              {{ deleteUserState.error }}
            </div>
          </div>

          <footer class="settings-dialog-actions">
            <button class="settings-button" type="button" :disabled="deleteUserState.submitting" @click="closeDeleteUserDialog">
              取消
            </button>
            <button class="settings-button settings-button--danger" type="button" :disabled="deleteUserState.submitting" @click="confirmDeleteUser">
              {{ deleteUserState.submitting ? '删除中' : '确认删除' }}
            </button>
          </footer>
        </section>
      </div>
    </main>
  </AppShell>
</template>
