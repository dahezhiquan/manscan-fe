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

export const DOMAIN_ASSET_VULNERABILITY_EXISTENCE_OPTIONS = [
  { value: '', label: '全部漏洞状态', shortLabel: '是否存在漏洞' },
  { value: 'true', label: '存在漏洞', shortLabel: '存在漏洞' },
  { value: 'false', label: '不存在漏洞', shortLabel: '不存在漏洞' }
]

export const DOMAIN_ASSET_COMPONENT_EXISTENCE_OPTIONS = [
  { value: '', label: '全部组件状态', shortLabel: '是否存在组件' },
  { value: 'true', label: '存在组件', shortLabel: '存在组件' },
  { value: 'false', label: '不存在组件', shortLabel: '不存在组件' }
]

export const DOMAIN_ASSET_FILTER_OPTIONS = [
  { key: 'title', label: '站点标题', placeholder: '输入站点标题' },
  { key: 'region', label: '区域', placeholder: '输入区域' },
  { key: 'riskLevel', label: '风险等级', type: 'select', options: DOMAIN_ASSET_RISK_OPTIONS },
  { key: 'hasVulnerability', label: '是否存在漏洞', type: 'select', options: DOMAIN_ASSET_VULNERABILITY_EXISTENCE_OPTIONS },
  { key: 'hasComponent', label: '是否存在组件', type: 'select', options: DOMAIN_ASSET_COMPONENT_EXISTENCE_OPTIONS }
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
