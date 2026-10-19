<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getDomainAssetDetail, updateDomainAssetManualNote } from '../api/domain-assets'
import manscanIcon from '../assets/manscan-icon.png'
import DomainAssetScreenshots from '../components/domain-assets/DomainAssetScreenshots.vue'
import {
  buildDomainAssetFlagItems,
  normalizeDomainAssetDetail
} from '../utils/domainAsset'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/assets/domains'
  }
})

const detailLoading = ref(true)
const detailError = ref('')
const detailData = ref(null)
const copiedState = ref('')
const copyEffectTick = ref(0)
const isManualNoteDialogOpen = ref(false)
const manualNoteDraft = ref('')
const manualNoteError = ref('')
const manualNoteSaving = ref(false)

let detailAbortController = null
let manualNoteAbortController = null
let copyFeedbackTimer = null
let currentRequestId = 0

const MANUAL_NOTE_MAX_LENGTH = 5000

const domain = computed(() => {
  const match = props.currentPath.match(/^\/assets\/domains\/([^/]+)$/)
  return decodeURIComponent(match?.[1] ?? '')
})

const detail = computed(() => (detailData.value ? normalizeDomainAssetDetail(detailData.value) : null))
const pageTitle = computed(() => {
  const target = detail.value?.domain && detail.value.domain !== '--' ? detail.value.domain : domain.value
  return target ? `域名资产详情 - ${target}` : 'ManScan - 域名资产详情'
})

const overviewItems = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    { label: '域名资产', value: detail.value.domain, monospace: true },
    { label: '站点标题', value: detail.value.title },
    { label: '资产归属', value: detail.value.owner },
    { label: '区域', value: detail.value.region },
    { label: '风险等级', value: detail.value.riskMeta.label, riskTone: detail.value.riskMeta.tone },
    { label: '漏洞数量', value: detail.value.vulnerabilityCountDisplay },
    { label: 'HTTP 状态码', value: detail.value.httpStatusCode },
    {
      label: '存活状态',
      value: detail.value.isAliveMeta.label,
      statusTone: detail.value.isAliveMeta.tone
    }
  ]
})

const flagItems = computed(() => (detail.value ? buildDomainAssetFlagItems(detail.value) : []))

const timelineItems = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    { label: '首次存活时间', value: detail.value.firstAliveAtDisplay },
    { label: '最近存活时间', value: detail.value.lastAliveAtDisplay }
  ]
})

const evidenceSections = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    {
      key: 'request',
      filename: 'request.http',
      copyLabel: '复制请求',
      copiedLabel: '已复制请求',
      value: detail.value.request
    },
    {
      key: 'response',
      filename: 'response.http',
      copyLabel: '复制响应',
      copiedLabel: '已复制响应',
      value: detail.value.response
    }
  ]
})

const manualNoteLength = computed(() => manualNoteDraft.value.length)
const canSaveManualNote = computed(() =>
  !manualNoteSaving.value && manualNoteLength.value <= MANUAL_NOTE_MAX_LENGTH
)

function getAlivePillClass(tone) {
  return `domain-asset-detail-alive-pill is-${tone}`
}

function goBackToList() {
  props.navigateTo('/assets/domains')
}

function refreshDetail() {
  void fetchDomainAssetDetail()
}

function openManualNoteDialog() {
  manualNoteDraft.value = getManualNoteValue()
  manualNoteError.value = ''
  isManualNoteDialogOpen.value = true
}

function closeManualNoteDialog() {
  if (manualNoteSaving.value) {
    return
  }

  isManualNoteDialogOpen.value = false
  manualNoteError.value = ''
}

async function copyEvidence(section) {
  try {
    copyEffectTick.value += 1
    await copyTextToClipboard(section.value)
    triggerCopiedFeedback(section.key)
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : '复制失败，请手动选择内容复制。'
  }
}

async function copyShareLink() {
  try {
    copyEffectTick.value += 1
    await copyTextToClipboard(window.location.href)
    triggerCopiedFeedback('share')
  } catch (error) {
    detailError.value = error instanceof Error ? error.message : '复制失败，请手动选择内容复制。'
  }
}

function triggerCopiedFeedback(type) {
  copiedState.value = type
  window.clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = window.setTimeout(() => {
    copiedState.value = ''
  }, 1400)
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  document.body.appendChild(textArea)
  textArea.select()

  const succeeded = document.execCommand('copy')
  document.body.removeChild(textArea)

  if (!succeeded) {
    throw new Error('浏览器不支持剪切板复制')
  }
}

