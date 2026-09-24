import { DOMAIN_ASSET_LIST_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getDomainAssetList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendQueryParam(searchParams, 'keyword', params.keyword)
  appendQueryParam(searchParams, 'title', params.title)
  appendQueryParam(searchParams, 'region', params.region)
  appendQueryParam(searchParams, 'risk_level', params.risk_level ?? params.riskLevel)
  appendQueryParam(searchParams, 'vulnerability_count', params.vulnerability_count ?? params.vulnerabilityCount)
  appendQueryParam(searchParams, 'component_count', params.component_count ?? params.componentCount)

  const query = searchParams.toString()
  const requestUrl = query ? `${DOMAIN_ASSET_LIST_API}?${query}` : DOMAIN_ASSET_LIST_API

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
