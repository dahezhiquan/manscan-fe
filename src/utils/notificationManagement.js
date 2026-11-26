const DEFAULT_EVENT = 'scan_started'
const DEFAULT_STYLE = 'blue'

export const NOTIFICATION_LIMITS = { name: 100, description: 500, webhook: 512 }

export function normalizeNotificationStyles(payload) {
  if (!Array.isArray(payload?.items)) throw new Error('通知样式列表格式异常，请重试。')
  const seen = new Set()
  return payload.items.filter((item) => {
    if (typeof item?.id !== 'string' || !item.id.trim() || typeof item.name !== 'string' || !item.name.trim() || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  }).map(({ id, name }) => ({ id, name }))
}

export function validateNotificationForm(form, styles) {
  const name = form.name.trim()
  if (!name || [...name].length > NOTIFICATION_LIMITS.name) return '通知名称需为 1–100 个字符。'
  if ([...form.description.trim()].length > NOTIFICATION_LIMITS.description) return '通知描述不能超过 500 个字符。'
  if (!styles.some((item) => item.id === form.style)) return '请选择可用的卡片样式。'
  const webhook = form.webhook.trim()
  if (webhook && (webhook.length > NOTIFICATION_LIMITS.webhook || !/^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(webhook))) {
    return '请填写完整的飞书机器人 Webhook 地址，或留空保留原地址。'
  }
  return ''
}

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
