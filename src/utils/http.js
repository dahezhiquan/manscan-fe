import { getAuthorizationHeader, notifyAuthSessionExpired } from './authSession'

export class HttpRequestError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'HttpRequestError'
    this.status = details.status ?? 0
    this.code = details.code ?? null
    this.payload = details.payload ?? null
  }
}

function extractEnvelope(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload && 'code' in payload) {
    return payload
  }

  return null
}

function isUnauthorizedCode(code) {
  return Number(code) === 40101
}

function handleUnauthorized({ status, code, skipAuth }) {
  if (!skipAuth && (status === 401 || isUnauthorizedCode(code))) {
    notifyAuthSessionExpired()
  }
}

export function createAuthorizedRequestOptions(options = {}) {
  const { skipAuth = false, headers, ...fetchOptions } = options
  const requestHeaders = new Headers(headers || {})
  const authorization = getAuthorizationHeader()

  if (!skipAuth && authorization && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', authorization)
  }

  return {
    ...fetchOptions,
    headers: requestHeaders
  }
}

export function unwrapResponsePayload(payload, options = {}) {
  const envelope = extractEnvelope(payload)

  if (!envelope) {
    return payload
  }

  if (envelope.code !== 0) {
    handleUnauthorized({ code: envelope.code, skipAuth: options.skipAuth })
    throw new HttpRequestError(envelope.message || '请求失败', {
      code: envelope.code,
      payload
    })
  }

  return envelope.data
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, createAuthorizedRequestOptions(options))
  const payload = await response.json().catch(() => null)
  const envelope = extractEnvelope(payload)

  if (!response.ok) {
    handleUnauthorized({
      status: response.status,
      code: envelope?.code,
      skipAuth: options.skipAuth
    })

    const message = envelope?.message || payload?.message || `请求失败：${response.status}`
    throw new HttpRequestError(message, {
      status: response.status,
      code: envelope?.code,
      payload
    })
  }

  return unwrapResponsePayload(payload, {
    skipAuth: options.skipAuth
  })
}
