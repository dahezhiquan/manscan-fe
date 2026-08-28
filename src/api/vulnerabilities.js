import {
  VULNERABILITY_BATCH_STATUS_API,
  VULNERABILITY_LIST_API,
  buildVulnerabilityDetailApi,
  buildVulnerabilityStatusApi
} from '../constants/api'
import { requestJson } from '../utils/http'

export async function getVulnerabilityList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendSingleQueryParam(searchParams, 'page', params.page)
  appendSingleQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendSingleQueryParam(searchParams, 'keyword', params.keyword)
  appendMultiQueryParam(searchParams, 'asset_host', params.asset_host ?? params.assetHost)
  appendMultiQueryParam(searchParams, 'status', params.status)
  appendMultiQueryParam(searchParams, 'tags', params.tags ?? params.tag)
  appendMultiQueryParam(searchParams, 'severity', params.severity ?? params.level)
  appendMultiQueryParam(searchParams, 'template_id', params.template_id ?? params.templateId)
  appendMultiQueryParam(
    searchParams,
    'vulnerability_name',
    params.vulnerability_name ?? params.vulnerabilityName
  )
  appendMultiQueryParam(
    searchParams,
    'latest_scan_task_name',
    params.latest_scan_task_name ?? params.latestScanTaskName
  )
  appendMultiQueryParam(searchParams, 'protocol', params.protocol)

  const query = searchParams.toString()
  const requestUrl = query ? `${VULNERABILITY_LIST_API}?${query}` : VULNERABILITY_LIST_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

export async function getVulnerabilityDetail(vulnerabilityId, signal) {
  return requestJson(buildVulnerabilityDetailApi(vulnerabilityId), {
    method: 'GET',
    signal
  })
}

export async function updateVulnerabilityStatus(vulnerabilityId, status, signal) {
  return requestJson(buildVulnerabilityStatusApi(vulnerabilityId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status }),
    signal
  })
}

export async function updateVulnerabilityStatuses(ids, status, signal) {
  return requestJson(VULNERABILITY_BATCH_STATUS_API, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids, status }),
    signal
  })
}

function appendSingleQueryParam(searchParams, key, value) {
  if (value === null || value === undefined || value === '') {
    return
  }

  searchParams.set(key, String(value))
}

function appendMultiQueryParam(searchParams, key, value) {
  if (Array.isArray(value)) {
    value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .forEach((item) => {
        searchParams.append(key, item)
      })
    return
  }

  appendSingleQueryParam(searchParams, key, value)
}
