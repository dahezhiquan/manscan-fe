import {
  DOMAIN_ASSET_RISK_META,
  DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER
} from '../constants/domainAssets'
import { formatCount, firstDefined, formatDateTime, severityLabel } from './scanTask'

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
  const region = formatText(firstDefined(record?.region, record?.network_region, record?.networkRegion, record?.area))
  const riskLevel = normalizeRiskLevel(firstDefined(record?.risk_level, record?.riskLevel, record?.severity))
  const riskMeta = DOMAIN_ASSET_RISK_META[riskLevel] ?? DOMAIN_ASSET_RISK_META.unknown
  const rawVulnerabilityCount = firstDefined(
    record?.vulnerability_count,
    record?.vulnerabilityCount,
    record?.vuln_count,
    record?.vulnCount
  )
  const vulnerabilitySeverity = normalizeVulnerabilitySeverity(record, riskLevel, rawVulnerabilityCount)
  const severityTotal = Object.values(vulnerabilitySeverity).reduce((total, count) => total + count, 0)
  const vulnerabilityCount = normalizeNonNegativeInteger(rawVulnerabilityCount, severityTotal)
  const vulnerabilitySeverityItems = DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER.map((key) => {
    const count = vulnerabilitySeverity[key] ?? 0

    return {
      key,
      label: severityLabel(key),
      count,
      countDisplay: formatCount(count)
    }
  })
  const componentCount = normalizeNonNegativeInteger(firstDefined(record?.component_count, record?.componentCount), 0)
  const components = normalizeComponents(record?.components)

  return {
    id,
    assetAddress,
    title,
    region,
    riskLevel,
    riskMeta,
    vulnerabilityCount,
    vulnerabilityCountDisplay: formatCount(vulnerabilityCount),
    vulnerabilitySeverity,
    vulnerabilitySeverityItems,
    vulnerabilityTooltip: vulnerabilitySeverityItems
      .map((item) => `${item.label}: ${item.countDisplay}`)
      .join('，'),
    componentCount,
    componentCountDisplay: formatCount(componentCount),
    components,
    memoKey: [
      id,
      assetAddress,
      title,
      region,
      riskLevel,
      vulnerabilityCount,
      DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER.map((key) => vulnerabilitySeverity[key]).join(','),
      componentCount,
      components.join('|')
    ].join('|')
  }
}

export function normalizeDomainAssetDetail(payload) {
  const rawDetail = payload?.domain_asset && typeof payload.domain_asset === 'object'
    ? payload.domain_asset
    : payload
  const serviceAssets = normalizeServiceAssets(
    firstDefined(rawDetail?.service_assets, rawDetail?.serviceAssets)
  )
  const titleHistories = normalizeTitleHistories(
    firstDefined(rawDetail?.title_histories, rawDetail?.titleHistories)
  )
  const domain = formatText(firstDefined(rawDetail?.domain, rawDetail?.asset_address, rawDetail?.assetAddress))
  const title = formatText(firstDefined(rawDetail?.title, rawDetail?.site_title, rawDetail?.siteTitle))
  const isAlive = normalizeBoolean(firstDefined(rawDetail?.is_alive, rawDetail?.isAlive))
  const screenshotPath = normalizeScreenshotPath(
    firstDefined(rawDetail?.screenshot_path, rawDetail?.screenshotPath)
  )

  return {
    domain,
    owner: formatText(rawDetail?.owner),
    title,
    firstAliveAtDisplay: formatDateTime(firstDefined(rawDetail?.first_alive_at, rawDetail?.firstAliveAt)),
    lastAliveAtDisplay: formatDateTime(firstDefined(rawDetail?.last_alive_at, rawDetail?.lastAliveAt)),
    region: formatText(firstDefined(rawDetail?.region, rawDetail?.network_region, rawDetail?.networkRegion, rawDetail?.area)),
    hasForm: normalizeBoolean(firstDefined(rawDetail?.has_form, rawDetail?.hasForm)),
    hasUpload: normalizeBoolean(firstDefined(rawDetail?.has_upload, rawDetail?.hasUpload)),
    hasAdmin: normalizeBoolean(firstDefined(rawDetail?.has_admin, rawDetail?.hasAdmin)),
    hasUcLogin: normalizeBoolean(firstDefined(rawDetail?.has_uc_login, rawDetail?.hasUcLogin)),
    hasBaiduLogin: normalizeBoolean(firstDefined(rawDetail?.has_baidu_login, rawDetail?.hasBaiduLogin)),
    screenshotPath,
    manualNote: formatText(firstDefined(rawDetail?.manual_note, rawDetail?.manualNote), '暂无备注'),
    httpStatusCode: formatText(firstDefined(rawDetail?.http_status_code, rawDetail?.httpStatusCode)),
    request: formatCodeText(rawDetail?.request),
    response: formatCodeText(rawDetail?.response),
    isAlive,
    isAliveMeta: getAliveMeta(isAlive),
    serviceAssets,
    titleHistories,
    serviceAssetCountDisplay: formatCount(serviceAssets.length),
    titleHistoryCountDisplay: formatCount(titleHistories.length)
  }
}

