export const scanTabs = [
  { key: 'overview', label: '概览', count: 0 },
  { key: 'configurations', label: '扫描策略配置', count: null }
]

export const scanFilters = {
  searchPlaceholder: '按名称搜索',
  statusLabel: '状态',
  typeLabel: '扫描类型'
}

export const scanRows = [
  {
    id: '114.111.30.111',
    status: '已完成',
    severity: {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
      info: 9,
      unknown: 0
    },
    templates: '24',
    services: '7',
    duration: '12 分钟',
    updatedAt: '6 分钟前'
  }
]

export const scanSeverityOrder = ['critical', 'high', 'medium', 'low', 'info', 'unknown']

export const scanSeverityToneMap = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
  unknown: 'unknown'
}