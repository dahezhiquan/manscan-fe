<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getHostAssetDetail, updateHostAssetManualNote } from '../api/host-assets'
import manscanIcon from '../assets/manscan-icon.png'
import { normalizeHostAssetDetail } from '../utils/hostAsset'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: String,
    default: '/assets/hosts'
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

const ipAddress = computed(() => {
  const match = props.currentPath.match(/^\/assets\/hosts\/([^/]+)$/)
  return decodeURIComponent(match?.[1] ?? '')
})

const detail = computed(() => (detailData.value ? normalizeHostAssetDetail(detailData.value) : null))
const pageTitle = computed(() => {
  const target = detail.value?.ipAddress && detail.value.ipAddress !== '--' ? detail.value.ipAddress : ipAddress.value
  return target ? `主机资产详情 - ${target}` : 'ManScan - 主机资产详情'
})
const manualNoteLength = computed(() => manualNoteDraft.value.length)
const canSaveManualNote = computed(() =>
  !manualNoteSaving.value && manualNoteLength.value <= MANUAL_NOTE_MAX_LENGTH
)

const overviewItems = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    { label: 'IP 地址', value: detail.value.ipAddress, monospace: true },
    { label: '操作系统', value: detail.value.osDisplay },
    { label: '资产归属', value: detail.value.owner },
    { label: '区域', value: detail.value.region },
    { label: '风险等级', value: detail.value.riskMeta.label, riskTone: detail.value.riskMeta.tone },
    { label: '漏洞数量', value: detail.value.vulnerabilityCountDisplay },
    { label: '端口数量', value: detail.value.portCountDisplay },
    { label: '存活端口', value: detail.value.alivePortCountDisplay },
    {
      label: '存活状态',
      value: detail.value.isAliveMeta.label,
      statusTone: detail.value.isAliveMeta.tone
    }
  ]
})

const timelineItems = computed(() => {
  if (!detail.value) {
    return []
  }

  return [
    { label: '扫描创建时间', value: detail.value.scanCreatedAtDisplay },
    { label: '最近存活时间', value: detail.value.lastAliveAtDisplay }
  ]
})

function getAlivePillClass(tone) {
  return `domain-asset-detail-alive-pill is-${tone}`
}

function getPortRiskClass(tone) {
  return `host-asset-detail-port-risk is-${tone}`
}

function goBackToList() {
  props.navigateTo('/assets/hosts')
}

