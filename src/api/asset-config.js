import {
  ASSET_CONFIG_CENTER_API,
  ASSET_CONFIG_CENTER_LIST_API,
  ASSET_CONFIG_CENTER_SMALL_CATEGORY_OPTIONS_API
} from '../constants/api'
import { requestJson } from '../utils/http'
import { appendMultiValueParam } from '../utils/template'

function buildAssetConfigCenterUrl(path = '') {
  return new URL(`${ASSET_CONFIG_CENTER_API}${path}`, window.location.origin)
}

function appendTextParam(searchParams, key, value) {
  if (Array.isArray(value)) {
    appendMultiValueParam(searchParams, key, value)
    return
  }

  const nextValue = String(value ?? '').trim()
  if (nextValue) {
    searchParams.set(key, nextValue)
  }
}

export function buildAssetConfigCenterListUrl(filters = {}) {
  const url = new URL(ASSET_CONFIG_CENTER_LIST_API, window.location.origin)
  const page = Number.parseInt(filters.page, 10)
  const pageSize = Number.parseInt(filters.pageSize, 10)

  url.searchParams.set('page', String(Number.isInteger(page) && page > 0 ? page : 1))
  url.searchParams.set('page_size', String(Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10))

  appendTextParam(url.searchParams, 'item_name', filters.itemName)
  appendTextParam(url.searchParams, 'big_category', filters.bigCategory)
  appendTextParam(url.searchParams, 'small_category', filters.smallCategory)
  appendTextParam(url.searchParams, 'status', filters.status)

  return url
}

export function buildAssetConfigCenterSmallCategoryOptionsUrl(filters = {}) {
  const url = new URL(ASSET_CONFIG_CENTER_SMALL_CATEGORY_OPTIONS_API, window.location.origin)

  appendTextParam(url.searchParams, 'big_category', filters.bigCategory)

  return url
}

export async function getAssetConfigCenterList(filters = {}, signal) {
  return requestJson(buildAssetConfigCenterListUrl(filters).toString(), {
    method: 'GET',
    signal
  })
}

export async function getAssetConfigCenterSmallCategoryOptions(filters = {}, signal) {
  return requestJson(buildAssetConfigCenterSmallCategoryOptionsUrl(filters).toString(), {
    method: 'GET',
    signal
  })
}

export async function createAssetConfigCenter(payload, signal) {
  return requestJson(buildAssetConfigCenterUrl().toString(), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}

export async function updateAssetConfigCenter(id, payload, signal) {
  return requestJson(buildAssetConfigCenterUrl(`/${encodeURIComponent(id)}`).toString(), {
    method: 'PUT',
    signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}

export async function deleteAssetConfigCenter(id, signal) {
  return requestJson(buildAssetConfigCenterUrl(`/${encodeURIComponent(id)}`).toString(), {
    method: 'DELETE',
    signal
  })
}
