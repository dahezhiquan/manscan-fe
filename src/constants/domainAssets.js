export const DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DOMAIN_ASSET_SEARCH_DEBOUNCE = 300
export const DOMAIN_ASSET_VULNERABILITY_SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']

export const DOMAIN_ASSET_RISK_OPTIONS = [
  { value: '', label: '全部风险等级', shortLabel: '风险等级' },
  { value: 'critical', label: '严重风险', shortLabel: '严重' },
  { value: 'high', label: '高风险', shortLabel: '高危' },
  { value: 'medium', label: '中风险', shortLabel: '中危' },
  { value: 'low', label: '低风险', shortLabel: '低危' },
  { value: 'info', label: '无风险', shortLabel: '无风险' }
]

export const DOMAIN_ASSET_FILTER_OPTIONS = [
  { key: 'title', label: '站点标题', placeholder: '输入站点标题' },
  { key: 'region', label: '区域', placeholder: '输入区域' },
  { key: 'riskLevel', label: '风险等级', type: 'select', options: DOMAIN_ASSET_RISK_OPTIONS },
  { key: 'vulnerabilityCount', label: '漏洞数量', placeholder: '输入漏洞数量' },
  { key: 'componentCount', label: '组件数量', placeholder: '输入组件数量' }
]

export const DOMAIN_ASSET_FILTER_LABELS = DOMAIN_ASSET_FILTER_OPTIONS.reduce((result, item) => {
  result[item.key] = item.label
  return result
}, {})

export const DOMAIN_ASSET_RISK_META = {
  critical: { label: '严重', tone: 'critical' },
  high: { label: '高危', tone: 'high' },
  medium: { label: '中危', tone: 'medium' },
  low: { label: '低危', tone: 'low' },
  info: { label: '无风险', tone: 'info' },
  unknown: { label: '未知', tone: 'unknown' }
}
