function extractEnvelope(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload && 'code' in payload) {
    return payload
  }

  return null
}

export function unwrapResponsePayload(payload) {
  const envelope = extractEnvelope(payload)

  if (!envelope) {
    return payload
  }

  if (envelope.code !== 0) {
    throw new Error(envelope.message || '请求失败')
  }

  return envelope.data
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message = extractEnvelope(payload)?.message || payload?.message || `请求失败：${response.status}`
    throw new Error(message)
  }

  return unwrapResponsePayload(payload)
}
