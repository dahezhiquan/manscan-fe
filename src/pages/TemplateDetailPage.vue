<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getTemplateDetail } from '../api/templates'
import manscanIcon from '../assets/manscan-icon.png'
import { templateDetailMock } from '../data/templates'
import { mapSeverityTone } from '../utils/template'

const props = defineProps({
  navigateTo: {
    type: Function,
    required: true
  },
  currentPath: {
    type: [String, Object],
    default: '/templates/all'
  }
})

const isTemplateExpanded = ref(true)
const copiedState = ref('')
const detailLoading = ref(true)
const detailError = ref('')
const detailData = ref(null)
const shareEffectTick = ref(0)
const templateEffectTick = ref(0)

let detailAbortController = null
let copyFeedbackTimer = null

const templateId = computed(() => {
  const currentPathValue =
    typeof props.currentPath === 'string'
      ? props.currentPath
      : props.currentPath?.value || window.location.pathname

  return currentPathValue.split('/').filter(Boolean).pop() || templateDetailMock.id
})

const detail = computed(() =>
  detailData.value ? normalizeDetail(detailData.value, templateId.value) : null
)
const metricItems = computed(() => {
  const items = [
    { label: '模板 ID', value: detail.value.id, monospace: true },
    { label: '风险等级', value: detail.value.severity, tone: detail.value.severityTone },
    { label: 'CVSS 评分', value: detail.value.cvssScoreDisplay },
    { label: '协议', value: detail.value.protocolsLabel },
    { label: '厂商', value: detail.value.vendor },
    { label: '产品', value: detail.value.product }
  ]

  return items
})

const intelligenceItems = computed(() => [
  { label: 'Shodan 查询', values: detail.value.shodanQueries },
  { label: 'FOFA 查询', values: detail.value.fofaQueries }
])

const detailSections = computed(() => [
  {
    title: '漏洞说明',
    html: renderMarkdown(detail.value.description),
    aiGenerated: detail.value.descriptionAiGenerated
  },
  {
    title: '影响范围',
    html: renderMarkdown(detail.value.impact),
    aiGenerated: detail.value.impactAiGenerated
  }
])

const remediationHtml = computed(() => renderMarkdown(detail.value.remediation))
const highlightedTemplateHtml = computed(() => renderTemplateCode(detail.value.nucleiTemplateContent))

function normalizeDetail(rawDetail, fallbackId) {
  const severity = rawDetail?.severity?.trim() || '未定义'
  const cvssScore = normalizeCvssScore(rawDetail?.['cvss-score'] ?? rawDetail?.cvssScore)
  const references = Array.isArray(rawDetail?.reference)
    ? rawDetail.reference
    : Array.isArray(rawDetail?.references)
      ? rawDetail.references
      : []

  return {
    id: rawDetail?.id || fallbackId,
    name: rawDetail?.name || templateDetailMock.name,
    description: rawDetail?.description?.trim() || '暂无漏洞说明。',
    descriptionAiGenerated: hasBackendContent(rawDetail?.description),
    impact: rawDetail?.impact?.trim() || '暂无影响说明。',
    impactAiGenerated: hasBackendContent(rawDetail?.impact),
    remediation: rawDetail?.remediation?.trim() || '暂无修复建议。',
    remediationAiGenerated: hasBackendContent(rawDetail?.remediation),
    severity,
    severityTone: mapSeverityTone(severity),
    cvssScore: cvssScore.value,
    cvssScoreDisplay: cvssScore.display,
    cvssTone: cvssScore.tone,
    cvssRingStyle: buildCvssRingStyle(cvssScore.value, cvssScore.tone, cvssScore.isUnavailable),
    isCvssUnavailable: cvssScore.isUnavailable,
    protocols: normalizeArray(rawDetail?.protocols),
    protocolsLabel: formatValue(normalizeArray(rawDetail?.protocols).map(formatProtocolLabel).join(' / ')),
    tags: normalizeArray(rawDetail?.tags),
    vendor: formatValue(rawDetail?.vendor),
    product: formatValue(rawDetail?.product),
    shodanQueries: normalizeQueryList(rawDetail?.['shodan-query'] ?? rawDetail?.shodanQuery),
    fofaQueries: normalizeQueryList(rawDetail?.['fofa-query'] ?? rawDetail?.fofaQuery),
    references: references
      .filter(Boolean)
      .map((item) => ({
        label: formatReferenceLabel(item),
        url: item
      })),
    nucleiTemplateName: `${rawDetail?.id || fallbackId}.yaml`,
    nucleiTemplateContent: rawDetail?.content || templateDetailMock.nucleiTemplateContent
  }
}

