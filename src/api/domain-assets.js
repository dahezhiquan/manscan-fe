import {
  DOMAIN_ASSET_DETAIL_API,
  DOMAIN_ASSET_LIST_API,
  DOMAIN_ASSET_MANUAL_NOTE_API
} from '../constants/api'
import { requestJson } from '../utils/http'

export async function getDomainAssetList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendQueryParam(searchParams, 'keyword', params.keyword)
  appendQueryParam(searchParams, 'title', params.title)
  appendQueryParam(searchParams, 'region', params.region)
  appendQueryParam(searchParams, 'risk_level', params.risk_level ?? params.riskLevel)
  appendQueryParam(searchParams, 'has_vulnerability', params.has_vulnerability ?? params.hasVulnerability)
  appendQueryParam(searchParams, 'has_component', params.has_component ?? params.hasComponent)

  const query = searchParams.toString()
  const requestUrl = query ? `${DOMAIN_ASSET_LIST_API}?${query}` : DOMAIN_ASSET_LIST_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

export async function getDomainAssetDetail(domain, signal) {
  const searchParams = new URLSearchParams()
  appendQueryParam(searchParams, 'domain', domain)

  return requestJson(`${DOMAIN_ASSET_DETAIL_API}?${searchParams.toString()}`, {
    method: 'GET',
    signal
  })
}

export async function updateDomainAssetManualNote(domain, manualNote, signal) {
  return requestJson(DOMAIN_ASSET_MANUAL_NOTE_API, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      domain,
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
