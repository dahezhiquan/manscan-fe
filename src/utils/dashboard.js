import { DASHBOARD_ASSET_RISKS, DASHBOARD_RANKING_LIMIT, DASHBOARD_SEVERITIES, DASHBOARD_STATUSES } from '../constants/dashboard'

function requireCount(value) {
  const count = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('统计数据缺少有效数量，请重试')
  }
  return count
}

function normalizeCounts(payload, keys) {
  return Object.fromEntries(keys.map((key) => [key, requireCount(payload?.[key])]))
}

export function formatDashboardCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('zh-CN') : '--'
}

export function sumDashboardCounts(values) {
  if (!values.every((value) => Number.isSafeInteger(value) && value >= 0)) return null
  const sum = values.reduce((total, value) => total + value, 0)
  return Number.isSafeInteger(sum) ? sum : null
}

export function dashboardPercentage(count, total) {
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(total) || count < 0 || total < count) return null
  return total === 0 ? 0 : Math.round(count / total * 100)
}

export function normalizeDashboardOverview(payload) {
  const statuses = normalizeCounts(payload?.vulnerability_status, ['total', ...DASHBOARD_STATUSES.map(({ value }) => value)])
  const pending = normalizeCounts(payload?.pending_vulnerabilities, ['total', ...DASHBOARD_SEVERITIES.map(({ key }) => key)])
  const classified = sumDashboardCounts(DASHBOARD_SEVERITIES.map(({ key }) => pending[key]))
  const statusTotal = sumDashboardCounts(DASHBOARD_STATUSES.map(({ value }) => statuses[value]))
  if (classified === null || classified > pending.total || statusTotal === null || statusTotal > statuses.total || pending.total !== statuses.unreviewed) {
    throw new Error('漏洞统计数量不一致，请重试')
  }
  return {
    statuses,
    pending: { ...pending, other: pending.total - classified },
    highRiskOpenPorts: requireCount(payload?.high_risk_open_ports)
  }
}

export function normalizeDashboardAssetRisks(payload) {
  return Object.fromEntries(['hosts', 'domains'].map((type) => {
    const counts = normalizeCounts(payload?.[type], DASHBOARD_ASSET_RISKS.map(({ key }) => key))
    const total = sumDashboardCounts(Object.values(counts))
    if (total === null) throw new Error('资产统计数量超出有效范围，请重试')
    return [type, { counts, total }]
  }))
}

function normalizeRanking(items, nameField, countField, hostRanking = false) {
  if (!Array.isArray(items)) throw new Error('排行榜数据格式异常，请重试')
  const seen = new Set()
  return items.slice(0, DASHBOARD_RANKING_LIMIT).map((item) => {
    const rawName = item?.[nameField]
    if (typeof rawName !== 'string' || !rawName.trim() || seen.has(rawName)) {
      throw new Error('排行榜名称缺失或重复，请重试')
    }
    seen.add(rawName)
    return {
      key: rawName,
      label: rawName,
      count: requireCount(item[countField]),
      // 排行榜只生成站内详情地址，指纹名称始终按文本展示。
      route: hostRanking ? `/assets/hosts/${encodeURIComponent(rawName)}` : null
    }
  })
}

export function normalizeDashboardHostRankings(payload) {
  return {
    vulnerabilities: normalizeRanking(payload?.top_vulnerabilities, 'ip_address', 'vulnerability_count', true),
    ports: normalizeRanking(payload?.top_ports, 'ip_address', 'port_count', true)
  }
}

export function normalizeDashboardServiceFingerprints(payload) {
  return {
    domains: normalizeRanking(payload?.domains, 'app_name', 'count'),
    hosts: normalizeRanking(payload?.hosts, 'service_name', 'count')
  }
}
