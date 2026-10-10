import { HOST_ASSET_LIST_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getHostAssetList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendQueryParam(searchParams, 'keyword', params.keyword)
  appendQueryParam(searchParams, 'os_type', params.os_type ?? params.osType)
  appendQueryParam(searchParams, 'region', params.region)
  appendQueryParam(searchParams, 'risk_level', params.risk_level ?? params.riskLevel)

  const query = searchParams.toString()
  const requestUrl = query ? `${HOST_ASSET_LIST_API}?${query}` : HOST_ASSET_LIST_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

function appendQueryParam(searchParams, key, value) {
  if (value === null || value === undefined || value === '') {
    return
  }

  searchParams.set(key, String(value))
}