async function fetchDomainAssetDetail() {
  detailAbortController?.abort()
  detailAbortController = new AbortController()
  const requestId = ++currentRequestId
  detailLoading.value = true
  detailError.value = ''

  if (!domain.value) {
    detailData.value = null
    detailError.value = '缺少域名资产参数，请从域名资产清单进入详情。'
    detailLoading.value = false
    return
  }

  try {
    const data = await getDomainAssetDetail(domain.value, detailAbortController.signal)
    if (requestId === currentRequestId) {
      detailData.value = data
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && requestId === currentRequestId) {
      detailError.value = error instanceof Error ? error.message : '域名资产详情加载失败，请稍后重试。'
      detailData.value = null
    }
  } finally {
    if (requestId === currentRequestId) {
      detailLoading.value = false
      detailAbortController = null
    }
  }
}

async function saveManualNote() {
  const targetDomain = detail.value?.domain && detail.value.domain !== '--' ? detail.value.domain : domain.value

  if (!canSaveManualNote.value || !targetDomain) {
    return
  }

  manualNoteAbortController?.abort()
  manualNoteAbortController = new AbortController()
  manualNoteSaving.value = true
  manualNoteError.value = ''

  try {
    const data = await updateDomainAssetManualNote(
      targetDomain,
      manualNoteDraft.value,
      manualNoteAbortController.signal
    )
    const nextManualNote = String(data?.manual_note ?? data?.manualNote ?? manualNoteDraft.value ?? '').trim()
    applyManualNote(nextManualNote)
    isManualNoteDialogOpen.value = false
  } catch (error) {
    if (error?.name !== 'AbortError') {
      manualNoteError.value = error instanceof Error ? error.message : '人工备注保存失败，请稍后重试。'
    }
  } finally {
    manualNoteSaving.value = false
    manualNoteAbortController = null
  }
}

function getManualNoteValue() {
  const rawDetail = detailData.value?.domain_asset && typeof detailData.value.domain_asset === 'object'
    ? detailData.value.domain_asset
    : detailData.value

  return String(rawDetail?.manual_note ?? rawDetail?.manualNote ?? '').trim()
}

function applyManualNote(manualNote) {
  if (!detailData.value) {
    return
  }

  const target = detailData.value.domain_asset && typeof detailData.value.domain_asset === 'object'
    ? detailData.value.domain_asset
    : detailData.value

  target.manual_note = manualNote
  target.manualNote = manualNote
}

onMounted(() => {
  void fetchDomainAssetDetail()
})

watch(
  () => domain.value,
  () => {
    void fetchDomainAssetDetail()
  }
)

watch(
  pageTitle,
  (title) => {
    document.title = title
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  detailAbortController?.abort()
  manualNoteAbortController?.abort()
  window.clearTimeout(copyFeedbackTimer)
})
</script>

