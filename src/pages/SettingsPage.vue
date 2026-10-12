<script setup>
import { computed, reactive, ref } from 'vue'
import AppShell from '../components/layout/AppShell.vue'
import { iconPath } from '../utils/icons'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/settings'
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

const SETTINGS_TABS = [
  { id: 'users', label: '用户管理', icon: 'server' },
  { id: 'theme', label: '主题管理', icon: 'editor' },
  { id: 'notifications', label: '通知策略', icon: 'shield' }
]

const USER_ROWS = [
  { id: 1, name: 'admin', email: 'admin@manscan.local', role: '系统管理员', status: '启用', lastActive: '刚刚' },
  { id: 2, name: 'scan-ops', email: 'scan-ops@manscan.local', role: '扫描负责人', status: '启用', lastActive: '18 分钟前' },
  { id: 3, name: 'viewer', email: 'viewer@manscan.local', role: '只读成员', status: '停用', lastActive: '7 天前' }
]

const THEME_OPTIONS = [
  { id: 'cartoon', label: '经典手绘', description: '沿用当前 ManScan 控制台视觉。', swatches: ['#ffd54f', '#84d7ff', '#ffb6b9'] },
  { id: 'light', label: '清爽浅色', description: '降低装饰感，适合高频数据录入。', swatches: ['#f8fafc', '#3b82f6', '#f59e0b'] },
  { id: 'contrast', label: '高对比', description: '强化边界和文字对比，适合投屏与弱光环境。', swatches: ['#1f1a17', '#ffffff', '#b9f19f'] }
]

const NOTIFICATION_POLICIES = [
  { id: 'scanFinished', label: '扫描完成通知', description: '任务完成或失败时通知任务创建人。' },
  { id: 'criticalVulnerability', label: '严重漏洞提醒', description: '发现严重漏洞后立即提醒负责人。' },
  { id: 'dailyDigest', label: '每日安全摘要', description: '每天汇总新增资产、漏洞和任务执行情况。' }
]

const activeTab = ref(SETTINGS_TABS[0].id)
const settingsState = reactive({
  selectedUserId: USER_ROWS[0].id,
  selectedTheme: THEME_OPTIONS[0].id,
  compactMode: false,
  reduceMotion: true,
  scanFinished: true,
  criticalVulnerability: true,
  dailyDigest: false,
  notifyChannel: 'email',
  notifyThreshold: 'high'
})
const savedSnapshot = ref(JSON.stringify(settingsState))
const saveState = ref('idle')

const activeTabMeta = computed(
  () => SETTINGS_TABS.find((item) => item.id === activeTab.value) ?? SETTINGS_TABS[0]
)
const selectedUser = computed(
  () => USER_ROWS.find((item) => item.id === settingsState.selectedUserId) ?? USER_ROWS[0]
)
const selectedTheme = computed(
  () => THEME_OPTIONS.find((item) => item.id === settingsState.selectedTheme) ?? THEME_OPTIONS[0]
)
const enabledNotificationCount = computed(() =>
  NOTIFICATION_POLICIES.filter((item) => Boolean(settingsState[item.id])).length
)
const isDirty = computed(() => JSON.stringify(settingsState) !== savedSnapshot.value)
const saveButtonLabel = computed(() => {
  if (saveState.value === 'saving') {
    return '保存中'
  }

  if (saveState.value === 'saved') {
    return '已保存'
  }

  return '保存设置'
})

function selectTab(tabId) {
  activeTab.value = tabId
}

async function saveSettings() {
  saveState.value = 'saving'

  await new Promise((resolve) => {
    window.setTimeout(resolve, 360)
  })

  savedSnapshot.value = JSON.stringify(settingsState)
  saveState.value = 'saved'

  window.setTimeout(() => {
    if (saveState.value === 'saved') {
      saveState.value = 'idle'
    }
  }, 1600)
}

function resetSettings() {
  Object.assign(settingsState, JSON.parse(savedSnapshot.value))
  saveState.value = 'idle'
}
</script>

