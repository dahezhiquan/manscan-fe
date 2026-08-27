import {
  SCAN_TASK_CREATE_API,
  SCAN_TASK_STATS_API,
  buildScanTaskApi,
  buildScanTaskCancelApi,
  buildScanTaskLogsApi,
  buildScanTaskPauseApi,
  buildScanTaskResumeApi,
  buildScanTaskStreamApi
} from '../constants/api'
import { requestJson } from '../utils/http'

export async function getScanTaskStats(signal) {
  return requestJson(SCAN_TASK_STATS_API, {
    signal
  })
}

export async function getScanTaskList(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendSingleQueryParam(searchParams, 'page', params.page)
  appendSingleQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendSingleQueryParam(searchParams, 'keyword', params.keyword)
  appendMultiQueryParam(searchParams, 'status', params.status)
  appendMultiQueryParam(searchParams, 'scan_strategy', params.scan_strategy ?? params.scanStrategy)
  appendSingleQueryParam(searchParams, 'created_by', params.created_by ?? params.createdBy)
  appendSingleQueryParam(searchParams, 'has_high_risk', params.has_high_risk ?? params.hasHighRisk)

  const query = searchParams.toString()
  const requestUrl = query ? `${SCAN_TASK_CREATE_API}?${query}` : SCAN_TASK_CREATE_API

  return requestJson(requestUrl, {
    signal
  })
}

export async function createScanTask(payload) {
  return requestJson(SCAN_TASK_CREATE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}

export async function getScanTask(taskId, signal) {
  return requestJson(buildScanTaskApi(taskId), {
    signal
  })
}

export async function cancelScanTask(taskId) {
  return requestJson(buildScanTaskCancelApi(taskId), {
    method: 'POST'
  })
}

export async function pauseScanTask(taskId) {
  return requestJson(buildScanTaskPauseApi(taskId), {
    method: 'POST'
  })
}

export async function resumeScanTask(taskId) {
  return requestJson(buildScanTaskResumeApi(taskId), {
    method: 'POST'
  })
}

export async function getScanTaskLogs(taskId, offset, limit, direction = '') {
  return requestJson(buildScanTaskLogsApi(taskId, offset, limit, direction))
}

export function createScanTaskStream(taskId, offset) {
  return new EventSource(buildScanTaskStreamApi(taskId, offset))
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
