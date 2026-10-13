import {
  SCAN_TASK_CREATE_API,
  SCAN_TASK_DELETE_API,
  SCAN_TASK_NAME_OPTIONS_API,
  SCAN_TASK_STATS_API,
  buildScanTaskApi,
  buildScanTaskCancelApi,
  buildScanTaskConfigApi,
  buildScanTaskLogsApi,
  buildScanTaskRawLogsArchiveApi,
  buildScanTaskResponsesArchiveApi,
  buildScanTaskPauseApi,
  buildScanTaskRescanApi,
  buildScanTaskResumeApi,
  buildScanTaskStreamApi
} from '../constants/api'
import { notifyAuthSessionExpired } from '../utils/authSession'
import { createAuthorizedRequestOptions, requestJson } from '../utils/http'

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

export async function getScanTaskNameOptions(params = {}, signal) {
  const searchParams = new URLSearchParams()

  appendSingleQueryParam(searchParams, 'page', params.page)
  appendSingleQueryParam(searchParams, 'page_size', params.page_size ?? params.pageSize)
  appendSingleQueryParam(searchParams, 'keyword', params.keyword)

  const query = searchParams.toString()
  const requestUrl = query ? `${SCAN_TASK_NAME_OPTIONS_API}?${query}` : SCAN_TASK_NAME_OPTIONS_API

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

export async function getScanTaskConfig(taskId, signal) {
  return requestJson(buildScanTaskConfigApi(taskId), {
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

export async function rescanScanTask(taskId, signal) {
  return requestJson(buildScanTaskRescanApi(taskId), {
    method: 'POST',
    signal
  })
}

export async function downloadScanTaskResponsesArchive(taskId) {
  await downloadScanTaskArchive(buildScanTaskResponsesArchiveApi(taskId), `${taskId}.zip`)
}

export async function downloadScanTaskRawLogsArchive(taskId) {
  await downloadScanTaskArchive(buildScanTaskRawLogsArchiveApi(taskId), `${taskId}.zip`)
}

async function downloadScanTaskArchive(requestUrl, fallbackName) {
  const response = await fetch(requestUrl, createAuthorizedRequestOptions({
    method: 'GET'
  }))

  if (!response.ok) {
    if (response.status === 401) {
      notifyAuthSessionExpired()
    }

    throw new Error(await readDownloadErrorMessage(response))
  }

  const blob = await response.blob()
  const filename = resolveDownloadFilename(
    response.headers.get('content-disposition'),
    fallbackName
  )

  triggerBrowserDownload(blob, filename)
}

export async function deleteScanTasks(ids, signal) {
  return requestJson(SCAN_TASK_DELETE_API, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids }),
    signal
  })
}

export async function getScanTaskLogs(taskId, offset, limit, direction = '') {
  return requestJson(buildScanTaskLogsApi(taskId, offset, limit, direction))
}

export function createScanTaskStream(taskId, offset) {
  return createAuthorizedEventStream(buildScanTaskStreamApi(taskId, offset))
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

async function readDownloadErrorMessage(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    const payload = await response.json().catch(() => null)

    if (payload && typeof payload === 'object') {
      if ('message' in payload && payload.message) {
        return String(payload.message)
      }

      if ('code' in payload && 'data' in payload && payload.data && typeof payload.data === 'object' && payload.data.message) {
        return String(payload.data.message)
      }
    }
  }

  const text = await response.text().catch(() => '')
  return text || `请求失败：${response.status}`
}

function resolveDownloadFilename(contentDisposition, fallbackName) {
  if (!contentDisposition) {
    return fallbackName
  }

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*("?)([^";]+)\1/i)

  if (filenameMatch?.[2]) {
    return filenameMatch[2].trim()
  }

  return fallbackName
}

function triggerBrowserDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

function createAuthorizedEventStream(requestUrl) {
  const controller = new AbortController()
  const listeners = new Map()
  let isClosed = false

  const source = {
    onopen: null,
    onerror: null,
    addEventListener(type, listener) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set())
      }

      listeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    close() {
      isClosed = true
      controller.abort()
    }
  }

  function dispatchEvent(type, data) {
    const event = {
      type,
      data,
      target: source,
      currentTarget: source
    }

    listeners.get(type)?.forEach((listener) => {
      listener(event)
    })
  }

  function dispatchError(error) {
    if (!isClosed && typeof source.onerror === 'function') {
      source.onerror(error)
    }
  }

  async function connect() {
    try {
      const response = await fetch(requestUrl, createAuthorizedRequestOptions({
        method: 'GET',
        headers: {
          Accept: 'text/event-stream'
        },
        signal: controller.signal
      }))

      if (!response.ok) {
        if (response.status === 401) {
          notifyAuthSessionExpired()
        }

        throw new Error(await readDownloadErrorMessage(response))
      }

      if (!response.body) {
        throw new Error('实时订阅连接不可用。')
      }

      if (typeof source.onopen === 'function') {
        source.onopen({ type: 'open', target: source, currentTarget: source })
      }

      await readEventStream(response.body, dispatchEvent, () => isClosed)

      if (!isClosed) {
        dispatchError(new Error('实时订阅连接已关闭。'))
      }
    } catch (error) {
      if (error?.name === 'AbortError' || isClosed) {
        return
      }

      dispatchError(error)
    }
  }

  void connect()

  return source
}

async function readEventStream(body, dispatchEvent, isClosed) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!isClosed()) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    buffer = flushEventStreamBuffer(buffer, dispatchEvent)
  }

  buffer += decoder.decode()

  if (buffer.trim()) {
    emitEventStreamBlock(buffer, dispatchEvent)
  }
}

function flushEventStreamBuffer(buffer, dispatchEvent) {
  let nextBuffer = buffer
  let separatorIndex = findEventSeparatorIndex(nextBuffer)

  while (separatorIndex >= 0) {
    const block = nextBuffer.slice(0, separatorIndex)
    nextBuffer = nextBuffer.slice(separatorIndex + resolveSeparatorLength(nextBuffer, separatorIndex))
    emitEventStreamBlock(block, dispatchEvent)
    separatorIndex = findEventSeparatorIndex(nextBuffer)
  }

  return nextBuffer
}

function findEventSeparatorIndex(buffer) {
  const normalizedSeparatorIndex = buffer.indexOf('\n\n')

  if (normalizedSeparatorIndex >= 0) {
    return normalizedSeparatorIndex
  }

  return buffer.indexOf('\r\n\r\n')
}

function resolveSeparatorLength(buffer, index) {
  return buffer.slice(index, index + 4) === '\r\n\r\n' ? 4 : 2
}

function emitEventStreamBlock(block, dispatchEvent) {
  const event = parseEventStreamBlock(block)

  if (!event.data) {
    return
  }

  dispatchEvent(event.type || 'message', event.data)
}

function parseEventStreamBlock(block) {
  return block.split(/\r?\n/).reduce((event, line) => {
    if (!line || line.startsWith(':')) {
      return event
    }

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line
    const rawValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : ''
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue

    if (field === 'event') {
      event.type = value
    }

    if (field === 'data') {
      event.data = event.data ? `${event.data}\n${value}` : value
    }

    return event
  }, { type: 'message', data: '' })
}
