<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getTemplateList, getTemplateStats, getTemplateTags } from '../api/templates'
import { useSearchMagnetism } from '../composables/useSearchMagnetism'
import {
  booleanFilterOptions,
  protocolFilterOptions,
  severityFilterOptions,
  templateFilters,
  templateNavTabs,
  templateSummaryItems
} from '../data/templates'
import { iconPath } from '../utils/icons'
import { mapSeverityTone, normalizeTagOptions, readMultiValueParam } from '../utils/template'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  }
})

const keyword = ref('')
const activeFilterMenu = ref('')
const tagKeyword = ref('')
const selectedSeverity = ref([])
const selectedProtocol = ref([])
const selectedTags = ref([])
const selectedKev = ref('')
const selectedCve = ref('')
const currentPage = ref(1)
const pageSize = 20
const filtersRef = ref(null)
const statsData = ref({
  templateCount: null,
  cveTemplateCount: null,
  kevTemplateCount: null,
  fingerprintTemplateCount: null
})
const listState = ref({
  page: 1,
  pageSize,
  total: 0,
  totalPages: 0,
  items: []
})
const statsLoading = ref(true)
const listLoading = ref(false)
const copiedTemplateId = ref('')
const tagOptions = ref([])

let statsAbortController = null
let listAbortController = null
let tagAbortController = null
let searchTimer = null
let copyFeedbackTimer = null
const filterMagnetCleanup = []
const { setup: setupSearchMagnetism } = useSearchMagnetism('.templates-search')

const templateSummaryStats = computed(() =>
  templateSummaryItems.map((item) => ({
    ...item,
    value: formatStatValue(statsData.value[item.key])
  }))
)

const normalizedRows = computed(() =>
  listState.value.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    severity: item.severity?.trim() || '未定义',
    severityTone: mapSeverityTone(item.severity),
    author: item.author,
    actions: ['普通', '扫描']
  }))
)

const filteredRows = computed(() => normalizedRows.value)

const paginationTotal = computed(() => formatStatValue(listState.value.total))
const paginationStart = computed(() => {
  if (listState.value.total === 0 || listState.value.items.length === 0) {
    return 0
  }

  return (listState.value.page - 1) * listState.value.pageSize + 1
})

const paginationEnd = computed(() => {
  if (listState.value.total === 0 || listState.value.items.length === 0) {
    return 0
  }

  return Math.min(
    (listState.value.page - 1) * listState.value.pageSize + listState.value.items.length,
    listState.value.total
  )
})

const selectedSeverityOptions = computed(() =>
  severityFilterOptions.filter((item) => selectedSeverity.value.includes(item.value))
)
const selectedProtocolOptions = computed(() =>
  protocolFilterOptions.filter((item) => selectedProtocol.value.includes(item.value))
)
const filteredTagOptions = computed(() => {
  const keyword = tagKeyword.value.trim().toLowerCase()
  const selectedSet = new Set(selectedTags.value)
  const matched = tagOptions.value.filter((item) => {
    if (!keyword) {
      return true
    }

    return item.label.toLowerCase().includes(keyword) || item.value.toLowerCase().includes(keyword)
  })

  matched.sort((left, right) => {
    const leftSelected = selectedSet.has(left.value) ? 1 : 0
    const rightSelected = selectedSet.has(right.value) ? 1 : 0

    if (leftSelected !== rightSelected) {
      return rightSelected - leftSelected
    }

    return left.label.localeCompare(right.label)
  })

  return matched.slice(0, keyword ? 18 : 12)
})
const selectedKevOption = computed(
  () => booleanFilterOptions.find((item) => item.value === selectedKev.value) ?? null
)
const selectedCveOption = computed(
  () => booleanFilterOptions.find((item) => item.value === selectedCve.value) ?? null
)
const severityButtonLabel = computed(() =>
  formatMultiSelectLabel('风险等级', selectedSeverityOptions.value, 'englishLabel')
)
const protocolButtonLabel = computed(() =>
  formatMultiSelectLabel('协议', selectedProtocolOptions.value, 'label')
)
const tagButtonLabel = computed(() => {
  if (!selectedTags.value.length) {
    return '标签'
  }

  if (selectedTags.value.length === 1) {
    return `标签 · ${selectedTags.value[0]}`
  }

  return `标签 · 已选 ${selectedTags.value.length} 项`
})

