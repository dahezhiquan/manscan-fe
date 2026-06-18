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
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-sidebar'])
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    main-class="templates-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
  >
    <template #default>
      <VulnerabilitiesPage />
    </template>
  </AppShell>
</template>
