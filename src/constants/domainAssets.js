export const DOMAIN_ASSET_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DOMAIN_ASSET_SEARCH_DEBOUNCE = 300

export const DOMAIN_ASSET_RISK_OPTIONS = [
  { value: '', label: '全部风险等级', shortLabel: '风险等级' },
  { value: 'critical', label: '严重风险', shortLabel: '严重' },
  { value: 'high', label: '高风险', shortLabel: '高危' },
  { value: 'medium', label: '中风险', shortLabel: '中危' },
  { value: 'low', label: '低风险', shortLabel: '低危' },
  { value: 'info', label: '无风险', shortLabel: '无风险' },
  { value: 'unknown', label: '未知风险', shortLabel: '未知' }
]

export const DOMAIN_ASSET_ALIVE_OPTIONS = [
  { value: '', label: '全部存活状态', shortLabel: '存活状态' },
  { value: 'true', label: '存活', shortLabel: '存活' },
  { value: 'false', label: '失活', shortLabel: '失活' }
]

export const DOMAIN_ASSET_FILTER_OPTIONS = [
  { key: 'organization', label: '所属组织单位', placeholder: '输入所属组织单位' },
  { key: 'owner', label: '内部负责人', placeholder: '输入负责人' },
  { key: 'scanTask', label: '相关扫描任务', placeholder: '输入扫描任务名称' },
  { key: 'region', label: '网络区域', placeholder: '输入网络区域' },
  { key: 'assetAddress', label: '资产地址', placeholder: '输入域名或 URL' },
  { key: 'riskLevel', label: '风险等级', type: 'select', options: DOMAIN_ASSET_RISK_OPTIONS },
  { key: 'businessSystem', label: '业务系统', placeholder: '输入业务系统' },
  { key: 'alive', label: '存活状态', type: 'select', options: DOMAIN_ASSET_ALIVE_OPTIONS }
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