function hasBackendContent(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : false
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeTextList(value) {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => (typeof item === 'number' ? item.toString() : typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)

    return normalized.length ? normalized : ['未提供']
  }

  return [formatValue(value)]
}

function normalizeQueryList(value) {
  if (Array.isArray(value)) {
    return normalizeTextList(value)
  }

  if (typeof value === 'string') {
    const normalized = value.trim()

    if (!normalized) {
      return ['未提供']
    }

    try {
      const parsed = JSON.parse(normalized)
      if (Array.isArray(parsed)) {
        return normalizeTextList(parsed)
      }
    } catch {
      // ignore JSON parse errors and continue with plain-text normalization
    }

    const splitValues = normalized
      .split(/\r?\n+|[；;]+/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (splitValues.length > 1) {
      return splitValues
    }
  }

  return normalizeTextList(value)
}

function normalizeCvssScore(value) {
  const parsedValue = parseNumericValue(value)

  if (parsedValue === null) {
    return {
      value: null,
      display: '未提供',
      tone: 'none',
      isUnavailable: true
    }
  }

  const normalizedValue = Math.min(Math.max(parsedValue, 0), 10)

  return {
    value: normalizedValue,
    display: normalizedValue === 0 ? '未提供' : normalizedValue.toFixed(1),
    tone: mapCvssTone(normalizedValue),
    isUnavailable: normalizedValue === 0
  }
}

function parseNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toString()
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return '未提供'
}

function formatReferenceLabel(url) {
  try {
    const target = new URL(url)
    return target.hostname.replace(/^www\./, '')
  } catch {
    return '参考链接'
  }
}

function formatProtocolLabel(protocol) {
  return protocol.toUpperCase()
}

function mapCvssTone(score) {
  if (score === 0) {
    return 'none'
  }

  if (score <= 3.9) {
    return 'low'
  }

  if (score <= 6.9) {
    return 'medium'
  }

  if (score <= 8.9) {
    return 'high'
  }

  return 'critical'
}

function cvssToneColor(tone) {
  switch (tone) {
    case 'none':
      return '#16a34a'
    case 'low':
      return '#2563eb'
    case 'medium':
      return '#eab308'
    case 'high':
      return '#ef4444'
    case 'critical':
      return '#991b1b'
    default:
      return '#6b7280'
  }
}

function buildCvssRingStyle(score, tone, isUnavailable) {
  const progress = typeof score === 'number' && score > 0 ? `${(score / 10) * 360}deg` : '0deg'

  return {
    '--cvss-progress': progress,
    '--cvss-color': cvssToneColor(tone),
    '--cvss-score-color': isUnavailable ? '#6e7482' : cvssToneColor(tone)
  }
}

function severityClass(tone) {
  return `template-severity-${tone}`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInlineMarkdown(text) {
  let html = escapeHtml(text)

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  )

  return html
}

function renderMarkdown(content) {
  const normalized = (content || '').trim().replace(/\r\n/g, '\n')

  if (!normalized) {
    return '<p>未提供</p>'
  }

  const blocks = normalized.split(/\n{2,}/)

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter(Boolean)

      if (!lines.length) {
        return ''
      }

      if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*+]\s+/, ''))}</li>`)
          .join('')}</ul>`
      }

      if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
        return `<ol>${lines
          .map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
          .join('')}</ol>`
      }

      if (lines.every((line) => /^\s*>\s?/.test(line))) {
        return `<blockquote>${lines
          .map((line) => renderInlineMarkdown(line.replace(/^\s*>\s?/, '')))
          .join('<br />')}</blockquote>`
      }

      if (/^```/.test(lines[0]) && /^```$/.test(lines[lines.length - 1])) {
        const codeContent = lines.slice(1, -1).join('\n')
        return `<pre><code>${escapeHtml(codeContent)}</code></pre>`
      }

      const heading = lines.length === 1 ? lines[0].match(/^(#{1,6})\s+(.+)$/) : null
      if (heading) {
        const level = heading[1].length
        return `<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`
      }

      return `<p>${lines.map((line) => renderInlineMarkdown(line)).join('<br />')}</p>`
    })
    .join('')
}

