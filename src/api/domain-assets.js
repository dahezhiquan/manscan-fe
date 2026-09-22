import { DOMAIN_ASSET_LIST_API } from '../constants/api'
import { requestJson } from '../utils/http'

export async function getDomainAssetList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendQueryParam(searchParams, 'page', params.page)
  appendQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendQueryParam(searchParams, 'keyword', params.keyword)
  appendQueryParam(searchParams, 'organization', params.organization)
  appendQueryParam(
    searchParams,
    'include_sub_organization',
    params.include_sub_organization ?? params.includeSubOrganization
  )
  appendQueryParam(searchParams, 'owner', params.owner)
  appendQueryParam(searchParams, 'scan_task', params.scan_task ?? params.scanTask)
  appendQueryParam(searchParams, 'region', params.region)
  appendQueryParam(searchParams, 'asset_address', params.asset_address ?? params.assetAddress)
  appendQueryParam(searchParams, 'risk_level', params.risk_level ?? params.riskLevel)
  appendQueryParam(searchParams, 'business_system', params.business_system ?? params.businessSystem)
  appendQueryParam(searchParams, 'is_alive', params.is_alive ?? params.isAlive)

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
