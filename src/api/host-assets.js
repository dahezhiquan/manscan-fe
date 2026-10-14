import {
  HOST_ASSET_DETAIL_API,
  HOST_ASSET_LIST_API,
  HOST_ASSET_MANUAL_NOTE_API
} from '../constants/api'
import { requestJson } from '../utils/http'

export async function getHostAssetList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendQueryParam(searchParams, 'keyword', params.keyword)
  appendQueryParam(searchParams, 'os_type', params.os_type ?? params.osType)
  appendQueryParam(searchParams, 'region', params.region)
  appendQueryParam(searchParams, 'risk_level', params.risk_level ?? params.riskLevel)
  appendQueryParam(searchParams, 'has_vulnerability', params.has_vulnerability ?? params.hasVulnerability)
  appendQueryParam(searchParams, 'is_alive', params.is_alive ?? params.isAlive)

  const query = searchParams.toString()
  const requestUrl = query ? `${HOST_ASSET_LIST_API}?${query}` : HOST_ASSET_LIST_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

export async function getHostAssetDetail(ipAddress, signal) {
  const searchParams = new URLSearchParams()
  appendQueryParam(searchParams, 'ip_address', ipAddress)

  return requestJson(`${HOST_ASSET_DETAIL_API}?${searchParams.toString()}`, {
    method: 'GET',
    signal
  })
}

export async function updateHostAssetManualNote(ipAddress, manualNote, signal) {
  return requestJson(HOST_ASSET_MANUAL_NOTE_API, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ip_address: ipAddress,
      manual_note: manualNote
    }),
    signal
  })
}

function appendQueryParam(searchParams, key, value) {
  if (value === null || value === undefined || value === '') {
    return
  }

  searchParams.set(key, String(value))
}
