import {
  VULNERABILITY_BATCH_STATUS_API,
  VULNERABILITY_EXPORT_API,
  VULNERABILITY_LIST_API,
  buildVulnerabilityDetailApi,
  buildVulnerabilityStatusApi
} from '../constants/api'
import { HttpRequestError, createAuthorizedRequestOptions, requestJson } from '../utils/http'
import { notifyAuthSessionExpired } from '../utils/authSession'

export async function getVulnerabilityList(params = {}, signal) {
  const searchParams = buildVulnerabilityQueryParams(params)
  const query = searchParams.toString()
  const requestUrl = query ? `${VULNERABILITY_LIST_API}?${query}` : VULNERABILITY_LIST_API

  return requestJson(requestUrl, {
    method: 'GET',
    signal
  })
}

export async function downloadVulnerabilityExport(params = {}, signal) {
  const query = buildVulnerabilityQueryParams(params, false).toString()
  const requestUrl = query ? `${VULNERABILITY_EXPORT_API}?${query}` : VULNERABILITY_EXPORT_API
  const response = await fetch(requestUrl, createAuthorizedRequestOptions({ method: 'GET', signal }))
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok || !contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    const payload = contentType.includes('json') ? await response.json().catch(() => null) : null
    if (response.status === 401 || Number(payload?.code) === 40101) {
      notifyAuthSessionExpired()
    }

    throw new HttpRequestError(
      payload?.message || (response.ok ? '导出响应格式异常，请稍后重试。' : `导出漏洞失败：${response.status}`),
      { status: response.status, code: payload?.code, payload }
    )
  }

  const blob = await response.blob()
  const filename = response.headers.get('content-disposition')?.match(/vulnerabilities-\d{8}-\d{6}\.xlsx/)?.[0]
    || 'vulnerabilities.xlsx'
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

function buildVulnerabilityQueryParams(params, includePagination = true) {
  const searchParams = new URLSearchParams()

  if (includePagination) {
    appendSingleQueryParam(searchParams, 'page', params.page)
    appendSingleQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  }
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

  return searchParams
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

export async function deleteVulnerabilities(ids, signal) {
  return requestJson(VULNERABILITY_LIST_API, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids }),
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
