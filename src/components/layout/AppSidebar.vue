<script setup>
import manscanIcon from '../../assets/manscan-icon.png'
import { iconPath } from '../../utils/icons'

defineProps({
  isCollapsed: {
    type: Boolean,
    default: false
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

defineEmits(['toggle', 'navigate'])
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="brand-mark" aria-hidden="true">
        <img :src="manscanIcon" alt="" />
      </div>
      <button
        class="sidebar-toggle"
        :aria-label="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="$emit('toggle')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <rect x="4.5" y="4.5" width="15" height="15" rx="2.4" />
          <path d="M11.4 4.8v14.4" />
        </svg>
      </button>
    </div>

    <button class="team-switcher">
      <span class="team-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="6" y="3.5" width="12" height="17" rx="2" />
          <path d="M9 8.5h6M9 12h6M9 15.5h4" />
        </svg>
      </span>
      <span class="team-name">dahezhiquan</span>
      <span class="team-arrows">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="m8 9 4-4 4 4" />
          <path d="m8 15 4 4 4-4" />
        </svg>
      </span>
    </button>

    <button class="create-button" @click="$emit('navigate', '/scans/create')">
      <span class="create-plus">+</span>
      <span>创建任务</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <nav class="nav-block">
      <button
        v-for="item in primaryNav"
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
        v-for="item in secondaryNav"
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
      <button v-for="item in footerNav" :key="item.label" class="nav-item">
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