function highlightYamlValue(rawValue) {
  const leadingWhitespace = rawValue.match(/^\s*/)?.[0] || ''
  const content = rawValue.slice(leadingWhitespace.length)

  if (!content) {
    return escapeHtml(rawValue)
  }

  const placeholders = []
  let html = escapeHtml(content).replace(/(&quot;.*?&quot;|&#39;.*?&#39;)/g, (match) => {
    const key = `__STRING_${placeholders.length}__`
    placeholders.push(`<span class="token-string">${match}</span>`)
    return key
  })

  html = html.replace(/\b(true|false|null)\b/g, '<span class="token-boolean">$1</span>')
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')
  html = html.replace(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g, '<span class="token-keyword">$1</span>')

  placeholders.forEach((value, index) => {
    html = html.replace(`__STRING_${index}__`, value)
  })

  return `${escapeHtml(leadingWhitespace)}${html}`
}

function renderTemplateCode(content) {
  return (content || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const lineIndent = line.match(/^\s*/)?.[0] || ''
      const trimmedLine = line.slice(lineIndent.length)

      if (!trimmedLine) {
        return ''
      }

      if (trimmedLine.startsWith('#')) {
        return `${escapeHtml(lineIndent)}<span class="token-comment">${escapeHtml(trimmedLine)}</span>`
      }

      let prefix = ''
      let statement = trimmedLine

      if (statement.startsWith('- ')) {
        prefix = '<span class="token-punctuation">- </span>'
        statement = statement.slice(2)
      }

      const colonIndex = statement.indexOf(':')

      if (colonIndex >= 0) {
        const key = statement.slice(0, colonIndex).trim()
        const value = statement.slice(colonIndex + 1)
        return `${escapeHtml(lineIndent)}${prefix}<span class="token-key">${escapeHtml(
          key
        )}</span><span class="token-punctuation">:</span>${highlightYamlValue(value)}`
      }

      return `${escapeHtml(lineIndent)}${prefix}${highlightYamlValue(statement)}`
    })
    .join('\n')
}

async function fetchTemplateDetail() {
  detailAbortController?.abort()
  detailAbortController = new AbortController()
  detailLoading.value = true
  detailError.value = ''

  try {
    detailData.value = await getTemplateDetail(templateId.value, detailAbortController.signal)
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('获取模板详情失败:', error)
      detailError.value = '模板详情加载失败，请稍后重试。'
      detailData.value = null
    }
  } finally {
    detailLoading.value = false
  }
}