<template>
  <AppShell
    :current-path="props.currentPath"
    :is-sidebar-collapsed="props.isSidebarCollapsed"
    :current-user-name="props.currentUserName"
    main-class="settings-shell-main"
    @toggle-sidebar="emit('toggle-sidebar')"
    @navigate="props.navigateTo"
    @logout="emit('logout')"
  >
    <main class="settings-page">
      <header class="settings-hero">
        <div>
          <div class="settings-page-crumbs" aria-label="当前位置">
            <span class="settings-page-crumb">
              <span class="settings-page-crumb-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath('gear')" />
              </span>
              系统设置
            </span>
          </div>
          <h1>设置</h1>
          <p>通过二级导航管理用户、主题和通知策略。</p>
        </div>
      </header>

      <div class="settings-workspace">
        <nav class="settings-tabs" aria-label="设置二级导航">
          <button
            v-for="tab in SETTINGS_TABS"
            :key="tab.id"
            type="button"
            class="settings-tab"
            :class="{ active: activeTab === tab.id }"
            @click="selectTab(tab.id)"
          >
            <span class="settings-tab-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" v-html="iconPath(tab.icon)" />
            </span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <form class="settings-layout" @submit.prevent="saveSettings">
          <section class="settings-panel settings-panel--wide">
            <div class="settings-panel-head">
              <div>
                <span class="settings-panel-kicker">Settings</span>
                <h2>{{ activeTabMeta.label }}</h2>
              </div>
              <span class="settings-panel-meta">当前用户：{{ props.currentUserName }}</span>
            </div>

            <div v-if="activeTab === 'users'" class="settings-users-grid">
              <div class="settings-user-list" role="listbox" aria-label="用户列表">
                <button
                  v-for="user in USER_ROWS"
                  :key="user.id"
                  type="button"
                  class="settings-user-row"
                  :class="{ active: settingsState.selectedUserId === user.id }"
                  @click="settingsState.selectedUserId = user.id"
                >
                  <span class="settings-user-avatar" aria-hidden="true">{{ user.name.slice(0, 1).toUpperCase() }}</span>
                  <span class="settings-user-copy">
                    <strong>{{ user.name }}</strong>
                    <small>{{ user.email }}</small>
                  </span>
                  <span class="settings-status-pill" :class="{ disabled: user.status === '停用' }">{{ user.status }}</span>
                </button>
              </div>

              <div class="settings-detail-panel">
                <div class="settings-detail-head">
                  <span class="settings-user-avatar is-large" aria-hidden="true">{{ selectedUser.name.slice(0, 1).toUpperCase() }}</span>
                  <div>
                    <h3>{{ selectedUser.name }}</h3>
                    <p>{{ selectedUser.email }}</p>
                  </div>
                </div>
                <dl class="settings-detail-list">
                  <div>
                    <dt>角色</dt>
                    <dd>{{ selectedUser.role }}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{{ selectedUser.status }}</dd>
                  </div>
                  <div>
                    <dt>最近活跃</dt>
                    <dd>{{ selectedUser.lastActive }}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div v-else-if="activeTab === 'theme'" class="settings-theme-grid">
              <label
                v-for="theme in THEME_OPTIONS"
                :key="theme.id"
                class="settings-theme-card"
                :class="{ active: settingsState.selectedTheme === theme.id }"
              >
                <input v-model="settingsState.selectedTheme" type="radio" name="settings-theme" :value="theme.id" />
                <span class="settings-theme-swatches" aria-hidden="true">
                  <span v-for="color in theme.swatches" :key="color" :style="{ backgroundColor: color }"></span>
                </span>
                <strong>{{ theme.label }}</strong>
                <small>{{ theme.description }}</small>
              </label>

              <div class="settings-detail-panel settings-theme-preview">
                <div class="settings-panel-head">
                  <div>
                    <span class="settings-panel-kicker">Preview</span>
                    <h2>{{ selectedTheme.label }}</h2>
                  </div>
                </div>
                <div class="settings-toggle-list">
                  <label class="settings-toggle-row">
                    <span>
                      <strong>紧凑模式</strong>
                      <small>压缩列表、表格和表单间距。</small>
                    </span>
                    <input v-model="settingsState.compactMode" type="checkbox" class="settings-switch-input" />
                    <span class="settings-switch" aria-hidden="true"></span>
                  </label>
                  <label class="settings-toggle-row">
                    <span>
                      <strong>减少动效</strong>
                      <small>降低过渡动画，提升低性能设备稳定性。</small>
                    </span>
                    <input v-model="settingsState.reduceMotion" type="checkbox" class="settings-switch-input" />
                    <span class="settings-switch" aria-hidden="true"></span>
                  </label>
                </div>
              </div>
            </div>

            <div v-else class="settings-notification-grid">
              <div class="settings-toggle-list">
                <label v-for="policy in NOTIFICATION_POLICIES" :key="policy.id" class="settings-toggle-row">
                  <span>
                    <strong>{{ policy.label }}</strong>
                    <small>{{ policy.description }}</small>
                  </span>
                  <input v-model="settingsState[policy.id]" type="checkbox" class="settings-switch-input" />
                  <span class="settings-switch" aria-hidden="true"></span>
                </label>
              </div>

              <div class="settings-detail-panel">
                <div class="settings-panel-head">
                  <div>
                    <span class="settings-panel-kicker">Policy</span>
                    <h2>{{ enabledNotificationCount }} 项启用</h2>
                  </div>
                </div>
                <div class="settings-form-grid">
                  <label class="settings-field">
                    <span>通知渠道</span>
                    <select v-model="settingsState.notifyChannel">
                      <option value="email">邮件</option>
                      <option value="webhook">Webhook</option>
                      <option value="both">邮件 + Webhook</option>
                    </select>
                  </label>
                  <label class="settings-field">
                    <span>提醒阈值</span>
                    <select v-model="settingsState.notifyThreshold">
                      <option value="critical">严重及以上</option>
                      <option value="high">高危及以上</option>
                      <option value="medium">中危及以上</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <div class="settings-save-bar" :class="{ 'is-dirty': isDirty }">
            <div>
              <strong>{{ isDirty ? '有未保存的设置' : '设置已同步' }}</strong>
              <p>当前设置保存在前端状态，后续接入接口后可替换保存逻辑。</p>
            </div>
            <div class="settings-save-actions">
              <button type="button" class="settings-button" :disabled="!isDirty || saveState === 'saving'" @click="resetSettings">
                撤销
              </button>
              <button type="submit" class="settings-button settings-button--primary" :disabled="saveState === 'saving'">
                {{ saveButtonLabel }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  </AppShell>
</template>
