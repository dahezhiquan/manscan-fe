import { THIRD_PARTY_API_KEYS_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getThirdPartyApiKeyList(params = {}, signal) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(params.page ?? 1))
  searchParams.set('page_size', String(params.pageSize ?? 10))
  return requestJson(`${THIRD_PARTY_API_KEYS_API}?${searchParams.toString()}`, { method: 'GET', signal })
}

export async function getThirdPartyApiKey(id, signal) {
  return requestJson(`${THIRD_PARTY_API_KEYS_API}/${encodeURIComponent(id)}`, { method: 'GET', signal })
}

export async function getThirdPartyApiKeyPlaintext(id, signal) {
  const data = await requestJson(`${THIRD_PARTY_API_KEYS_API}/${encodeURIComponent(id)}/plaintext`, {
    method: 'GET',
    cache: 'no-store',
    signal
  })
  if (!data || typeof data.key !== 'string') throw new Error('密钥响应格式异常，请重试。')
  return data.key
}

export async function createThirdPartyApiKey(payload, signal) {
  return requestJson(THIRD_PARTY_API_KEYS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  })
}

export async function updateThirdPartyApiKey(id, payload, signal) {
  return requestJson(`${THIRD_PARTY_API_KEYS_API}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  })
}

export async function deleteThirdPartyApiKey(id, signal) {
  return requestJson(`${THIRD_PARTY_API_KEYS_API}/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}
