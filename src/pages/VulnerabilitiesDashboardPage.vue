<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    :current-user-name="props.currentUserName"
    main-class="templates-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
    @logout="emit('logout')"
  >
    <template #default>
      <VulnerabilitiesPage :route-search="props.routeSearch" />
    </template>
  </AppShell>
</template>

<script setup>
import AppShell from '../components/layout/AppShell.vue'
import VulnerabilitiesPage from './VulnerabilitiesPage.vue'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/vulnerabilities'
  },
  routeSearch: {
    type: String,
    default: ''
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
</script>