function normalizeServiceAssets(value) {
  const items = Array.isArray(value) ? value : []

  return items.map((item, index) => {
    const appName = formatText(firstDefined(item?.app_name, item?.appName), '未知组件')
    const appVersion = formatText(firstDefined(item?.app_version, item?.appVersion), '')
    const isAlive = normalizeBoolean(firstDefined(item?.is_alive, item?.isAlive))

    return {
      key: [
        appName,
        appVersion,
        firstDefined(item?.first_found_at, item?.firstFoundAt),
        index
      ].join('|'),
      appName,
      appVersion,
      displayName: appVersion ? `${appName} ${appVersion}` : appName,
      firstFoundAtDisplay: formatDateTime(firstDefined(item?.first_found_at, item?.firstFoundAt)),
      lastFoundAtDisplay: formatDateTime(firstDefined(item?.last_found_at, item?.lastFoundAt)),
      isAlive,
      isAliveMeta: getAliveMeta(isAlive)
    }
  })
}

function normalizeTitleHistories(value) {
  const items = Array.isArray(value) ? value : []

  return items.map((item, index) => {
    const historyTitle = formatText(firstDefined(item?.history_title, item?.historyTitle, item?.title), '无标题')
    const isAlive = normalizeBoolean(firstDefined(item?.is_alive, item?.isAlive))

    return {
      key: [
        historyTitle,
        firstDefined(item?.first_title_created_at, item?.firstTitleCreatedAt),
        index
      ].join('|'),
      historyTitle,
      firstTitleCreatedAtDisplay: formatDateTime(
        firstDefined(item?.first_title_created_at, item?.firstTitleCreatedAt)
      ),
      latestTitleAliveAtDisplay: formatDateTime(
        firstDefined(item?.latest_title_alive_at, item?.latestTitleAliveAt)
      ),
      isAlive,
      isAliveMeta: getAliveMeta(isAlive)
    }
  })
}

function getAliveMeta(value) {
  if (value === true) {
    return { label: '存活', tone: 'alive' }
  }

  if (value === false) {
    return { label: '不存活', tone: 'inactive' }
  }

  return { label: '未知', tone: 'unknown' }
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value
  }

  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y', '是', '有'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'n', '否', '无'].includes(normalized)) {
    return false
  }

  return null
}

function normalizeScreenshotPath(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return ''
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized
  }

  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    return normalized
  }

  return ''
}

function formatBooleanLabel(value) {
  if (value === true) {
    return '是'
  }

  if (value === false) {
    return '否'
  }

  return '--'
}

export function buildDomainAssetFlagItems(detail) {
  return [
    { key: 'hasForm', label: '表单', value: formatBooleanLabel(detail?.hasForm) },
    { key: 'hasUpload', label: '上传', value: formatBooleanLabel(detail?.hasUpload) },
    { key: 'hasAdmin', label: '后台', value: formatBooleanLabel(detail?.hasAdmin) },
    { key: 'hasUcLogin', label: 'UC登录', value: formatBooleanLabel(detail?.hasUcLogin) },
    { key: 'hasBaiduLogin', label: '百度登录', value: formatBooleanLabel(detail?.hasBaiduLogin) }
  ]
}

function formatCodeText(value) {
  if (value === null || value === undefined || value === '') {
    return '未提供'
  }

  return String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, (character) => {
    const code = character.charCodeAt(0).toString(16).padStart(2, '0')
    return `\\x${code}`
  })
}

function normalizeVulnerabilitySeverity(record, riskLevel, vulnerabilityCount) {
  const source = firstDefined(
    record?.vulnerability_counts,
    record?.vulnerabilityCounts,
    record?.vulnerability_severity_counts,
    record?.vulnerabilitySeverityCounts,
    record?.vulnerability_level_counts,
    record?.vulnerabilityLevelCounts,
    record?.severity_counts,
    record?.severityCounts,
    record?.risk_counts,
    record?.riskCounts,
    record?.vuln_counts,
    record?.vulnCounts
  )
  const result = DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER.reduce((nextResult, key) => {
    nextResult[key] = normalizeSeverityCount(record, source, key)
    return nextResult
  }, {})

  const severityTotal = Object.values(result).reduce((total, count) => total + count, 0)

  if (severityTotal === 0 && vulnerabilityCount > 0 && DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER.includes(riskLevel)) {
    result[riskLevel] = vulnerabilityCount
  }

  return result
}

function normalizeSeverityCount(record, source, key) {
  const pascalKey = `${key.charAt(0).toUpperCase()}${key.slice(1)}`

  return normalizeNonNegativeInteger(
    firstDefined(
      source?.[key],
      source?.[`${key}_count`],
      source?.[`${key}Count`],
      source?.[`vulnerability_${key}_count`],
      source?.[`${key}_vulnerability_count`],
      source?.[`vulnerability${pascalKey}Count`],
      source?.[`${key}VulnerabilityCount`],
      record?.[`${key}_count`],
      record?.[`${key}Count`],
      record?.[`vulnerability_${key}_count`],
      record?.[`${key}_vulnerability_count`],
      record?.[`vulnerability${pascalKey}Count`],
      record?.[`${key}VulnerabilityCount`]
    ),
    0
  )
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
