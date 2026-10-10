import {
  DOMAIN_ASSET_RISK_META,
  DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER
} from '../constants/domainAssets'
import { formatCount, firstDefined, formatDateTime, severityLabel } from './scanTask'

export function normalizeHostAssetListResponse(payload, fallbackPage = 1, fallbackPageSize = 10) {
  const pageSize = normalizePositiveInteger(firstDefined(payload?.pageSize, payload?.page_size), fallbackPageSize)
  const total = normalizeNonNegativeInteger(payload?.total, 0)
  const totalPagesFallback = total > 0 ? Math.ceil(total / pageSize) : 1

  return {
    items: normalizeHostAssetList(payload),
    total,
    page: normalizePositiveInteger(payload?.page, fallbackPage),
    pageSize,
    totalPages: normalizePositiveInteger(firstDefined(payload?.totalPages, payload?.total_pages), totalPagesFallback)
  }
}

export function normalizeHostAssetList(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []
  return items.map(normalizeHostAsset)
}

export function normalizeHostAsset(record) {
  const ip = formatText(firstDefined(record?.ip_address, record?.ipAddress, record?.asset_address, record?.assetAddress, record?.ip))
  const id = String(firstDefined(record?.id, record?.ip_address, record?.ipAddress, record?.asset_address, record?.assetAddress, '') ?? '').trim()
  const osType = formatOsType(firstDefined(record?.os_type, record?.osType), firstDefined(record?.os_version, record?.osVersion))
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
  const portCount = normalizeNonNegativeInteger(firstDefined(record?.port_count, record?.portCount), 0)

  return {
    id,
    ip,
    osType,
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
    portCount,
    portCountDisplay: formatCount(portCount),
    memoKey: [
      id,
      ip,
      osType,
      region,
      riskLevel,
      vulnerabilityCount,
      DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER.map((key) => vulnerabilitySeverity[key]).join(','),
      portCount
    ].join('|')
  }
}

export function normalizeHostAssetDetail(payload) {
  const rawDetail = payload?.host_asset && typeof payload.host_asset === 'object'
    ? payload.host_asset
    : payload
  const ipAddress = formatText(
    firstDefined(rawDetail?.ip_address, rawDetail?.ipAddress, rawDetail?.asset_address, rawDetail?.assetAddress, rawDetail?.ip)
  )
  const osType = formatText(firstDefined(rawDetail?.os_type, rawDetail?.osType))
  const osVersion = formatText(firstDefined(rawDetail?.os_version, rawDetail?.osVersion), '')
  const isAlive = normalizeBoolean(firstDefined(rawDetail?.is_alive, rawDetail?.isAlive))
  const riskLevel = normalizeRiskLevel(firstDefined(rawDetail?.risk_level, rawDetail?.riskLevel, rawDetail?.severity))
  const riskMeta = DOMAIN_ASSET_RISK_META[riskLevel] ?? DOMAIN_ASSET_RISK_META.unknown
  const vulnerabilityCount = normalizeNonNegativeInteger(
    firstDefined(rawDetail?.vulnerability_count, rawDetail?.vulnerabilityCount, rawDetail?.vuln_count, rawDetail?.vulnCount),
    0
  )
  const ports = normalizeHostAssetPorts(firstDefined(rawDetail?.ports, rawDetail?.port_details, rawDetail?.portDetails))

  return {
    ipAddress,
    region: formatText(firstDefined(rawDetail?.region, rawDetail?.network_region, rawDetail?.networkRegion, rawDetail?.area)),
    owner: formatText(rawDetail?.owner),
    osType,
    osVersion,
    osDisplay: formatOsType(osType, osVersion),
    scanCreatedAtDisplay: formatDateTime(firstDefined(rawDetail?.scan_created_at, rawDetail?.scanCreatedAt)),
    lastAliveAtDisplay: formatDateTime(firstDefined(rawDetail?.last_alive_at, rawDetail?.lastAliveAt)),
    manualNote: formatText(firstDefined(rawDetail?.manual_note, rawDetail?.manualNote), '暂无备注'),
    isAlive,
    isAliveMeta: getAliveMeta(isAlive),
    relatedDomains: normalizeRelatedDomains(firstDefined(rawDetail?.related_domains, rawDetail?.relatedDomains)),
    riskLevel,
    riskMeta,
    vulnerabilityCount,
    vulnerabilityCountDisplay: formatCount(vulnerabilityCount),
    ports,
    portCountDisplay: formatCount(ports.length),
    alivePortCountDisplay: formatCount(ports.filter((port) => port.isAlive === true).length)
  }
}

function normalizeHostAssetPorts(value) {
  const items = Array.isArray(value) ? value : []

  return items.map((item, index) => {
    const portProtocol = formatText(firstDefined(item?.port_protocol, item?.portProtocol), '--').toUpperCase()
    const portNumber = normalizeNonNegativeInteger(firstDefined(item?.port_number, item?.portNumber), 0)
    const serviceName = formatText(firstDefined(item?.service_name, item?.serviceName))
    const appName = formatText(firstDefined(item?.app_name, item?.appName))
    const appVersion = formatText(firstDefined(item?.app_version, item?.appVersion), '')
    const isAlive = normalizeBoolean(firstDefined(item?.is_alive, item?.isAlive))
    const isHighRiskPort = normalizeBoolean(firstDefined(item?.is_high_risk_port, item?.isHighRiskPort))

    return {
      key: [portProtocol, portNumber, serviceName, appName, index].join('|'),
      portProtocol,
      portNumber,
      portNumberDisplay: portNumber > 0 ? String(portNumber) : '--',
      serviceName,
      appName,
      appVersion,
      appDisplay: appVersion && appName !== '--' ? `${appName} ${appVersion}` : appName,
      isAlive,
      isAliveMeta: getAliveMeta(isAlive),
      isHighRiskPort,
      highRiskMeta: isHighRiskPort === true
        ? { label: '高危端口', tone: 'danger' }
        : { label: '普通端口', tone: 'neutral' },
      lastAliveAtDisplay: formatDateTime(firstDefined(item?.last_alive_at, item?.lastAliveAt)),
      portCreatedAtDisplay: formatDateTime(firstDefined(item?.port_created_at, item?.portCreatedAt))
    }
  })
}

function normalizeRelatedDomains(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }

  return String(value ?? '')
    .split(/[,，\n\r；;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
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

function formatOsType(osType, osVersion) {
  const typeText = formatText(osType)
  const versionText = formatText(osVersion, '')

  if (typeText === '--' || !versionText) {
    return typeText
  }

  return `${typeText} / ${versionText}`
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