function refreshDetail() {
  void fetchHostAssetDetail()
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

async function fetchHostAssetDetail() {
  detailAbortController?.abort()
  detailAbortController = new AbortController()
  const requestId = ++currentRequestId
  detailLoading.value = true
  detailError.value = ''

  if (!ipAddress.value) {
    detailData.value = null
    detailError.value = '缺少主机资产 IP 参数，请从主机资产清单进入详情。'
    detailLoading.value = false
    return
  }

  try {
    const data = await getHostAssetDetail(ipAddress.value, detailAbortController.signal)
    if (requestId === currentRequestId) {
      detailData.value = data
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && requestId === currentRequestId) {
      detailError.value = error instanceof Error ? error.message : '主机资产详情加载失败，请稍后重试。'
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
  const targetIpAddress = detail.value?.ipAddress && detail.value.ipAddress !== '--' ? detail.value.ipAddress : ipAddress.value

  if (!canSaveManualNote.value || !targetIpAddress) {
    return
  }

  manualNoteAbortController?.abort()
  manualNoteAbortController = new AbortController()
  manualNoteSaving.value = true
  manualNoteError.value = ''

  try {
    const data = await updateHostAssetManualNote(
      targetIpAddress,
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
  const rawDetail = detailData.value?.host_asset && typeof detailData.value.host_asset === 'object'
    ? detailData.value.host_asset
    : detailData.value

  return String(rawDetail?.manual_note ?? rawDetail?.manualNote ?? '').trim()
}

function applyManualNote(manualNote) {
  if (!detailData.value) {
    return
  }

  const target = detailData.value.host_asset && typeof detailData.value.host_asset === 'object'
    ? detailData.value.host_asset
    : detailData.value

  target.manual_note = manualNote
  target.manualNote = manualNote
}

onMounted(() => {
  void fetchHostAssetDetail()
})

watch(
  () => ipAddress.value,
  () => {
    void fetchHostAssetDetail()
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
  <main class="template-detail-page host-asset-detail-page">
    <section class="template-detail-content">
      <div class="template-detail-crumbs">
        <button class="template-detail-crumb-button" type="button" @click="goBackToList">
          <img class="template-detail-crumb-logo" :src="manscanIcon" alt="ManScan" />
          <span class="template-detail-crumb-separator">/</span>
          <span class="template-detail-crumb-library-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="4" y="4" width="16" height="6" rx="1.6" />
              <rect x="4" y="14" width="16" height="6" rx="1.6" />
              <path d="M8 7h.01" />
              <path d="M8 17h.01" />
            </svg>
          </span>
          <span>主机资产清单</span>
        </button>
      </div>

      <div v-if="detailError" class="template-detail-alert">
        <span>{{ detailError }}</span>
      </div>

      <div class="template-detail-hero">
        <div class="template-detail-hero-main">
          <h1>{{ detail?.ipAddress || ipAddress || '主机资产详情' }}</h1>
          <p v-if="detail?.osDisplay && detail.osDisplay !== '--'" class="domain-asset-detail-subtitle">
            {{ detail.osDisplay }}
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
            <div v-for="item in 4" :key="`host-asset-${item}`" class="template-detail-skeleton-query-box">
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
          </article>

          <article class="template-detail-card">
            <div class="template-detail-section-title with-icon">
              <span class="template-detail-title-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M5 9h14" />
                  <path d="M8 5h8" />
                  <path d="M8 19h8" />
                  <path d="M6 9v6a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V9" />
                </svg>
              </span>
              <span>端口资产 {{ detail.portCountDisplay }}</span>
            </div>

            <div v-if="detail.ports.length" class="host-asset-detail-port-list">
              <section
                v-for="port in detail.ports"
                :key="port.key"
                class="template-detail-query-box host-asset-detail-port-item"
              >
                <div class="host-asset-detail-port-head">
                  <div>
                    <strong class="host-asset-detail-port-title">
                      {{ port.portProtocol }} / {{ port.portNumberDisplay }}
                    </strong>
                    <span>{{ port.serviceName }}</span>
                  </div>
                  <div class="host-asset-detail-port-badges">
                    <span class="domain-asset-detail-alive-pill" :class="getAlivePillClass(port.isAliveMeta.tone)">
                      {{ port.isAliveMeta.label }}
                    </span>
                    <span :class="getPortRiskClass(port.highRiskMeta.tone)">
                      {{ port.highRiskMeta.label }}
                    </span>
                  </div>
                </div>

                <div class="host-asset-detail-port-meta">
                  <span>应用：{{ port.appDisplay }}</span>
                  <span>首次记录：{{ port.portCreatedAtDisplay }}</span>
                  <span>最近存活：{{ port.lastAliveAtDisplay }}</span>
                </div>
              </section>
            </div>
            <div v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无端口资产</div>
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
            <div class="template-detail-section-title">关联域名</div>
            <div v-if="detail.relatedDomains.length" class="template-detail-tags-cloud vulnerability-detail-tags-cloud">
              <span v-for="domain in detail.relatedDomains" :key="domain" class="template-detail-tag-badge">
                {{ domain }}
              </span>
            </div>
            <div v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无关联域名</div>
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
        </div>
      </div>

      <div v-else class="template-detail-empty-state">
        <div class="template-detail-empty-illustration">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="12" y="10" width="24" height="10" rx="2" />
            <rect x="12" y="28" width="24" height="10" rx="2" />
            <path d="M18 15h.01" />
            <path d="M18 33h.01" />
          </svg>
        </div>
        <h2>未能加载主机资产详情</h2>
        <p>{{ detailError || '当前没有可展示的主机资产信息。' }}</p>
        <button class="template-detail-secondary-button" type="button" @click="refreshDetail">重新加载</button>
      </div>

      <div v-if="isManualNoteDialogOpen" class="domain-assets-dialog-overlay" role="presentation" @click.self="closeManualNoteDialog">
        <section
          class="domain-assets-dialog domain-asset-detail-note-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="host-manual-note-dialog-title"
        >
          <form @submit.prevent="saveManualNote">
            <header class="domain-assets-dialog-head">
              <h2 id="host-manual-note-dialog-title">修改人工备注</h2>
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
