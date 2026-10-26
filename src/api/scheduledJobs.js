import {
  SCHEDULED_JOBS_API,
  buildScheduledJobApi,
  buildScheduledJobRunApi,
  buildScheduledJobRunsApi,
  buildScheduledJobTriggerApi
} from '../constants/api'
import { requestJson } from '../utils/http'

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
