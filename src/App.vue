<template>
  <div v-if="!isAuthReady" class="auth-init-placeholder" aria-hidden="true"></div>

  <LoginPage v-else-if="!isAuthenticated" @login-success="handleLoginSuccess" />

  <component
    v-else
    :is="currentView"
    v-bind="[ROUTE_PATHS.VULNERABILITIES, ROUTE_PATHS.HOST_ASSETS, ROUTE_PATHS.DOMAIN_ASSETS].includes(currentPath) ? { routeSearch: currentSearch } : {}"
    :navigate-to="navigateTo"
    :current-path="currentPath"
    :is-sidebar-collapsed="isSidebarCollapsed"
    :current-user-name="currentUserName"
    :current-user-role="currentUserRole"
    @toggle-sidebar="isSidebarCollapsed = !isSidebarCollapsed"
    @logout="handleLogout"
  />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getCurrentUser, logoutCurrentUser } from './api/auth'
import { getThemeSettings } from './api/settings'
import DashboardPage from './pages/DashboardPage.vue'
import AssetConfigCenterPage from './pages/AssetConfigCenterPage.vue'
import DomainAssetDetailPage from './pages/DomainAssetDetailPage.vue'
import DomainAssetsPage from './pages/DomainAssetsPage.vue'
import HostAssetDetailPage from './pages/HostAssetDetailPage.vue'
import HostAssetsPage from './pages/HostAssetsPage.vue'
import LoginPage from './pages/LoginPage.vue'
import ScansDashboardPage from './pages/ScansDashboardPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import ScheduledJobsPage from './pages/ScheduledJobsPage.vue'
import TemplateDetailPage from './pages/TemplateDetailPage.vue'
import TemplatesDashboardPage from './pages/TemplatesDashboardPage.vue'
import VulnerabilityDetailPage from './pages/VulnerabilityDetailPage.vue'
import VulnerabilitiesDashboardPage from './pages/VulnerabilitiesDashboardPage.vue'
import { useAppRouter } from './composables/useAppRouter'
import {
  applyThemeSettings,
  cacheThemeSettings,
  clearCachedThemeSettings,
  getCachedThemeSettings
} from './composables/useTheme'
import { DEFAULT_THEME_SETTINGS } from './constants/themes'
import { ROUTE_PATHS } from './router/routes'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  setAuthSession,
  updateStoredUser
} from './utils/authSession'
import { normalizeThemeSettings } from './utils/themeSettings'

const isSidebarCollapsed = ref(false)
const { currentPath, currentSearch, navigateTo } = useAppRouter()
const isAuthReady = ref(false)
const isAuthenticated = ref(Boolean(getAuthToken()))
const currentUser = ref(getStoredUser())
const redirectAfterLogin = ref('')
let themeSettingsAbortController = null

const currentUserName = computed(() => {
  const user = currentUser.value
  return user?.username || 'admin'
})
const currentUserRole = computed(() => currentUser.value?.role || 'user')

function rememberRedirectPath() {
  if (currentPath.value !== ROUTE_PATHS.LOGIN) {
    redirectAfterLogin.value = `${currentPath.value}${currentSearch.value}`
  }
}

function redirectToLogin() {
  rememberRedirectPath()

  if (currentPath.value !== ROUTE_PATHS.LOGIN) {
    navigateTo(ROUTE_PATHS.LOGIN)
  }
}

function redirectAuthenticatedLogin() {
  if (currentPath.value === ROUTE_PATHS.LOGIN) {
    navigateTo(redirectAfterLogin.value || ROUTE_PATHS.HOME)
    redirectAfterLogin.value = ''
  }
}

async function handleLoginSuccess(payload) {
  setAuthSession(payload)
  currentUser.value = updateStoredUser(payload?.user)
  isAuthenticated.value = true
  isAuthReady.value = false
  await syncCurrentUserThemeSettings()
  isAuthReady.value = true
  if (isAuthenticated.value) {
    redirectAuthenticatedLogin()
  }
}

function resetAuthState() {
  themeSettingsAbortController?.abort()
  themeSettingsAbortController = null
  clearCachedThemeSettings()
  applyThemeSettings(DEFAULT_THEME_SETTINGS)
  clearAuthSession()
  currentUser.value = null
  isAuthenticated.value = false
  isSidebarCollapsed.value = false
}

async function syncCurrentUserThemeSettings() {
  themeSettingsAbortController?.abort()
  themeSettingsAbortController = new AbortController()
  const controller = themeSettingsAbortController
  const cachedSettings = getCachedThemeSettings()
  applyThemeSettings(cachedSettings || DEFAULT_THEME_SETTINGS)

  try {
    const data = await getThemeSettings(controller.signal)
    const normalized = normalizeThemeSettings(data)
    if (!controller.signal.aborted && themeSettingsAbortController === controller) {
      applyThemeSettings(normalized)
      cacheThemeSettings(normalized)
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && themeSettingsAbortController === controller) {
      applyThemeSettings(cachedSettings || DEFAULT_THEME_SETTINGS)
    }
  } finally {
    if (themeSettingsAbortController === controller) {
      themeSettingsAbortController = null
    }
  }
}

async function handleLogout() {
  try {
    await logoutCurrentUser()
  } catch {
    // Local session cleanup is still required if the server already expired the token.
  } finally {
    resetAuthState()
    navigateTo(ROUTE_PATHS.LOGIN)
  }
}

async function initializeAuth() {
  if (!getAuthToken()) {
    resetAuthState()
    redirectToLogin()
    isAuthReady.value = true
    return
  }

  try {
    const user = await getCurrentUser()
    currentUser.value = updateStoredUser(user)
    isAuthenticated.value = true
    await syncCurrentUserThemeSettings()
    if (isAuthenticated.value) {
      redirectAuthenticatedLogin()
    }
  } catch {
    resetAuthState()
    redirectToLogin()
  } finally {
    isAuthReady.value = true
  }
}

function handleSessionExpired() {
  resetAuthState()
  redirectToLogin()
}

onMounted(() => {
  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
  void initializeAuth()
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
  themeSettingsAbortController?.abort()
})

watch(currentPath, () => {
  if (!isAuthReady.value) {
    return
  }

  if (!isAuthenticated.value) {
    redirectToLogin()
    return
  }

  redirectAuthenticatedLogin()
})

const currentView = computed(() => {
  if (currentPath.value === '/assets/config') {
    return AssetConfigCenterPage
  }

  if (currentPath.value === '/settings') {
    return SettingsPage
  }

  if (currentPath.value === '/scheduled-jobs') {
    return ScheduledJobsPage
  }

  if (currentPath.value.startsWith('/assets/domains/')) {
    return DomainAssetDetailPage
  }

  if (currentPath.value === '/assets/domains') {
    return DomainAssetsPage
  }

  if (currentPath.value.startsWith('/assets/hosts/')) {
    return HostAssetDetailPage
  }

  if (currentPath.value === '/assets/hosts') {
    return HostAssetsPage
  }

  if (currentPath.value === '/templates/all') {
    return TemplatesDashboardPage
  }

  if (currentPath.value === '/vulnerabilities') {
    return VulnerabilitiesDashboardPage
  }

  if (currentPath.value.startsWith('/vulnerabilities/')) {
    return VulnerabilityDetailPage
  }

  if (currentPath.value === '/scans' || currentPath.value === '/scans/create' || currentPath.value.startsWith('/scans/')) {
    return ScansDashboardPage
  }

  if (currentPath.value.startsWith('/templates/')) {
    return TemplateDetailPage
  }

  return DashboardPage
})
</script>
