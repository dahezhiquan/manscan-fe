<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getDomainAssetScreenshots,
  getLatestDomainAssetScreenshot
} from '../../api/domain-assets'
import { DOMAIN_ASSET_SCREENSHOT_HISTORY_PAGE_SIZE } from '../../constants/domainAssets'
import {
  buildDomainAssetScreenshotLookupCandidates,
  normalizeDomainAssetScreenshot,
  normalizeDomainAssetScreenshotPage
} from '../../utils/domainAsset'

const props = defineProps({
  domain: {
    type: String,
    required: true
  }
})

const latestStatus = ref('idle')
const latestError = ref('')
const latestScreenshot = ref(null)
const screenshotLookupDomain = ref('')
const historyExpanded = ref(false)
const historyStatus = ref('idle')
const historyError = ref('')
const historyPage = ref(1)
const historyTotal = ref(0)
const historyTotalPages = ref(1)
const historyItems = ref([])
const failedScreenshotKeys = ref(new Set())
const viewerScreenshot = ref(null)
const viewerCloseButton = ref(null)

let latestAbortController = null
let historyAbortController = null
let latestRequestId = 0
let historyRequestId = 0
let viewerTriggerElement = null

const normalizedDomain = computed(() => props.domain.trim())
const hasLatestScreenshot = computed(() =>
  Boolean(latestScreenshot.value) && !failedScreenshotKeys.value.has(latestScreenshot.value.key)
)
const historyPageLabel = computed(() => `${historyPage.value} / ${historyTotalPages.value}`)
const screenshotLookupCandidates = computed(() =>
  buildDomainAssetScreenshotLookupCandidates(normalizedDomain.value)
)

function isNotFoundError(error) {
  return error?.status === 404 || Number(error?.code) === 40401
}

function markScreenshotFailed(screenshot) {
  failedScreenshotKeys.value = new Set(failedScreenshotKeys.value).add(screenshot.key)
  if (viewerScreenshot.value?.key === screenshot.key) {
    closeViewer()
  }
}

function openViewer(screenshot, triggerElement) {
  if (!screenshot || failedScreenshotKeys.value.has(screenshot.key)) {
    return
  }

  viewerTriggerElement = triggerElement
  viewerScreenshot.value = screenshot
  void nextTick(() => viewerCloseButton.value?.focus())
}

function closeViewer(restoreFocus = true) {
  const triggerElement = viewerTriggerElement
  viewerScreenshot.value = null
  viewerTriggerElement = null

  if (restoreFocus && triggerElement?.isConnected) {
    void nextTick(() => triggerElement.focus())
  }
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && viewerScreenshot.value) {
    closeViewer()
  }
}

async function fetchLatestScreenshot() {
  latestAbortController?.abort()
  latestAbortController = new AbortController()
  const requestId = ++latestRequestId
  latestStatus.value = 'loading'
  latestError.value = ''
  latestScreenshot.value = null
  screenshotLookupDomain.value = ''

  if (!screenshotLookupCandidates.value.length) {
    latestStatus.value = 'success'
    latestAbortController = null
    return
  }

  try {
    let data = null
    let matchedDomain = ''

    for (const candidate of screenshotLookupCandidates.value) {
      try {
        data = await getLatestDomainAssetScreenshot(candidate, latestAbortController.signal)
        matchedDomain = candidate
        break
      } catch (error) {
        if (!isNotFoundError(error) || candidate === screenshotLookupCandidates.value.at(-1)) {
          throw error
        }
      }
    }

    if (requestId === latestRequestId) {
      latestScreenshot.value = normalizeDomainAssetScreenshot(data)
      screenshotLookupDomain.value = matchedDomain
      latestStatus.value = 'success'
    }
  } catch (error) {
    if (error?.name === 'AbortError' || requestId !== latestRequestId) {
      return
    }

    latestStatus.value = isNotFoundError(error) ? 'success' : 'error'
    latestError.value = isNotFoundError(error)
      ? ''
      : error instanceof Error ? error.message : '页面截图加载失败，请稍后重试。'
  } finally {
    if (requestId === latestRequestId) {
      latestAbortController = null
    }
  }
}

