<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSearchMagnetism } from '../composables/useSearchMagnetism'
import { scanFilters, scanRows, scanSeverityOrder, scanTabs } from '../data/scans'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  }
})

const keyword = ref('')
const selectedStatus = ref('全部状态')
const selectedType = ref('全部类型')
const openMenuId = ref(null)
const { setup: setupSearchMagnetism } = useSearchMagnetism('.scans-search')

const rowActionItems = [
  { key: 'rename', label: '重命名', tone: 'default' },
  { key: 'rescan', label: '重新扫描', tone: 'muted' },
  { key: 'delete', label: '删除', tone: 'danger' },
  { key: 'stop', label: '停止', tone: 'danger' },
]

const severityMeta = {
  critical: { label: 'Critical', accent: '#e07b88' },
  high: { label: 'High', accent: '#e28a3c' },
  medium: { label: 'Medium', accent: '#d7a24a' },
  low: { label: 'Low', accent: '#7e93ea' },
  info: { label: 'Info', accent: '#36ad67' },
  unknown: { label: 'Unknown', accent: '#9ca3af' },
}

const tableRows = computed(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()

  return scanRows.filter((item) => {
    if (!normalizedKeyword) {
      return true
    }

    return item.id.toLowerCase().includes(normalizedKeyword)
  })
})

function severityValue(row, key) {
  return row.severity[key] ?? 0
}

function pageSizeLabel(count) {
  return `${count} 条/页`
}

function severityLabel(key) {
  return severityMeta[key]?.label ?? 'Unknown'
}

function severityAccent(key) {
  return severityMeta[key]?.accent ?? '#9ca3af'
}

function toggleRowMenu(rowId) {
  openMenuId.value = openMenuId.value === rowId ? null : rowId
}

function closeRowMenu() {
  openMenuId.value = null
}