<template>
  <main class="template-detail-page domain-asset-detail-page">
    <section class="template-detail-content">
      <div class="template-detail-crumbs">
        <button class="template-detail-crumb-button" type="button" @click="goBackToList">
          <img class="template-detail-crumb-logo" :src="manscanIcon" alt="ManScan" />
          <span class="template-detail-crumb-separator">/</span>
          <span class="template-detail-crumb-library-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M3.6 9h16.8" />
              <path d="M3.6 15h16.8" />
              <path d="M12 3a14 14 0 0 1 0 18" />
              <path d="M12 3a14 14 0 0 0 0 18" />
            </svg>
          </span>
          <span>域名资产清单</span>
        </button>
      </div>

      <div v-if="detailError" class="template-detail-alert">
        <span>{{ detailError }}</span>
      </div>

      <div class="template-detail-hero">
        <div class="template-detail-hero-main">
          <h1>{{ detail?.domain || domain || '域名资产详情' }}</h1>
          <p v-if="detail?.title && detail.title !== '--'" class="domain-asset-detail-subtitle">
            {{ detail.title }}
          </p>
        </div>

        <div class="template-detail-actions">
          <button class="template-detail-secondary-button" type="button" @click="goBackToList">
            返回清单
          </button>
          <button
            class="template-detail-secondary-button effect-button share-button"
            :class="{ 'is-copied': copiedState === 'share' }"
            type="button"
            @click="copyShareLink"
          >
            <span
              v-if="copiedState === 'share'"
              :key="copyEffectTick"
              class="template-detail-share-burst"
              aria-hidden="true"
            ></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <circle cx="18" cy="5.5" r="2.2" />
              <circle cx="6" cy="12" r="2.2" />
              <circle cx="18" cy="18.5" r="2.2" />
              <path d="M8 11 16 6.5" />
              <path d="M8 13l8 4.5" />
            </svg>
            <span>{{ copiedState === 'share' ? '已复制链接' : '分享' }}</span>
          </button>
          <button class="template-detail-secondary-button" type="button" @click="refreshDetail">刷新</button>
        </div>
      </div>

      <div v-if="detailLoading" class="template-detail-loading-grid" aria-hidden="true">
        <article class="template-detail-skeleton-card large">
          <div class="template-detail-skeleton-line title w-48"></div>
          <div class="template-detail-skeleton-copy">
            <div class="template-detail-skeleton-block">
              <div class="template-detail-skeleton-line subtitle w-24"></div>
              <div class="template-detail-skeleton-line text w-full"></div>
              <div class="template-detail-skeleton-line text w-92"></div>
              <div class="template-detail-skeleton-line text w-78"></div>
            </div>
            <div class="template-detail-skeleton-block">
              <div class="template-detail-skeleton-line subtitle w-24"></div>
              <div class="template-detail-skeleton-line text w-full"></div>
              <div class="template-detail-skeleton-line text w-88"></div>
            </div>
          </div>
        </article>

        <article class="template-detail-skeleton-card side">
          <div class="template-detail-skeleton-side-section">
            <div class="template-detail-skeleton-line subtitle w-28"></div>
            <div v-for="item in 4" :key="`domain-asset-${item}`" class="template-detail-skeleton-query-box">
              <div class="template-detail-skeleton-line label w-24"></div>
              <div class="template-detail-skeleton-line text w-full"></div>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="detail" class="template-detail-layout">
        <div class="template-detail-main-column">
          <article class="template-detail-card">
            <div class="template-detail-section-title with-icon">
              <span class="template-detail-title-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                </svg>
              </span>
              <span>资产概览</span>
            </div>

            <div class="template-detail-info-grid vulnerability-detail-info-grid">
              <div v-for="item in overviewItems" :key="item.label" class="template-detail-info-box">
                <span class="template-detail-info-label">{{ item.label }}</span>
                <span
                  v-if="item.statusTone"
                  class="template-detail-info-pill"
                  :class="getAlivePillClass(item.statusTone)"
                >
                  {{ item.value }}
                </span>
                <span
                  v-else-if="item.riskTone"
                  class="domain-assets-risk-pill template-detail-info-pill"
                  :class="`is-${item.riskTone}`"
                >
                  {{ item.value }}
                </span>
                <strong v-else :class="{ monospace: item.monospace }">{{ item.value }}</strong>
              </div>
            </div>

            <div class="domain-asset-detail-flags" aria-label="页面能力标记">
              <span
                v-for="item in flagItems"
                :key="item.key"
                class="domain-asset-detail-flag"
                :class="{ enabled: item.value === '是' }"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </span>
            </div>
          </article>

          <DomainAssetScreenshots :domain="detail.domain !== '--' ? detail.domain : domain" />

          <article class="template-detail-card">
            <div class="template-detail-section-title with-icon">
              <span class="template-detail-title-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M7 4.5h7l3 3v12H7z" />
                  <path d="M14 4.5v3h3" />
                  <path d="M10 12h4M10 16h4" />
                </svg>
              </span>
              <span>请求与响应</span>
            </div>

            <div class="vulnerability-detail-evidence-stack">
              <section
                v-for="section in evidenceSections"
                :key="section.key"
                class="template-detail-code-shell vulnerability-detail-evidence"
              >
                <div class="template-detail-code-topbar">
                  <span>{{ section.filename }}</span>
                  <button
                    class="template-detail-secondary-button compact effect-button"
                    :class="{ 'is-copied': copiedState === section.key }"
                    type="button"
                    @click="copyEvidence(section)"
                  >
                    <span
                      v-if="copiedState === section.key"
                      :key="copyEffectTick"
                      class="template-detail-share-burst"
                      aria-hidden="true"
                    ></span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <rect x="8" y="8" width="10" height="10" rx="1.8" />
                      <path d="M6 14H5a1.8 1.8 0 0 1-1.8-1.8V6A1.8 1.8 0 0 1 5 4.2h6.2A1.8 1.8 0 0 1 13 6v1" />
                    </svg>
                    <span>{{ copiedState === section.key ? section.copiedLabel : section.copyLabel }}</span>
                  </button>
                </div>
                <pre class="template-detail-code-block vulnerability-detail-code-block"><code>{{ section.value }}</code></pre>
              </section>
            </div>
          </article>
        </div>

        <div class="template-detail-side-column">
          <article class="template-detail-card">
            <div class="template-detail-section-title">存活时间线</div>
            <div class="vulnerability-detail-side-list">
              <div v-for="item in timelineItems" :key="item.label" class="template-detail-query-box">
                <span class="template-detail-info-label">{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </article>

          <article class="template-detail-card">
            <div class="domain-asset-detail-note-head">
              <div class="template-detail-section-title">人工备注</div>
              <button class="template-detail-secondary-button compact" type="button" @click="openManualNoteDialog">
                修改备注
              </button>
            </div>
            <p class="domain-asset-detail-note">{{ detail.manualNote }}</p>
          </article>

          <article class="template-detail-card">
            <div class="template-detail-section-title">服务资产 {{ detail.serviceAssetCountDisplay }}</div>
            <div v-if="detail.serviceAssets.length" class="domain-asset-detail-list">
              <section
                v-for="service in detail.serviceAssets"
                :key="service.key"
                class="template-detail-query-box domain-asset-detail-list-item"
              >
                <div class="domain-asset-detail-list-head">
                  <strong>{{ service.displayName }}</strong>
                  <span class="domain-asset-detail-alive-pill" :class="getAlivePillClass(service.isAliveMeta.tone)">
                    {{ service.isAliveMeta.label }}
                  </span>
                </div>
                <span>首次发现：{{ service.firstFoundAtDisplay }}</span>
                <span>最近发现：{{ service.lastFoundAtDisplay }}</span>
              </section>
            </div>
            <div v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无服务资产</div>
          </article>

          <article class="template-detail-card">
            <div class="template-detail-section-title">标题历史 {{ detail.titleHistoryCountDisplay }}</div>
            <div v-if="detail.titleHistories.length" class="domain-asset-detail-list">
              <section
                v-for="history in detail.titleHistories"
                :key="history.key"
                class="template-detail-query-box domain-asset-detail-list-item"
              >
                <div class="domain-asset-detail-list-head">
                  <strong>{{ history.historyTitle }}</strong>
                  <span class="domain-asset-detail-alive-pill" :class="getAlivePillClass(history.isAliveMeta.tone)">
                    {{ history.isAliveMeta.label }}
                  </span>
                </div>
                <span>首次记录：{{ history.firstTitleCreatedAtDisplay }}</span>
                <span>最近存活：{{ history.latestTitleAliveAtDisplay }}</span>
              </section>
            </div>
            <div v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无标题历史</div>
          </article>
        </div>
      </div>

      <div v-else class="template-detail-empty-state">
        <div class="template-detail-empty-illustration">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="24" cy="24" r="18" />
            <path d="M12 24h24" />
            <path d="M24 6a28 28 0 0 1 0 36" />
            <path d="M24 6a28 28 0 0 0 0 36" />
          </svg>
        </div>
        <h2>未能加载域名资产详情</h2>
        <p>{{ detailError || '当前没有可展示的域名资产信息。' }}</p>
        <button class="template-detail-secondary-button" type="button" @click="refreshDetail">重新加载</button>
      </div>

      <div v-if="isManualNoteDialogOpen" class="domain-assets-dialog-overlay" role="presentation" @click.self="closeManualNoteDialog">
        <section
          class="domain-assets-dialog domain-asset-detail-note-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="domain-manual-note-dialog-title"
        >
          <form @submit.prevent="saveManualNote">
            <header class="domain-assets-dialog-head">
              <h2 id="domain-manual-note-dialog-title">修改人工备注</h2>
              <button class="domain-assets-dialog-close" type="button" aria-label="关闭" :disabled="manualNoteSaving" @click="closeManualNoteDialog">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M6 6l12 12" />
                  <path d="M18 6 6 18" />
                </svg>
              </button>
            </header>

            <div class="domain-assets-dialog-body domain-asset-detail-note-dialog-body">
              <label class="domain-assets-dialog-field domain-asset-detail-note-field">
                <span>备注内容</span>
                <textarea
                  v-model="manualNoteDraft"
                  :maxlength="MANUAL_NOTE_MAX_LENGTH"
                  rows="7"
                  placeholder="输入人工备注，留空可清除备注"
                ></textarea>
                <small :class="{ muted: manualNoteLength <= MANUAL_NOTE_MAX_LENGTH }">
                  {{ manualNoteLength }} / {{ MANUAL_NOTE_MAX_LENGTH }}
                </small>
              </label>
              <div v-if="manualNoteError" class="domain-asset-detail-note-error" role="alert">
                {{ manualNoteError }}
              </div>
            </div>

            <footer class="domain-assets-dialog-actions">
              <button class="domain-assets-dialog-button is-secondary" type="button" :disabled="manualNoteSaving" @click="closeManualNoteDialog">
                取消
              </button>
              <button class="domain-assets-dialog-button" type="submit" :disabled="!canSaveManualNote">
                {{ manualNoteSaving ? '保存中' : '确认保存' }}
              </button>
            </footer>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>