async function fetchHistory(page = historyPage.value) {
  historyAbortController?.abort()
  historyAbortController = new AbortController()
  const requestId = ++historyRequestId
  historyStatus.value = 'loading'
  historyError.value = ''

  try {
    const lookupDomain = screenshotLookupDomain.value || screenshotLookupCandidates.value[0]
    const data = await getDomainAssetScreenshots(
      lookupDomain,
      { page, pageSize: DOMAIN_ASSET_SCREENSHOT_HISTORY_PAGE_SIZE },
      historyAbortController.signal
    )
    if (requestId !== historyRequestId) {
      return
    }

    const normalized = normalizeDomainAssetScreenshotPage(
      data,
      page,
      DOMAIN_ASSET_SCREENSHOT_HISTORY_PAGE_SIZE
    )
    historyItems.value = normalized.items
    historyPage.value = normalized.page
    historyTotal.value = normalized.total
    historyTotalPages.value = normalized.totalPages
    historyStatus.value = 'success'
  } catch (error) {
    if (error?.name !== 'AbortError' && requestId === historyRequestId) {
      historyStatus.value = 'error'
      historyError.value = error instanceof Error
        ? error.message
        : '历史截图加载失败，请稍后重试。'
    }
  } finally {
    if (requestId === historyRequestId) {
      historyAbortController = null
    }
  }
}

function toggleHistory() {
  historyExpanded.value = !historyExpanded.value
  if (historyExpanded.value && historyStatus.value === 'idle') {
    void fetchHistory(1)
  }
}

function goToHistoryPage(page) {
  if (historyStatus.value === 'loading' || page < 1 || page > historyTotalPages.value) {
    return
  }

  void fetchHistory(page)
}

function resetScreenshots() {
  latestAbortController?.abort()
  historyAbortController?.abort()
  latestRequestId += 1
  historyRequestId += 1
  latestStatus.value = 'idle'
  latestError.value = ''
  latestScreenshot.value = null
  screenshotLookupDomain.value = ''
  historyExpanded.value = false
  historyStatus.value = 'idle'
  historyError.value = ''
  historyPage.value = 1
  historyTotal.value = 0
  historyTotalPages.value = 1
  historyItems.value = []
  failedScreenshotKeys.value = new Set()
  closeViewer(false)
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  void fetchLatestScreenshot()
})

watch(normalizedDomain, () => {
  resetScreenshots()
  void fetchLatestScreenshot()
})

