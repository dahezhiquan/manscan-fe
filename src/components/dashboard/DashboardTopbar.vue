<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentUserName: {
    type: String,
    default: 'admin'
  },
  currentUserRole: {
    type: String,
    default: 'user'
  }
})

const ROLE_LABELS = {
  admin: '系统管理员',
  user: '普通用户'
}

const greetingUserName = computed(() => props.currentUserName.trim() || 'admin')
const roleLabel = computed(() => {
  const role = props.currentUserRole.trim()
  return ROLE_LABELS[role] || role || '普通用户'
})
</script>

<template>
  <header class="topbar">
    <div class="hero-copy">
      <h1>你好，{{ greetingUserName }}！</h1>
      <span class="plan-pill">{{ roleLabel }}</span>
    </div>

    <div class="topbar-actions">
      <div class="profile-cluster">
        <div class="avatar">🦊</div>
        <button class="icon-button" aria-label="添加成员">
          <span>+</span>
        </button>
      </div>
      <button class="invite-button">邀请</button>
    </div>
  </header>
</template>
