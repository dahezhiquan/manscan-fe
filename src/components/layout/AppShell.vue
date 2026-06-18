<script setup>
import { computed } from 'vue'
import AppSidebar from './AppSidebar.vue'
import { footerNav, getNavigationState } from '../../data/dashboard'

const props = defineProps({
  currentPath: {
    type: String,
    default: '/'
  },
  isSidebarCollapsed: {
    type: Boolean,
    default: false
  },
  mainClass: {
    type: String,
    default: 'templates-shell-main'
  }
})

const emit = defineEmits(['toggle-sidebar', 'navigate'])

const navigationState = computed(() => getNavigationState(props.currentPath))
</script>

<template>
  <div class="dashboard-shell" :class="{ 'sidebar-collapsed': props.isSidebarCollapsed }">
    <AppSidebar
      :is-collapsed="props.isSidebarCollapsed"
      :primary-nav="navigationState.primaryNav"
      :secondary-nav="navigationState.secondaryNav"
      :footer-nav="footerNav"
      @toggle="emit('toggle-sidebar')"
      @navigate="emit('navigate', $event)"
    />

    <div :class="mainClass">
      <slot />
    </div>
  </div>
</template>
