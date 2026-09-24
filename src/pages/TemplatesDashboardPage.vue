<script setup>
import AppShell from '../components/layout/AppShell.vue'
import TemplatesLibraryPage from './TemplatesLibraryPage.vue'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/templates/all'
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

<template>
  <AppShell
    :current-path="props.currentPath === '/templates' ? '/templates/all' : props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    :current-user-name="props.currentUserName"
    main-class="templates-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
    @logout="emit('logout')"
  >
    <template #default>
      <TemplatesLibraryPage :navigate-to="props.navigateTo" />
    </template>
  </AppShell>
</template>