function handleDocumentClick(event) {
  if (!event.target.closest('.scans-actions-menu-wrap')) {
    closeRowMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  setupSearchMagnetism()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <main class="scans-page">
    <header class="scans-topbar">
      <nav class="scans-tabs" aria-label="扫描页面导航">
        <button
          v-for="item in scanTabs"
          :key="item.key"
          class="scans-tab"
          :class="{ active: item.key === 'overview' }"
        >
          <span class="scans-tab-icon" :class="`is-${item.key}`" aria-hidden="true">
            <svg v-if="item.key === 'overview'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2.8" />
              <path d="M18 6 15.5 8.5" />
            </svg>
            <svg v-else-if="item.key === 'regressions'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="4" y="4" width="6" height="6" rx="1.5" />
              <rect x="14" y="4" width="6" height="6" rx="1.5" />
              <rect x="4" y="14" width="6" height="6" rx="1.5" />
              <rect x="14" y="14" width="6" height="6" rx="1.5" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 4.5v2.2M12 17.3v2.2M19.5 12h-2.2M6.7 12H4.5M17.3 6.7l-1.6 1.6M8.3 15.7l-1.6 1.6M17.3 17.3l-1.6-1.6M8.3 8.3 6.7 6.7" />
            </svg>
          </span>
          <span>{{ item.label }}</span>
          <span v-if="item.count !== null" class="scans-tab-badge">{{ item.count }}</span>
        </button>
      </nav>
    </header>

    <section class="scans-content">
      <div class="scans-toolbar">
        <label class="scans-search">
          <input v-model="keyword" type="text" :placeholder="scanFilters.searchPlaceholder" />
          <span class="scans-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <button class="scans-filter-button">
          <span>{{ selectedStatus }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        <button class="scans-filter-button">
          <span>{{ selectedType }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        <button class="scans-toolbar-icon is-disabled" aria-label="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 7h8" />
            <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
            <path d="M6.5 7.5v9.2A2.3 2.3 0 0 0 8.8 19h6.4a2.3 2.3 0 0 0 2.3-2.3V7.5" />
          </svg>
        </button>

        <button class="scans-toolbar-icon" aria-label="刷新">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
        </button>

        <div class="scans-toolbar-spacer"></div>

        <button class="scans-upgrade-button" type="button" @click="props.navigateTo('/scans/create')">
          <span>发起任务</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <section class="scans-table-card">
        <header class="scans-table-head">
          <div class="scans-head-checkbox">
            <input type="checkbox" aria-label="全选扫描记录" />
          </div>
          <div>任务名称</div>
          <div>风险分布</div>
          <div>漏洞插件数量</div>
          <div>服务数</div>
          <div>时长</div>
          <div class="is-active">创建时间</div>
          <div></div>
        </header>

        <article v-for="row in tableRows" :key="row.id" class="scans-table-row">
          <div class="scans-row-checkbox">
            <input type="checkbox" :aria-label="`选择 ${row.id}`" />
          </div>

          <div class="scans-name-cell">
            <span class="scan-status-dot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m8.5 12.2 2.1 2.1 4.9-5.2" />
              </svg>
            </span>
            <span class="scan-name-text">{{ row.id }}</span>
            <span class="scan-info-icon">i</span>
            <span class="scan-device-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M10 6v3" />
                <path d="M14 6v3" />
                <path d="M7.5 10.5A4.5 4.5 0 0 1 12 6h0a4.5 4.5 0 0 1 4.5 4.5v2.5A4.5 4.5 0 0 1 12 17.5h0A4.5 4.5 0 0 1 7.5 13z" />
                <path d="M5 20h14" />
              </svg>
            </span>
          </div>

          <div class="scans-severity-cell">
            <div class="scans-severity-group">
              <span
                v-for="severityKey in scanSeverityOrder"
                :key="severityKey"
                class="scans-severity-badge"
                :class="`is-${severityKey}`"
                :style="{ '--severity-accent': severityAccent(severityKey) }"
              >
                <span class="scans-severity-value">{{ severityValue(row, severityKey) }}</span>
                <span class="scans-severity-tooltip" role="tooltip">
                  <span class="scans-severity-tooltip-glow"></span>
                  <span class="scans-severity-tooltip-label">{{ severityLabel(severityKey) }}</span>
                </span>
              </span>
            </div>
          </div>

          <div class="scans-muted-cell">{{ row.templates }}</div>
          <div class="scans-muted-cell">{{ row.services }}</div>
          <div class="scans-muted-cell">{{ row.duration }}</div>
          <div class="scans-updated-cell">{{ row.updatedAt }}</div>

          <div class="scans-actions-cell">
            <div class="scans-actions-menu-wrap">
              <button
                class="scans-row-icon"
                :class="{ 'is-active': openMenuId === row.id }"
                aria-label="更多操作"
                @click.stop="toggleRowMenu(row.id)"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5.5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="18.5" r="1.6" />
                </svg>
              </button>

              <div v-if="openMenuId === row.id" class="scans-actions-menu">
                <button
                  v-for="action in rowActionItems"
                  :key="action.key"
                  class="scans-actions-menu-item"
                  :class="`is-${action.tone}`"
                  type="button"
                  @click="closeRowMenu"
                >
                  <span class="scans-actions-menu-icon" aria-hidden="true">
                    <svg v-if="action.key === 'rename'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                      <path d="M4 20h4.2l9.9-9.9a1.7 1.7 0 0 0 0-2.4l-1.8-1.8a1.7 1.7 0 0 0-2.4 0L4 15.8V20Z" />
                      <path d="m12.5 7.5 4 4" />
                    </svg>
                    <svg v-else-if="action.key === 'rescan'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                      <path d="M4.5 11a7.5 7.5 0 0 1 12.7-4.9L20 9" />
                      <path d="M20 4v5h-5" />
                      <path d="M19.5 13a7.5 7.5 0 0 1-12.7 4.9L4 15" />
                      <path d="M4 20v-5h5" />
                    </svg>
                    <svg v-else-if="action.key === 'delete'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                      <path d="M4.5 7h15" />
                      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
                      <path d="M6.5 7.5v10A2.5 2.5 0 0 0 9 20h6a2.5 2.5 0 0 0 2.5-2.5v-10" />
                      <path d="M10 11v5" />
                      <path d="M14 11v5" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M10 9.5v5" />
                      <path d="M14 9.5v5" />
                    </svg>
                  </span>
                  <span>{{ action.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        <footer class="scans-pagination">
          <button class="scans-page-size">
            <span>{{ pageSizeLabel(10) }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>

          <div class="scans-pagination-meta">
            <button class="scans-pagination-arrow" aria-label="上一页">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m14.5 6.5-5 5 5 5" />
              </svg>
            </button>
            <span>显示 1 - 1，共 1 条</span>
            <button class="scans-pagination-arrow" aria-label="下一页">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m9.5 6.5 5 5-5 5" />
              </svg>
            </button>
          </div>
        </footer>
      </section>
    </section>
  </main>
</template>
