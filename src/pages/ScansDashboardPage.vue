<script setup>
import { computed } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import ScanTaskCreatePage from './ScanTaskCreatePage.vue'
import ScanTaskDetailPage from './ScanTaskDetailPage.vue'
import ScansPage from './ScansPage.vue'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/scans'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-sidebar'])

const isCreatePage = computed(() => props.currentPath === '/scans/create')
const taskDetailId = computed(() => {
  const match = props.currentPath.match(/^\/scans\/([^/]+)$/)
  return match?.[1] ?? ''
})
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
      <ScanTaskCreatePage v-if="isCreatePage" :key="props.currentPath" :navigate-to="props.navigateTo" />
      <ScanTaskDetailPage
        v-else-if="taskDetailId"
        :key="props.currentPath"
        :navigate-to="props.navigateTo"
        :current-path="props.currentPath"
      />
      <ScansPage v-else :key="props.currentPath" :navigate-to="props.navigateTo" />
    </template>
  </AppShell>
</template>