async function copyTemplateContent() {
  try {
    templateEffectTick.value += 1
    await navigator.clipboard.writeText(detail.value.nucleiTemplateContent)
    triggerCopiedFeedback('template')
  } catch (error) {
    console.error('复制模板内容失败:', error)
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

function openReference(url) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function shareTemplate() {
  const targetUrl = window.location.href

  try {
    shareEffectTick.value += 1
    await copyTextToClipboard(targetUrl)
    triggerCopiedFeedback('share')
  } catch (error) {
    console.error('复制分享链接失败:', error)
  }
}

onMounted(() => {
  fetchTemplateDetail()
})

onBeforeUnmount(() => {
  detailAbortController?.abort()
  window.clearTimeout(copyFeedbackTimer)
})
</script>

<template>
  <main class="template-detail-page">
    <section class="template-detail-content">
      <div class="template-detail-crumbs">
        <button class="template-detail-crumb-button" @click="props.navigateTo('/templates/all')">
          <img class="template-detail-crumb-logo" :src="manscanIcon" alt="ManScan" />
          <span class="template-detail-crumb-separator">/</span>
          <span class="template-detail-crumb-library-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6.5 5.5h9a2 2 0 0 1 2 2v10.5a1 1 0 0 1-1.53.85L12 16.4l-3.97 2.45A1 1 0 0 1 6.5 18z" />
              <path d="M9 9.5h6" />
              <path d="M9 12.5h4.5" />
            </svg>
          </span>
          <span>漏洞模板库</span>
        </button>
      </div>

      <div v-if="detailError" class="template-detail-alert">
        <span>{{ detailError }}</span>
      </div>

      <div class="template-detail-hero">
        <div class="template-detail-hero-main">
          <h1>{{ detail?.name || '漏洞模板详情' }}</h1>
        </div>

        <div class="template-detail-actions">
          <button
            class="template-detail-secondary-button effect-button share-button"
            :class="{ 'is-copied': copiedState === 'share' }"
            @click="shareTemplate"
          >
            <span
              v-if="copiedState === 'share'"
              :key="shareEffectTick"
              class="template-detail-share-burst"
              aria-hidden="true"
            ></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="18" cy="5.5" r="2.2" />
              <circle cx="6" cy="12" r="2.2" />
              <circle cx="18" cy="18.5" r="2.2" />
              <path d="M8 11 16 6.5" />
              <path d="M8 13l8 4.5" />
            </svg>
            <span>{{ copiedState === 'share' ? '已复制链接' : '分享' }}</span>
          </button>
          <button class="template-detail-primary-button">开始扫描</button>
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
          <div class="template-detail-skeleton-metrics">
            <div v-for="item in 6" :key="`metric-${item}`" class="template-detail-skeleton-metric">
              <div class="template-detail-skeleton-line label w-20"></div>
              <div class="template-detail-skeleton-line value w-64"></div>
            </div>
          </div>
        </article>

        <article class="template-detail-skeleton-card side">
          <div class="template-detail-skeleton-ring"></div>
          <div class="template-detail-skeleton-side-section">
            <div class="template-detail-skeleton-line subtitle w-28"></div>
            <div class="template-detail-skeleton-tags">
              <span v-for="item in 4" :key="`tag-${item}`" class="template-detail-skeleton-chip"></span>
            </div>
          </div>
          <div class="template-detail-skeleton-side-section">
            <div class="template-detail-skeleton-line subtitle w-28"></div>
            <div class="template-detail-skeleton-query-box" v-for="item in 2" :key="`query-${item}`">
              <div class="template-detail-skeleton-line label w-24"></div>
              <div class="template-detail-skeleton-line text w-full"></div>
              <div class="template-detail-skeleton-line text w-72"></div>
            </div>
          </div>
        </article>

        <article class="template-detail-skeleton-card wide">
          <div class="template-detail-skeleton-line title w-32"></div>
          <div class="template-detail-skeleton-reference-list">
            <div v-for="item in 3" :key="`reference-${item}`" class="template-detail-skeleton-reference">
              <span class="template-detail-skeleton-icon"></span>
              <div class="template-detail-skeleton-line text w-full"></div>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="detail" class="template-detail-layout">
        <div class="template-detail-main-column">
          <article class="template-detail-card">
            <div class="template-detail-section-title with-icon">
              <span class="template-detail-title-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 10v5" />
                  <circle cx="12" cy="7.2" r=".8" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <span>漏洞概览</span>
            </div>

            <div class="template-detail-section-stack">
              <section v-for="section in detailSections" :key="section.title" class="template-detail-copy-block">
                <div class="template-detail-copy-block-head">
                  <h3>{{ section.title }}</h3>
                  <span v-if="section.aiGenerated" class="template-detail-ai-badge">
                    <span class="template-detail-ai-badge-dot"></span>
                    <span>AI 生成</span>
                  </span>
                </div>
                <div class="template-detail-markdown" v-html="section.html"></div>
              </section>
            </div>

            <div class="template-detail-info-grid">
              <div v-for="item in metricItems" :key="item.label" class="template-detail-info-box">
                <span class="template-detail-info-label">{{ item.label }}</span>
                <span
                  v-if="item.tone"
                  class="templates-severity-pill template-detail-info-pill"
                  :class="severityClass(item.tone)"
                >
                  {{ item.value }}
                </span>
                <strong v-else :class="{ monospace: item.monospace }">{{ item.value }}</strong>
              </div>
            </div>
          </article>

          <article class="template-detail-card">
            <div class="template-detail-section-title with-icon">
              <span class="template-detail-title-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M6 6.5h12" />
                  <path d="M6 12h12" />
                  <path d="M6 17.5h7" />
                </svg>
              </span>
              <span>修复建议</span>
              <span v-if="detail.remediationAiGenerated" class="template-detail-ai-badge">
                <span class="template-detail-ai-badge-dot"></span>
                <span>AI 生成</span>
              </span>
            </div>

            <div class="template-detail-markdown" v-html="remediationHtml"></div>
          </article>

          <article class="template-detail-card">
            <button class="template-detail-collapse-head" @click="isTemplateExpanded = !isTemplateExpanded">
              <div class="template-detail-section-title with-icon">
                <span class="template-detail-title-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M7 4.5h7l3 3v12H7z" />
                    <path d="M14 4.5v3h3" />
                    <path d="M10 12h4M10 16h4" />
                  </svg>
                </span>
                <span>ManScan 模板内容</span>
              </div>

              <span class="template-detail-collapse-arrow" :class="{ open: isTemplateExpanded }">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </span>
            </button>

            <div v-if="isTemplateExpanded" class="template-detail-code-shell">
              <div class="template-detail-code-topbar">
                <span>{{ detail.nucleiTemplateName }}</span>
                <button
                  class="template-detail-secondary-button compact effect-button"
                  :class="{ 'is-copied': copiedState === 'template' }"
                  @click="copyTemplateContent"
                >
                  <span
                    v-if="copiedState === 'template'"
                    :key="templateEffectTick"
                    class="template-detail-share-burst"
                    aria-hidden="true"
                  ></span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="8" y="8" width="10" height="10" rx="1.8" />
                    <path d="M6 14H5a1.8 1.8 0 0 1-1.8-1.8V6A1.8 1.8 0 0 1 5 4.2h6.2A1.8 1.8 0 0 1 13 6v1" />
                  </svg>
                  <span>{{ copiedState === 'template' ? '已复制模板' : '复制模板' }}</span>
                </button>
              </div>

              <pre class="template-detail-code-block"><code class="language-yaml" v-html="highlightedTemplateHtml"></code></pre>
            </div>
          </article>
        </div>

        <div class="template-detail-side-column">
          <article class="template-detail-card score-card">
            <div class="template-score-ring" :style="detail.cvssRingStyle">
              <div class="template-score-ring-track"></div>
              <div class="template-score-ring-value">
                <strong :class="{ 'is-empty': detail.isCvssUnavailable }">{{ detail.cvssScoreDisplay }}</strong>
                <span>CVSS</span>
              </div>
            </div>

            <div class="template-detail-side-block">
              <h3>标签画像</h3>
              <div class="template-detail-tags-cloud">
                <span v-for="tag in detail.tags" :key="tag" class="template-detail-tag-badge">
                  {{ tag }}
                </span>
                <span v-if="!detail.tags.length" class="template-detail-empty-text">暂无标签信息</span>
              </div>
            </div>

            <div class="template-detail-side-block">
              <h3>查询情报</h3>
              <div v-for="item in intelligenceItems" :key="item.label" class="template-detail-query-box">
                <span class="template-detail-info-label">{{ item.label }}</span>
                <div class="template-detail-query-list">
                  <strong
                    v-for="value in item.values"
                    :key="`${item.label}-${value}`"
                    class="template-detail-query-value monospace"
                  >
                    {{ value }}
                  </strong>
                </div>
              </div>
            </div>
          </article>

          <article class="template-detail-card">
            <div class="template-detail-section-title">参考链接</div>
            <div class="template-detail-reference-list">
              <button
                v-for="reference in detail.references"
                :key="reference.url"
                class="template-detail-reference"
                @click="openReference(reference.url)"
              >
                <span class="template-detail-reference-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M14 5h5v5" />
                    <path d="M10 14 19 5" />
                    <path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
                  </svg>
                </span>
                <span class="template-detail-reference-text" :title="reference.url">{{ reference.url }}</span>
              </button>
              <div v-if="!detail.references.length" class="template-detail-empty-text">暂无参考链接</div>
            </div>
          </article>
        </div>
      </div>

      <div v-else class="template-detail-empty-state">
        <div class="template-detail-empty-illustration">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M24 8 8 14v10c0 10 6.9 19.3 16 22 9.1-2.7 16-12 16-22V14z" />
            <path d="M18 23.5 22 27l8-8" />
          </svg>
        </div>
        <h2>未能加载漏洞详情</h2>
        <p>{{ detailError || '当前没有可展示的模板信息。' }}</p>
      </div>
    </section>
  </main>
</template>
