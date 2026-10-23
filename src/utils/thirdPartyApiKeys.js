export const API_KEY_LIMITS = Object.freeze({ key: 512, platformUrl: 2048, description: 512, rateLimit: 4294967295 })

const byteLength = (value) => new TextEncoder().encode(value).length

export function validateApiKeyForm(form, isCreate) {
  const platformUrl = form.platformUrl.trim()
  let url
  try {
    url = new URL(platformUrl)
  } catch {
    return '请输入有效的 HTTP/HTTPS 平台 URL。'
  }
  if (!/^https?:\/\//i.test(platformUrl) || !url.hostname || url.username || url.password || platformUrl.includes('#') || /[\s\p{Cc}]/u.test(platformUrl)) {
    return '平台 URL 仅支持不含凭据、空白或片段的 HTTP/HTTPS 地址。'
  }
  if (byteLength(platformUrl) > API_KEY_LIMITS.platformUrl) return '平台 URL 不能超过 2048 字节。'
  if (byteLength(form.description) > API_KEY_LIMITS.description) return '描述不能超过 512 字节。'
  if (!/^\d+$/.test(String(form.rateLimit)) || Number(form.rateLimit) > API_KEY_LIMITS.rateLimit) {
    return '每分钟限流请输入 0 到 4294967295 之间的整数。'
  }
  if (isCreate || form.key !== '') {
    if (!form.key.trim()) return '请输入 API Key。'
    if (/\p{Cc}/u.test(form.key)) return 'API Key 不能包含控制字符。'
    if (byteLength(form.key) > API_KEY_LIMITS.key) return 'API Key 不能超过 512 字节。'
  }
  return ''
}

// 更新必须完整提交元信息；空 Key 不发送，避免覆盖已有密钥。
export function buildApiKeyPayload(form, isCreate) {
  const payload = {
    platform_url: form.platformUrl.trim(),
    rate_limit_per_minute: Number(form.rateLimit),
    description: form.description.trim()
  }
  if (isCreate || form.key !== '') payload.key = form.key
  return payload
}

export function normalizeApiKey(raw) {
  if (!raw || !Number.isSafeInteger(raw.id) || raw.id <= 0) {
    throw new Error('API Key 配置数据异常，请刷新后重试。')
  }
  return {
    id: raw.id,
    platformUrl: typeof raw.platform_url === 'string' ? raw.platform_url : '',
    rateLimit: Number.isInteger(raw.rate_limit_per_minute) && raw.rate_limit_per_minute >= 0 && raw.rate_limit_per_minute <= API_KEY_LIMITS.rateLimit
      ? raw.rate_limit_per_minute
      : 0,
    description: typeof raw.description === 'string' ? raw.description : '',
    keyConfigured: raw.key_configured === true,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : '',
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : ''
  }
}

export function normalizeApiKeyPage(raw) {
  const pageSize = raw?.pageSize ?? raw?.page_size
  const totalPages = raw?.totalPages ?? raw?.total_pages
  if (!raw || !Array.isArray(raw.items) || !Number.isSafeInteger(raw.total) || raw.total < 0 ||
      !Number.isInteger(raw.page) || raw.page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 ||
      !Number.isInteger(totalPages) || totalPages < 0) {
    throw new Error('API Key 分页数据异常，请重试。')
  }
  return {
    items: raw.items.map(normalizeApiKey),
    page: raw.page,
    pageSize,
    total: raw.total,
    totalPages: Math.max(1, totalPages)
  }
}
