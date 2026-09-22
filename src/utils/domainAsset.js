import { DOMAIN_ASSET_RISK_META } from '../constants/domainAssets'
import { formatCount, firstDefined } from './scanTask'

export function normalizeDomainAssetListResponse(payload, fallbackPage = 1, fallbackPageSize = 10) {
  const pageSize = normalizePositiveInteger(firstDefined(payload?.pageSize, payload?.page_size), fallbackPageSize)
  const total = normalizeNonNegativeInteger(payload?.total, 0)
  const totalPagesFallback = total > 0 ? Math.ceil(total / pageSize) : 1

  return {
    items: normalizeDomainAssetList(payload),
    total,
    page: normalizePositiveInteger(payload?.page, fallbackPage),
    pageSize,
    totalPages: normalizePositiveInteger(firstDefined(payload?.totalPages, payload?.total_pages), totalPagesFallback)
  }
}

export function normalizeDomainAssetList(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
  return items.map(normalizeDomainAsset)
}

export function normalizeDomainAsset(record) {
  const id = String(firstDefined(record?.id, record?.domain, record?.asset_address, '') ?? '').trim()
  const assetAddress = formatText(firstDefined(record?.asset_address, record?.assetAddress, record?.domain))
  const title = formatText(firstDefined(record?.title, record?.site_title, record?.siteTitle))
  const riskLevel = normalizeRiskLevel(firstDefined(record?.risk_level, record?.riskLevel, record?.severity))
  const riskMeta = DOMAIN_ASSET_RISK_META[riskLevel] ?? DOMAIN_ASSET_RISK_META.unknown
  const vulnerabilityCount = normalizeNonNegativeInteger(
    firstDefined(record?.vulnerability_count, record?.vulnerabilityCount, record?.vuln_count, record?.vulnCount),
    0
  )
  const componentCount = normalizeNonNegativeInteger(firstDefined(record?.component_count, record?.componentCount), 0)
  const components = normalizeComponents(record?.components)

  return {
    id,
    assetAddress,
    title,
    riskLevel,
    riskMeta,
    vulnerabilityCount,
    vulnerabilityCountDisplay: formatCount(vulnerabilityCount),
    componentCount,
    componentCountDisplay: formatCount(componentCount),
    components,
    componentPreview: components.slice(0, 3).join(' / '),
    memoKey: [id, assetAddress, title, riskLevel, vulnerabilityCount, componentCount, components.join('|')].join('|')
  }
}

function normalizeComponents(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }

  return String(value ?? '')
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeRiskLevel(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === '严重' || normalized === 'critical') {
    return 'critical'
  }

  if (normalized === '高危' || normalized === '高风险' || normalized === 'high') {
    return 'high'
  }

  if (normalized === '中危' || normalized === '中风险' || normalized === 'medium') {
    return 'medium'
  }

  if (normalized === '低危' || normalized === '低风险' || normalized === 'low') {
    return 'low'
  }

  if (normalized === '无风险' || normalized === 'info') {
    return 'info'
  }

  return 'unknown'
}

function formatText(value, fallback = '--') {
  if (value === null || value === undefined) {
    return fallback
  }

  const normalized = String(value).trim()
  return normalized || fallback
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback
}

function normalizeNonNegativeInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback
}
