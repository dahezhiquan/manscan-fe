<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import manscanIcon from '../../assets/manscan-icon.png'
import { iconPath } from '../../utils/icons'

const props = defineProps({
  isCollapsed: {
    type: Boolean,
    default: false
  },
  currentUserName: {
    type: String,
    default: 'admin'
  },
  primaryNav: {
    type: Array,
    default: () => []
  },
  secondaryNav: {
    type: Array,
    default: () => []
  },
  footerNav: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['toggle', 'navigate', 'logout'])

const isAccountMenuOpen = ref(false)
const accountMenuRef = ref(null)
const displayUserName = computed(() => props.currentUserName.trim() || 'admin')

function toggleAccountMenu() {
  isAccountMenuOpen.value = !isAccountMenuOpen.value
}

function closeAccountMenu() {
  isAccountMenuOpen.value = false
}

function handleLogout() {
  closeAccountMenu()
  emit('logout')
}

function handleDocumentClick(event) {
  if (!accountMenuRef.value?.contains(event.target)) {
    closeAccountMenu()
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    closeAccountMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="brand-mark" aria-hidden="true">
        <img :src="manscanIcon" alt="" />
      </div>
      <button
        class="sidebar-toggle"
        :aria-label="props.isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="$emit('toggle')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.4" />
          <path d="M11.4 4.8v14.4" />
        </svg>
      </button>
    </div>

    <div ref="accountMenuRef" class="team-menu">
      <button
        class="team-switcher"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="isAccountMenuOpen"
        @click.stop="toggleAccountMenu"
      >
        <span class="team-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="6" y="3.5" width="12" height="17" rx="2" />
            <path d="M9 8.5h6M9 12h6M9 15.5h4" />
          </svg>
        </span>
        <span class="team-name">{{ displayUserName }}</span>
        <span class="team-arrows" :class="{ open: isAccountMenuOpen }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m8 9 4-4 4 4" />
            <path d="m8 15 4 4 4-4" />
          </svg>
        </span>
      </button>

      <div v-if="isAccountMenuOpen" class="team-popover" role="menu">
        <button class="team-popover-item danger" type="button" role="menuitem" @click="handleLogout">
          <span class="team-popover-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M10 6H6.8A2.8 2.8 0 0 0 4 8.8v6.4A2.8 2.8 0 0 0 6.8 18H10" />
              <path d="M14 8l4 4-4 4" />
              <path d="M8.5 12H18" />
            </svg>
          </span>
          <span>退出登录</span>
        </button>
      </div>
    </div>

    <button class="create-button" @click="$emit('navigate', '/scans/create')">
      <span class="create-plus">+</span>
      <span>创建任务</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <nav class="nav-block">
      <button
        v-for="item in props.primaryNav"
        :key="item.label"
        class="nav-item"
        :class="{ active: item.active }"
        @click="item.route && $emit('navigate', item.route)"
      >
        <span class="nav-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            v-html="iconPath(item.icon)"
          />
        </span>
        <span class="nav-label">{{ item.label }}</span>
        <span v-if="item.count !== null" class="nav-badge">{{ item.count }}</span>
      </button>
    </nav>

    <nav class="nav-block separated">
      <button
        v-for="item in props.secondaryNav"
        :key="item.label"
        class="nav-item"
        :class="{ active: item.active }"
        @click="item.route && $emit('navigate', item.route)"
      >
        <span class="nav-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            v-html="iconPath(item.icon)"
          />
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>

    <nav class="nav-footer separated">
      <button v-for="item in props.footerNav" :key="item.label" class="nav-item">
        <span class="nav-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            v-html="iconPath(item.icon)"
          />
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
