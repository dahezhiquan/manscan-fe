import { VULNERABILITY_STATUS_OPTIONS } from './vulnerabilities'

export const DASHBOARD_SEVERITIES = [
  { key: 'critical', label: '严重', tone: 'critical' },
  { key: 'high', label: '高危', tone: 'high' },
  { key: 'medium', label: '中危', tone: 'medium' },
  { key: 'low', label: '低危', tone: 'low' }
]
export const DASHBOARD_ASSET_RISKS = [
  ...DASHBOARD_SEVERITIES,
  { key: 'no_risk', label: '无风险', tone: 'info' },
  { key: 'unknown', label: '未知风险', tone: 'unknown' }
]
export const DASHBOARD_STATUSES = VULNERABILITY_STATUS_OPTIONS.filter((item) => item.value)
export const DASHBOARD_REFRESH_TIMEOUT = 15000
export const DASHBOARD_RANKING_LIMIT = 10
