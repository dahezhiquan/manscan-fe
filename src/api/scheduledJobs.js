import {
  SCHEDULED_JOBS_API,
  buildScheduledJobApi,
  buildScheduledJobRunApi,
  buildScheduledJobRunOutputApi,
  buildScheduledJobRunsApi,
  buildScheduledJobStopApi,
  buildScheduledJobTriggerApi
} from '../constants/api'
import { createAuthorizedRequestOptions, requestJson } from '../utils/http'
import { notifyAuthSessionExpired } from '../utils/authSession'

export async function getScheduledJobList(params = {}, signal) {
  const searchParams = new URLSearchParams()
  appendParam(searchParams, 'page', params.page)
  appendParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  const query = searchParams.toString()
  return requestJson(query ? `${SCHEDULED_JOBS_API}?${query}` : SCHEDULED_JOBS_API, { signal })
}

export function getScheduledJob(jobId, signal) {
  return requestJson(buildScheduledJobApi(jobId), { signal })
}

export function updateScheduledJob(jobId, payload, signal) {
  return requestJson(buildScheduledJobApi(jobId), jsonOptions('PUT', payload, signal))
}

export function deleteScheduledJob(jobId, signal) {
  return requestJson(buildScheduledJobApi(jobId), { method: 'DELETE', signal })
}

export function triggerScheduledJob(jobId, signal) {
  return requestJson(buildScheduledJobTriggerApi(jobId), { method: 'POST', signal })
}

export function stopScheduledJob(jobId, signal) {
  return requestJson(buildScheduledJobStopApi(jobId), { method: 'POST', signal })
}

export async function getScheduledJobRuns(jobId, params = {}, signal) {
  const searchParams = new URLSearchParams()
  appendParam(searchParams, 'page', params.page)
  appendParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  const query = searchParams.toString()
  return requestJson(query ? `${buildScheduledJobRunsApi(jobId)}?${query}` : buildScheduledJobRunsApi(jobId), { signal })
}

export function getScheduledJobRun(runId, signal) {
  return requestJson(buildScheduledJobRunApi(runId), { signal })
}

export async function downloadScheduledJobRunOutput(runId) {
  const response = await fetch(buildScheduledJobRunOutputApi(runId), createAuthorizedRequestOptions({ method: 'GET' }))
  if (!response.ok) {
    if (response.status === 401) notifyAuthSessionExpired()
    throw new Error(await readDownloadErrorMessage(response))
  }

  const blob = await response.blob()
  const filename = resolveDownloadFilename(response.headers.get('content-disposition'), `run-${runId}-output`)
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

async function readDownloadErrorMessage(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    const payload = await response.json().catch(() => null)
    if (payload && typeof payload === 'object') {
      if (payload.message) return String(payload.message)
      if (payload.data && typeof payload.data === 'object' && payload.data.message) return String(payload.data.message)
    }
  }
  const text = await response.text().catch(() => '')
  return text || `请求失败：${response.status}`
}

function resolveDownloadFilename(contentDisposition, fallbackName) {
  if (!contentDisposition) return fallbackName
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try { return decodeURIComponent(utf8Match[1].trim()) } catch { return utf8Match[1].trim() }
  }
  const filenameMatch = contentDisposition.match(/filename\s*=\s*("?)([^";]+)\1/i)
  return filenameMatch?.[2]?.trim() || fallbackName
}

function appendParam(searchParams, key, value) {
  if (value !== undefined && value !== null && value !== '') {
    searchParams.set(key, String(value))
  }
}

function jsonOptions(method, payload, signal) {
  return {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }
}