function formatStatValue(value) {
  if (typeof value !== 'number') {
    return '--'
  }

  return value.toLocaleString('en-US')
}

function severityClass(tone) {
  return `template-severity-${tone}`
}

function severityMenuIconClass(tone) {
  return `severity-menu-icon-${tone}`
}

function formatMultiSelectLabel(baseLabel, selectedItems, labelKey) {
  if (selectedItems.length === 0) {
    return baseLabel
  }

  if (selectedItems.length === 1) {
    return `${baseLabel} · ${selectedItems[0][labelKey]}`
  }

  return `${baseLabel} · 已选 ${selectedItems.length} 项`
}

function isMenuOpen(name) {
  return activeFilterMenu.value === name
}

function toggleFilterMenu(name) {
  activeFilterMenu.value = activeFilterMenu.value === name ? '' : name
}

function selectFilterValue(key, value) {
  if (key === 'severity') {
    selectedSeverity.value = toggleMultiValue(selectedSeverity.value, value)
    return
  }

  if (key === 'protocol') {
    selectedProtocol.value = toggleMultiValue(selectedProtocol.value, value)
    return
  }

  if (key === 'kev') {
    selectedKev.value = selectedKev.value === value ? '' : value
  }

  if (key === 'cve') {
    selectedCve.value = selectedCve.value === value ? '' : value
  }

  activeFilterMenu.value = ''
}

function toggleMultiValue(currentValues, targetValue) {
  return currentValues.includes(targetValue)
    ? currentValues.filter((item) => item !== targetValue)
    : [...currentValues, targetValue]
}

function hydrateFiltersFromQuery() {
  const searchParams = new URLSearchParams(window.location.search)

  keyword.value = searchParams.get('name')?.trim() ?? ''
  selectedTags.value = readMultiValueParam(searchParams, 'tag')
  selectedSeverity.value = readMultiValueParam(searchParams, 'severity')
  selectedProtocol.value = readMultiValueParam(searchParams, 'protocol')
  selectedKev.value = searchParams.get('iskev')?.trim() ?? ''
  selectedCve.value = searchParams.get('iscve')?.trim() ?? ''
}

async function fetchTemplateStats() {
  statsAbortController?.abort()
  statsAbortController = new AbortController()
  statsLoading.value = true

  try {
    const data = await getTemplateStats(statsAbortController.signal)

    statsData.value = {
      templateCount: Number(data.templateCount) || 0,
      cveTemplateCount: Number(data.cveTemplateCount) || 0,
      kevTemplateCount: Number(data.kevTemplateCount) || 0,
      fingerprintTemplateCount: Number(data.fingerprintTemplateCount) || 0
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板统计数据失败:', error)
    }
  } finally {
    statsLoading.value = false
  }
}

async function fetchTemplateList(page = 1) {
  listAbortController?.abort()
  listAbortController = new AbortController()
  listLoading.value = true

  try {
    const data = await getTemplateList(
      {
        page,
        pageSize,
        keyword: keyword.value,
        tags: selectedTags.value,
        severity: selectedSeverity.value,
        protocol: selectedProtocol.value,
        kev: selectedKev.value,
        cve: selectedCve.value
      },
      listAbortController.signal
    )

    listState.value = {
      page: Number(data.page) || page,
      pageSize: Number(data.pageSize) || pageSize,
      total: Number(data.total) || 0,
      totalPages: Number(data.totalPages) || 0,
      items: Array.isArray(data.items) ? data.items : []
    }

    currentPage.value = listState.value.page
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板列表失败:', error)
      listState.value = {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        items: []
      }
    }
  } finally {
    listLoading.value = false
  }
}

function changePage(page) {
  if (page < 1 || page > listState.value.totalPages || page === currentPage.value) {
    return
  }

  fetchTemplateList(page)
}

async function copyTemplateId(templateId) {
  try {
    await navigator.clipboard.writeText(templateId)
    copiedTemplateId.value = templateId
    window.clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = window.setTimeout(() => {
      copiedTemplateId.value = ''
    }, 1400)
  } catch (error) {
    console.error('复制模板 ID 失败:', error)
  }
}

