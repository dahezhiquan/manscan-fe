<script setup>
import { computed, ref } from 'vue'
import DashboardPage from './pages/DashboardPage.vue'
import AssetConfigCenterPage from './pages/AssetConfigCenterPage.vue'
import DomainAssetsPage from './pages/DomainAssetsPage.vue'
import HostAssetsPage from './pages/HostAssetsPage.vue'
import LoginPage from './pages/LoginPage.vue'
import ScansDashboardPage from './pages/ScansDashboardPage.vue'
import TemplateDetailPage from './pages/TemplateDetailPage.vue'
import TemplatesDashboardPage from './pages/TemplatesDashboardPage.vue'
import VulnerabilityDetailPage from './pages/VulnerabilityDetailPage.vue'
import VulnerabilitiesDashboardPage from './pages/VulnerabilitiesDashboardPage.vue'
import { useAppRouter } from './composables/useAppRouter'
import { ROUTE_PATHS } from './router/routes'

const LOGIN_STORAGE_KEY = 'manscan-login-session'
const LOGIN_USERNAME_STORAGE_KEY = 'manscan-login-username'
const DEFAULT_LOGIN_USERNAME = 'admin'

const isSidebarCollapsed = ref(false)
const { currentPath, navigateTo } = useAppRouter()
const isAuthenticated = ref(window.localStorage.getItem(LOGIN_STORAGE_KEY) === 'authenticated')
const currentUserName = ref(window.localStorage.getItem(LOGIN_USERNAME_STORAGE_KEY) || DEFAULT_LOGIN_USERNAME)

function redirectAuthenticatedLogin() {
  if (currentPath.value === ROUTE_PATHS.LOGIN) {
    navigateTo(ROUTE_PATHS.HOME)
  }
}

function handleLoginSuccess(payload) {
  const username = String(payload?.username ?? '').trim() || DEFAULT_LOGIN_USERNAME
  window.localStorage.setItem(LOGIN_STORAGE_KEY, 'authenticated')
  window.localStorage.setItem(LOGIN_USERNAME_STORAGE_KEY, username)
  currentUserName.value = username
  isAuthenticated.value = true
  redirectAuthenticatedLogin()
}

function handleLogout() {
  window.localStorage.removeItem(LOGIN_STORAGE_KEY)
  window.localStorage.removeItem(LOGIN_USERNAME_STORAGE_KEY)
  currentUserName.value = DEFAULT_LOGIN_USERNAME
  isAuthenticated.value = false
  isSidebarCollapsed.value = false
  navigateTo(ROUTE_PATHS.LOGIN)
}

if (isAuthenticated.value) {
  redirectAuthenticatedLogin()
}

const currentView = computed(() => {
  if (currentPath.value === '/assets/config') {
    return AssetConfigCenterPage
  }

  if (currentPath.value === '/assets/domains') {
    return DomainAssetsPage
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

<template>
  <LoginPage v-if="!isAuthenticated" @login-success="handleLoginSuccess" />

  <component
    v-else
    :is="currentView"
    :navigate-to="navigateTo"
    :current-path="currentPath"
    :is-sidebar-collapsed="isSidebarCollapsed"
    :current-user-name="currentUserName"
    @toggle-sidebar="isSidebarCollapsed = !isSidebarCollapsed"
    @logout="handleLogout"
  />
</template>
