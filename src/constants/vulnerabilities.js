export const VULNERABILITY_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const VULNERABILITY_LIST_SEARCH_DEBOUNCE = 320
export const VULNERABILITY_STATUS_UNREVIEWED = 'unreviewed'
export const VULNERABILITY_STATUS_CONFIRMED = 'confirmed'
export const VULNERABILITY_STATUS_TICKETED = 'ticketed'
export const VULNERABILITY_STATUS_FIXED = 'fixed'
export const VULNERABILITY_STATUS_FALSE_POSITIVE = 'false_positive'
export const VULNERABILITY_STATUS_IGNORED = 'ignored'

export const VULNERABILITY_SEVERITY_OPTIONS = [
  { value: '', label: '全部等级' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
  { value: 'unknown', label: 'Unknown' }
]

export const VULNERABILITY_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: VULNERABILITY_STATUS_UNREVIEWED, label: '未审核' },
  { value: VULNERABILITY_STATUS_CONFIRMED, label: '已确认' },
  { value: VULNERABILITY_STATUS_TICKETED, label: '已发单' },
  { value: VULNERABILITY_STATUS_FIXED, label: '已修复' },
  { value: VULNERABILITY_STATUS_FALSE_POSITIVE, label: '误报' },
  { value: VULNERABILITY_STATUS_IGNORED, label: '忽略' }
]

export const VULNERABILITY_STATUS_UPDATE_OPTIONS = [
  { value: VULNERABILITY_STATUS_UNREVIEWED, label: '未审核', tone: 'warning' },
  { value: VULNERABILITY_STATUS_CONFIRMED, label: '已确认', tone: 'confirmed' },
  { value: VULNERABILITY_STATUS_TICKETED, label: '已发单', tone: 'ticketed' },
  { value: VULNERABILITY_STATUS_FIXED, label: '已修复', tone: 'fixed' },
  { value: VULNERABILITY_STATUS_FALSE_POSITIVE, label: '误报', tone: 'false-positive' },
  { value: VULNERABILITY_STATUS_IGNORED, label: '忽略', tone: 'ignored' }
]

export const VULNERABILITY_TAG_OPTIONS = [
  { value: '', label: '全部标签' },
  { value: 'cve', label: 'CVE' },
  { value: 'kev', label: 'KEV' },
  { value: 'tech', label: 'Tech' },
  { value: 'vuln', label: 'Vuln' },
  { value: 'cnvd', label: 'CNVD' }
]

export const VULNERABILITY_PROTOCOL_OPTIONS = [
  { value: '', label: '全部协议' },
  { value: 'http', label: 'HTTP' },
  { value: 'dns', label: 'DNS' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'ssl', label: 'SSL' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'file', label: 'File' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'headless', label: 'Headless' },
  { value: 'whois', label: 'WHOIS' }
]

export const VULNERABILITY_SEVERITY_META = {
  critical: { label: 'Critical', tone: 'critical' },
  high: { label: 'High', tone: 'high' },
  medium: { label: 'Medium', tone: 'medium' },
  low: { label: 'Low', tone: 'low' },
  info: { label: 'Info', tone: 'info' },
  unknown: { label: 'Unknown', tone: 'unknown' }
}

export const VULNERABILITY_STATUS_META = {
  unreviewed: { label: '未审核', tone: 'warning' },
  confirmed: { label: '已确认', tone: 'confirmed' },
  ticketed: { label: '已发单', tone: 'ticketed' },
  fixed: { label: '已修复', tone: 'fixed' },
  false_positive: { label: '误报', tone: 'false-positive' },
  ignored: { label: '忽略', tone: 'ignored' }
}
