import { firstDefined, formatDateTime } from './scanTask'

export const USER_ROLE_OPTIONS = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' }
]

export const USER_STATUS_OPTIONS = [
  { value: 'enabled', label: '启用', tone: 'enabled' },
  { value: 'disabled', label: '禁用', tone: 'disabled' },
  { value: 'locked', label: '锁定', tone: 'locked' }
]

export function normalizeUserListResponse(payload, fallbackPage = 1, fallbackPageSize = 10) {
  const pageSize = normalizePositiveInteger(firstDefined(payload?.pageSize, payload?.page_size), fallbackPageSize)
  const total = normalizeNonNegativeInteger(payload?.total, 0)
  const totalPagesFallback = total > 0 ? Math.ceil(total / pageSize) : 1

  return {
    items: normalizeUserList(payload?.items),
    total,
    page: normalizePositiveInteger(payload?.page, fallbackPage),
    pageSize,
    totalPages: normalizePositiveInteger(firstDefined(payload?.totalPages, payload?.total_pages), totalPagesFallback)
  }
}

export function normalizeUserList(items) {
  return (Array.isArray(items) ? items : []).map(normalizeUser)
}

export function normalizeUser(record) {
  const username = formatText(record?.username, '--')
  const role = normalizeRole(record?.role)
  const status = normalizeStatus(record?.status)
  const lastLoginAt = firstDefined(record?.last_login_at, record?.lastLoginAt)

  return {
    username,
    role,
    roleLabel: getRoleLabel(role),
    status,
    statusLabel: getStatusMeta(status).label,
    statusTone: getStatusMeta(status).tone,
    lastLoginAtDisplay: lastLoginAt ? formatDateTime(lastLoginAt) : '从未登录',
    key: username
  }
}

function normalizeRole(value) {
  const role = String(value ?? '').trim().toLowerCase()
  return USER_ROLE_OPTIONS.some((item) => item.value === role) ? role : 'user'
}

function normalizeStatus(value) {
  const status = String(value ?? '').trim().toLowerCase()
  return USER_STATUS_OPTIONS.some((item) => item.value === status) ? status : 'enabled'
}

function getRoleLabel(role) {
  return USER_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role
}

function getStatusMeta(status) {
  return USER_STATUS_OPTIONS.find((item) => item.value === status) ?? USER_STATUS_OPTIONS[0]
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback
}

function normalizeNonNegativeInteger(value, fallback) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback
}

function formatText(value, fallback = '--') {
  const text = String(value ?? '').trim()
  return text || fallback
}