function openTemplateDetail(templateId) {
  window.open(`/templates/${templateId}`, '_blank', 'noopener,noreferrer')
}

function handleDocumentClick(event) {
  if (!filtersRef.value?.contains(event.target)) {
    activeFilterMenu.value = ''
  }
}

async function setupFilterMagnetism() {
  await nextTick()

  filterMagnetCleanup.splice(0).forEach((cleanup) => cleanup())

  const chips = document.querySelectorAll('.templates-filter-chip')

  chips.forEach((chip) => {
    const handleMove = (event) => {
      const rect = chip.getBoundingClientRect()
      const offsetX = event.clientX - (rect.left + rect.width / 2)
      const offsetY = event.clientY - (rect.top + rect.height / 2)
      const moveX = Math.max(-6, Math.min(6, offsetX * 0.12))
      const moveY = Math.max(-4, Math.min(4, offsetY * 0.12))

      chip.style.setProperty('--magnet-x', `${moveX}px`)
      chip.style.setProperty('--magnet-y', `${moveY}px`)
      chip.style.setProperty('--magnet-scale', '1.03')
    }

    const handleLeave = () => {
      chip.style.setProperty('--magnet-x', '0px')
      chip.style.setProperty('--magnet-y', '0px')
      chip.style.setProperty('--magnet-scale', '1')
    }

    chip.addEventListener('mousemove', handleMove)
    chip.addEventListener('mouseleave', handleLeave)

    filterMagnetCleanup.push(() => {
      chip.removeEventListener('mousemove', handleMove)
      chip.removeEventListener('mouseleave', handleLeave)
    })
  })
}

async function fetchTemplateTags() {
  tagAbortController?.abort()
  tagAbortController = new AbortController()

  try {
    const data = await getTemplateTags(tagAbortController.signal)
    tagOptions.value = normalizeTagOptions(data)
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('加载模板标签失败:', error)
      tagOptions.value = []
    }
  }
}

onMounted(() => {
  hydrateFiltersFromQuery()
  fetchTemplateStats()
  fetchTemplateTags()
  fetchTemplateList(currentPage.value)
  document.addEventListener('click', handleDocumentClick)
  setupFilterMagnetism()
})

watch([keyword, selectedTags, selectedSeverity, selectedProtocol, selectedKev, selectedCve], () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    fetchTemplateList(1)
  }, 250)
})

onBeforeUnmount(() => {
  statsAbortController?.abort()
  listAbortController?.abort()
  tagAbortController?.abort()
  window.clearTimeout(searchTimer)
  window.clearTimeout(copyFeedbackTimer)
  document.removeEventListener('click', handleDocumentClick)
  filterMagnetCleanup.splice(0).forEach((cleanup) => cleanup())
})
</script>