onBeforeUnmount(() => {
  latestAbortController?.abort()
  historyAbortController?.abort()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <article class="template-detail-card domain-asset-screenshots-card">
    <div class="domain-asset-screenshots-head">
      <div class="template-detail-section-title with-icon">
        <span class="template-detail-title-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="4" y="5" width="16" height="12" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
        </span>
        <span>页面截图</span>
      </div>

      <button
        class="template-detail-secondary-button compact domain-asset-screenshots-history-toggle"
        type="button"
        :aria-expanded="historyExpanded"
        :disabled="latestStatus === 'loading'"
        @click="toggleHistory"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M4.5 12A7.5 7.5 0 1 0 7 6.5" />
          <path d="M4.5 5.5v4h4" />
          <path d="M12 8v4l2.8 1.8" />
        </svg>
        <span>{{ historyExpanded ? '收起历史' : '历史截图' }}</span>
      </button>
    </div>

    <div v-if="latestStatus === 'loading'" class="domain-asset-screenshot-loading" aria-label="页面截图加载中">
      <span></span>
    </div>

    <div v-else-if="latestStatus === 'error'" class="domain-asset-screenshot-error" role="alert">
      <span>{{ latestError }}</span>
      <button class="template-detail-secondary-button compact" type="button" @click="fetchLatestScreenshot">
        重试
      </button>
    </div>

    <template v-else-if="hasLatestScreenshot">
      <button
        class="domain-asset-detail-screenshot"
        type="button"
        :aria-label="`查看 ${latestScreenshot.capturedDateDisplay} 的页面截图`"
        @click="openViewer(latestScreenshot, $event.currentTarget)"
      >
        <img
          :src="latestScreenshot.imageUrl"
          :alt="`${domain} 在 ${latestScreenshot.capturedDateDisplay} 的页面截图`"
          loading="lazy"
          @error="markScreenshotFailed(latestScreenshot)"
        />
      </button>
      <div class="domain-asset-screenshot-meta">
        <span>最新采集：{{ latestScreenshot.capturedDateDisplay }}</span>
        <span :title="latestScreenshot.fileName">{{ latestScreenshot.fileName }}</span>
      </div>
    </template>

    <p v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无页面截图</p>

    <section v-if="historyExpanded" class="domain-asset-screenshot-history" aria-labelledby="domain-screenshot-history-title">
      <div class="domain-asset-screenshot-history-head">
        <h3 id="domain-screenshot-history-title">历史记录</h3>
        <span v-if="historyStatus === 'success'">共 {{ historyTotal }} 张</span>
      </div>

      <div v-if="historyStatus === 'loading'" class="domain-asset-screenshot-history-grid" aria-label="历史截图加载中">
        <div v-for="item in DOMAIN_ASSET_SCREENSHOT_HISTORY_PAGE_SIZE" :key="item" class="domain-asset-screenshot-history-skeleton"></div>
      </div>

      <div v-else-if="historyStatus === 'error'" class="domain-asset-screenshot-error" role="alert">
        <span>{{ historyError }}</span>
        <button class="template-detail-secondary-button compact" type="button" @click="fetchHistory(historyPage)">
          重试
        </button>
      </div>

      <div v-else-if="historyItems.length" class="domain-asset-screenshot-history-grid">
        <button
          v-for="screenshot in historyItems"
          :key="screenshot.key"
          class="domain-asset-screenshot-history-item"
          type="button"
          :disabled="failedScreenshotKeys.has(screenshot.key)"
          :aria-label="`查看 ${screenshot.capturedDateDisplay} 的页面截图`"
          @click="openViewer(screenshot, $event.currentTarget)"
        >
          <span class="domain-asset-screenshot-history-image">
            <img
              v-if="!failedScreenshotKeys.has(screenshot.key)"
              :src="screenshot.imageUrl"
              :alt="`${domain} 在 ${screenshot.capturedDateDisplay} 的页面截图`"
              loading="lazy"
              @error="markScreenshotFailed(screenshot)"
            />
            <span v-else>图片无法显示</span>
          </span>
          <span class="domain-asset-screenshot-history-caption">
            <strong>{{ screenshot.capturedDateDisplay }}</strong>
            <small :title="screenshot.fileName">{{ screenshot.fileName }}</small>
          </span>
        </button>
      </div>

      <p v-else class="template-detail-empty-text domain-asset-detail-empty-copy">暂无历史截图</p>

      <footer v-if="historyStatus === 'success' && historyTotalPages > 1" class="domain-asset-screenshot-pagination">
        <span>第 {{ historyPageLabel }} 页</span>
        <div>
          <button
            class="domain-assets-pagination-arrow"
            type="button"
            aria-label="上一页"
            :disabled="historyPage <= 1"
            @click="goToHistoryPage(historyPage - 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="m14.5 6-6 6 6 6" />
            </svg>
          </button>
          <button
            class="domain-assets-pagination-arrow"
            type="button"
            aria-label="下一页"
            :disabled="historyPage >= historyTotalPages"
            @click="goToHistoryPage(historyPage + 1)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="m9.5 6 6 6-6 6" />
            </svg>
          </button>
        </div>
      </footer>
    </section>

    <Teleport to="body">
      <div
        v-if="viewerScreenshot"
        class="domain-asset-screenshot-viewer"
        role="presentation"
        @click.self="closeViewer"
      >
        <section
          class="domain-asset-screenshot-viewer-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="domain-screenshot-viewer-title"
        >
          <header>
            <div>
              <h2 id="domain-screenshot-viewer-title">页面截图</h2>
              <p>{{ viewerScreenshot.capturedDateDisplay }} · {{ viewerScreenshot.fileName }}</p>
            </div>
            <button ref="viewerCloseButton" type="button" aria-label="关闭截图查看器" @click="closeViewer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div class="domain-asset-screenshot-viewer-stage">
            <img
              :src="viewerScreenshot.imageUrl"
              :alt="`${domain} 在 ${viewerScreenshot.capturedDateDisplay} 的页面截图`"
              @error="markScreenshotFailed(viewerScreenshot)"
            />
          </div>
        </section>
      </div>
    </Teleport>
  </article>
</template>
