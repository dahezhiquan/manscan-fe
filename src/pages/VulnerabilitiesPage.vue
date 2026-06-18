<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSearchMagnetism } from '../composables/useSearchMagnetism'

const keyword = ref('')
const { setup: setupSearchMagnetism } = useSearchMagnetism('.vuln-search')

const filters = [
  { label: 'Sort by', active: true },
  { label: 'Time' },
  { label: 'Domain' },
  { label: 'Host' },
  { label: 'Status', badge: '3' },
  { label: 'Tags' },
  { label: 'Severity', badge: '5' },
  { label: 'Category' }
]

const vulnerabilityRows = [
  {
    id: 'CVE-2025-14847',
    severity: 'High',
    title: 'MongoDB 信息泄露（MongoBleed）（CVE-2025-14847）（服务漏洞）',
    count: 1,
    source: 'TEMPLATE',
    tag: 'CVE-2025-14847'
  }
]

const filteredRows = computed(() => {
  const search = keyword.value.trim().toLowerCase()

  if (!search) {
    return vulnerabilityRows
  }

  return vulnerabilityRows.filter((item) => `${item.title} ${item.id}`.toLowerCase().includes(search))
})

function pageSizeLabel(count) {
  return `${count} 条/页`
}

const resultText = computed(() => {
  const total = filteredRows.value.length
  const start = total === 0 ? 0 : 1

  return `显示 ${start} - ${total}，共 ${total} 条`
})

onMounted(() => {
  setupSearchMagnetism()
})

onBeforeUnmount(() => {
})
</script>

<template>
  <main class="vuln-page">
    <section class="vuln-toolbar">
      <label class="vuln-search">
        <input v-model="keyword" type="text" placeholder="Search results" />
        <span class="vuln-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </span>
      </label>

      <div class="vuln-toolbar-actions">
        <button class="vuln-action is-muted">
          <span>Export</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        <button class="vuln-action is-muted">
          <span>Mark as</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        <button class="vuln-icon-action is-muted" aria-label="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4.5 7.5h15" />
            <path d="M9.5 4.5h5" />
            <path d="M8 7.5v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-10" />
          </svg>
        </button>
      </div>
    </section>

    <section class="vuln-filter-panel">
      <div class="vuln-filter-row">
        <button
          v-for="item in filters"
          :key="item.label"
          class="vuln-filter-chip"
          :class="{ 'is-active': item.active }"
        >
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="vuln-filter-badge">{{ item.badge }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        <button class="vuln-clear-chip" aria-label="清空筛选">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M15.8 8.2 8.2 15.8" />
            <path d="M8.2 8.2 15.8 15.8" />
            <path d="M7.5 5.5h6.9a2.6 2.6 0 0 1 1.84.76l2.5 2.5a2.6 2.6 0 0 1 0 3.68l-2.5 2.5a2.6 2.6 0 0 1-1.84.76H7.5a2.5 2.5 0 0 1-2.5-2.5V8a2.5 2.5 0 0 1 2.5-2.5Z" />
          </svg>
        </button>
      </div>
    </section>

    <section class="vuln-results-card">
      <template v-if="filteredRows.length">
        <article v-for="item in filteredRows" :key="item.id" class="vuln-result-row">
          <div class="vuln-result-left">
            <label class="vuln-checkbox" aria-label="选择漏洞">
              <input type="checkbox" />
              <span></span>
            </label>

            <span class="vuln-severity-pill">{{ item.severity }}</span>

            <div class="vuln-title-block">
              <h3>{{ item.title }}</h3>
            </div>

            <span class="vuln-count-badge">{{ item.count }}</span>
          </div>

          <div class="vuln-result-right">
            <span class="vuln-meta-chip">{{ item.source }}</span>
            <span class="vuln-meta-chip is-filled">{{ item.tag }}</span>
            <button class="vuln-row-expand" aria-label="展开详情">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </button>
          </div>
        </article>
      </template>

      <div v-else class="vuln-empty-state">没有匹配的漏洞结果</div>

      <footer class="vuln-pagination">
        <button class="vuln-per-page">
          <span>{{ pageSizeLabel(10) }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        <div class="vuln-pagination-summary">
          <button class="vuln-page-nav" aria-label="上一页">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m14.5 6.5-5 5 5 5" />
            </svg>
          </button>
          <span>{{ resultText }}</span>
          <button class="vuln-page-nav" aria-label="下一页">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m9.5 6.5 5 5-5 5" />
            </svg>
          </button>
        </div>
      </footer>
    </section>
  </main>
</template>
