import { SCAN_TASK_CREATE_API, buildScanTaskApi, buildScanTaskLogsApi, buildScanTaskStreamApi } from '../constants/api'
import { requestJson } from '../utils/http'

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

export async function getScanTaskLogs(taskId, offset, limit) {
  return requestJson(buildScanTaskLogsApi(taskId, offset, limit))
}

export function createScanTaskStream(taskId, offset) {
  return new EventSource(buildScanTaskStreamApi(taskId, offset))
}
