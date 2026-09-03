export const SCAN_LIST_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const SCAN_LIST_POLL_INTERVAL = 7000
export const SCAN_LIST_SEARCH_DEBOUNCE = 320
export const SCAN_TASK_SELECT_ALL_PAGE_SIZE = 100
export const SCAN_TASK_BULK_DELETE_BATCH_SIZE = 1000

export const ACTIVE_SCAN_STATUSES = new Set(['running', 'pending'])
export const SCAN_TASK_DELETABLE_STATUSES = new Set(['success', 'failed', 'cancelled', 'paused'])

export const SCAN_SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

export const SCAN_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '等待中' },
  { value: 'running', label: '运行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' }
]

export const SCAN_STATUS_META = {
  pending: { label: '等待中', tone: 'pending' },
  running: { label: '运行中', tone: 'running' },
  paused: { label: '已暂停', tone: 'paused' },
  success: { label: '成功', tone: 'success' },
  failed: { label: '失败', tone: 'error' },
  cancelled: { label: '已取消', tone: 'warning' }
}

export const SCAN_STRATEGY_LABELS = {
  auto: '自动适配',
  'host-spray': '先按 Host 扫描',
  'template-spray': '先按模板扫描'
}

export const SCAN_STRATEGY_OPTIONS = [
  { value: '', label: '全部策略' },
  { value: 'auto', label: SCAN_STRATEGY_LABELS.auto },
  { value: 'host-spray', label: SCAN_STRATEGY_LABELS['host-spray'] },
  { value: 'template-spray', label: SCAN_STRATEGY_LABELS['template-spray'] }
]