<template>
  <main class="templates-page">
    <header class="templates-topbar">
      <nav class="templates-nav">
        <button
          v-for="item in templateNavTabs"
          :key="item.label"
          class="templates-nav-item"
          :class="{ active: item.active }"
        >
          <span class="templates-nav-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              v-html="iconPath(item.icon)"
            />
          </span>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </header>

    <section class="templates-content">
      <div class="templates-stats">
        <article
          v-for="item in templateSummaryStats"
          :key="item.label"
          class="templates-stat-card"
          :class="{ 'is-loading': statsLoading }"
        >
          <template v-if="statsLoading">
            <div class="templates-skeleton templates-skeleton-value"></div>
            <div class="templates-skeleton templates-skeleton-label"></div>
          </template>

          <template v-else>
          <div class="templates-stat-value">{{ item.value }}</div>
          <div class="templates-stat-label">{{ item.label }}</div>
          </template>
        </article>
      </div>

      <div ref="filtersRef" class="templates-filters">
        <label class="templates-search">
          <input v-model="keyword" type="text" placeholder="搜索模板..." />
          <span class="templates-search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
        </label>

        <div class="templates-filter-wrap">
          <button
            class="templates-filter-chip"
            :class="{ active: isMenuOpen('severity') || selectedSeverity.length }"
            @click.stop="toggleFilterMenu('severity')"
          >
            <span>{{ severityButtonLabel }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="isMenuOpen('severity') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen('severity')" class="severity-menu">
            <button
              v-for="item in severityFilterOptions"
              :key="item.value"
              class="severity-menu-item"
              @click.stop="selectFilterValue('severity', item.value)"
            >
              <span
                class="severity-menu-check"
                :class="{ selected: selectedSeverity.includes(item.value) }"
                aria-hidden="true"
              ></span>

              <span class="severity-menu-label">
                <span class="severity-menu-icon" :class="severityMenuIconClass(item.tone)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M12 3.5 18.5 6v6c0 4.2-2.7 7.8-6.5 9-3.8-1.2-6.5-4.8-6.5-9V6L12 3.5Z" />
                  </svg>
                </span>
                <span>{{ item.englishLabel }}</span>
              </span>
            </button>
          </div>
        </div>

        <div class="templates-filter-wrap">
          <button
            class="templates-filter-chip"
            :class="{ active: isMenuOpen('tag') || selectedTags.length }"
            @click.stop="toggleFilterMenu('tag')"
          >
            <span>{{ tagButtonLabel }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="isMenuOpen('tag') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen('tag')" class="severity-menu templates-tag-menu">
            <div class="templates-menu-search">
              <input
                v-model="tagKeyword"
                type="text"
                placeholder="搜索标签"
              />
            </div>

            <div v-if="selectedTags.length > 0" class="templates-selected-tags">
              <button
                v-for="tag in selectedTags"
                :key="tag"
                class="templates-selected-tag"
                @click.stop="selectedTags = selectedTags.filter((item) => item !== tag)"
              >
                <span>#{{ tag }}</span>
                <small>移除</small>
              </button>
            </div>

            <div class="templates-tag-menu-list">
              <button
                v-for="item in filteredTagOptions"
                :key="item.value"
                class="severity-menu-item"
                @click.stop="selectedTags = toggleMultiValue(selectedTags, item.value)"
              >
                <span
                  class="severity-menu-check"
                  :class="{ selected: selectedTags.includes(item.value) }"
                  aria-hidden="true"
                ></span>

                <span class="severity-menu-label templates-tag-menu-label">
                  <strong>#{{ item.label }}</strong>
                  <small v-if="item.count">{{ item.count }}</small>
                </span>
              </button>

              <p v-if="filteredTagOptions.length === 0" class="templates-tag-empty">
                没有匹配到标签，请换个关键词试试。
              </p>
            </div>
          </div>
        </div>

        <div class="templates-filter-wrap">
          <button
            class="templates-filter-chip"
            :class="{ active: isMenuOpen('protocol') || selectedProtocol.length }"
            @click.stop="toggleFilterMenu('protocol')"
          >
            <span>{{ protocolButtonLabel }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="isMenuOpen('protocol') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen('protocol')" class="severity-menu protocol-menu">
            <button
              v-for="item in protocolFilterOptions"
              :key="item.value"
              class="severity-menu-item"
              @click.stop="selectFilterValue('protocol', item.value)"
            >
              <span
                class="severity-menu-check"
                :class="{ selected: selectedProtocol.includes(item.value) }"
                aria-hidden="true"
              ></span>

              <span class="severity-menu-label">
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </div>

        <button class="templates-filter-chip">
          <span>{{ templateFilters.find((label) => label === '产品') }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>

        <div class="templates-filter-wrap">
          <button
            class="templates-filter-chip"
            :class="{ active: isMenuOpen('kev') || selectedKev }"
            @click.stop="toggleFilterMenu('kev')"
          >
            <span>{{ selectedKevOption ? `KEV · ${selectedKevOption.label}` : 'KEV' }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="isMenuOpen('kev') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen('kev')" class="severity-menu boolean-menu">
            <button
              v-for="item in booleanFilterOptions"
              :key="item.value"
              class="severity-menu-item"
              @click.stop="selectFilterValue('kev', item.value)"
            >
              <span
                class="severity-menu-check"
                :class="{ selected: selectedKev === item.value }"
                aria-hidden="true"
              ></span>

              <span class="severity-menu-label">
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </div>

        <div class="templates-filter-wrap">
          <button
            class="templates-filter-chip"
            :class="{ active: isMenuOpen('cve') || selectedCve }"
            @click.stop="toggleFilterMenu('cve')"
          >
            <span>{{ selectedCveOption ? `CVE · ${selectedCveOption.label}` : 'CVE' }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path :d="isMenuOpen('cve') ? 'm7 14 5-5 5 5' : 'm7 10 5 5 5-5'" />
            </svg>
          </button>

          <div v-if="isMenuOpen('cve')" class="severity-menu boolean-menu">
            <button
              v-for="item in booleanFilterOptions"
              :key="item.value"
              class="severity-menu-item"
              @click.stop="selectFilterValue('cve', item.value)"
            >
              <span
                class="severity-menu-check"
                :class="{ selected: selectedCve === item.value }"
                aria-hidden="true"
              ></span>

              <span class="severity-menu-label">
                <span>{{ item.label }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <section class="templates-table-card">
        <div class="templates-table-head">
          <div>模板名称</div>
          <div>风险等级</div>
          <div>模板 ID</div>
          <div>模板作者</div>
          <div></div>
        </div>

        <template v-if="listLoading">
          <article
            v-for="index in 6"
            :key="`skeleton-${index}`"
            class="templates-row templates-row-skeleton"
          >
            <div class="templates-name-cell">
              <div class="templates-skeleton templates-skeleton-title"></div>
              <div class="templates-skeleton templates-skeleton-text short"></div>
              <div class="templates-skeleton templates-skeleton-text"></div>
            </div>

            <div class="templates-severity-cell">
              <div class="templates-skeleton templates-skeleton-pill"></div>
            </div>

            <div class="templates-id-cell">
              <div class="templates-skeleton templates-skeleton-inline"></div>
            </div>

            <div class="templates-author-cell">
              <div class="templates-skeleton templates-skeleton-inline compact"></div>
            </div>

            <div class="templates-actions-cell">
              <div class="templates-skeleton templates-skeleton-button slim"></div>
              <div class="templates-skeleton templates-skeleton-button"></div>
              <div class="templates-skeleton templates-skeleton-button"></div>
            </div>
          </article>
        </template>

        <template v-else-if="filteredRows.length > 0">
          <article
            v-for="item in filteredRows"
            :key="item.id"
            class="templates-row"
            @click="openTemplateDetail(item.id)"
          >
            <div class="templates-name-cell">
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
            </div>

            <div class="templates-severity-cell">
              <span class="templates-severity-pill" :class="severityClass(item.severityTone)">
                {{ item.severity }}
              </span>
            </div>

            <div class="templates-id-cell">
              <span>{{ item.id }}</span>
              <button
                class="template-id-copy"
                :class="{ copied: copiedTemplateId === item.id }"
                :aria-label="copiedTemplateId === item.id ? '已复制模板 ID' : '复制模板 ID'"
                @click.stop="copyTemplateId(item.id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            <div class="templates-author-cell">{{ item.author }}</div>

            <div class="templates-actions-cell">
              <button class="templates-action-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M7.5 6.5h9" />
                  <path d="M7.5 12h9" />
                  <path d="M7.5 17.5h9" />
                  <circle cx="5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="5" cy="17.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span>{{ item.actions[0] }}</span>
              </button>
              <button class="templates-action-button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="6.6" />
                  <circle cx="12" cy="12" r="2.4" />
                  <path d="M16.8 7.2a7.2 7.2 0 0 1 0 9.6" />
                </svg>
                <span>{{ item.actions[1] }}</span>
              </button>
            </div>
          </article>
        </template>

        <div v-else class="templates-empty">
          没有匹配的模板结果
        </div>

        <footer class="templates-pagination">
          <button
            class="templates-page-arrow"
            :disabled="currentPage <= 1"
            aria-label="上一页"
            @click="changePage(currentPage - 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m14.5 6.5-5 5 5 5" />
            </svg>
          </button>
          <span>显示 {{ paginationStart }} - {{ paginationEnd }}，共 {{ paginationTotal }} 条</span>
          <button
            class="templates-page-arrow"
            :disabled="currentPage >= listState.totalPages"
            aria-label="下一页"
            @click="changePage(currentPage + 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="m9.5 6.5 5 5-5 5" />
            </svg>
          </button>
        </footer>
      </section>
    </section>
  </main>
</template>
