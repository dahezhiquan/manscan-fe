<script setup>
import { computed, ref } from 'vue'
import DashboardPage from './pages/DashboardPage.vue'
import ScansDashboardPage from './pages/ScansDashboardPage.vue'
import TemplateDetailPage from './pages/TemplateDetailPage.vue'
import TemplatesDashboardPage from './pages/TemplatesDashboardPage.vue'
import VulnerabilitiesDashboardPage from './pages/VulnerabilitiesDashboardPage.vue'
import { useAppRouter } from './composables/useAppRouter'

const isSidebarCollapsed = ref(false)
const { currentPath, navigateTo } = useAppRouter()

const currentView = computed(() => {
  if (currentPath.value === '/templates/all') {
    return TemplatesDashboardPage
  }

  if (currentPath.value === '/vulnerabilities') {
    return VulnerabilitiesDashboardPage
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
  <component
    :is="currentView"
    :navigate-to="navigateTo"
    :current-path="currentPath"
    :is-sidebar-collapsed="isSidebarCollapsed"
    @toggle-sidebar="isSidebarCollapsed = !isSidebarCollapsed"
  />
</template>
