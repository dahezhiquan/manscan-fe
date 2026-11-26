const DEFAULT_EVENT = 'scan_started'
const DEFAULT_STYLE = 'blue'

export function normalizeNotificationListResponse(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : []

  return items
    .map(normalizeNotification)
    .filter((notification) => notification.id !== null)
}

export function normalizeNotification(payload) {
  const id = Number(payload?.id)

  return {
    id: Number.isSafeInteger(id) && id > 0 ? id : null,
    name: typeof payload?.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : '未命名通知',
    description: typeof payload?.description === 'string' ? payload.description.trim() : '',
    enabled: payload?.enabled === true || payload?.enabled === 1 || payload?.enabled === 'true',
    event: typeof payload?.event === 'string' && payload.event ? payload.event : DEFAULT_EVENT,
    style: typeof payload?.style === 'string' && payload.style ? payload.style : DEFAULT_STYLE
  }
}
