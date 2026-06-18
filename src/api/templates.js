import {
  TEMPLATE_DETAIL_API,
  TEMPLATE_LIST_API,
  TEMPLATE_MULTI_VALUE_QUERY_MODE,
  TEMPLATE_PROTOCOLS_API,
  TEMPLATE_STATS_API,
  TEMPLATE_TAGS_API
} from '../constants/api'
import { requestJson } from '../utils/http'
import { appendMultiValueParam } from '../utils/template'

export async function getTemplateStats(signal) {
  return requestJson(TEMPLATE_STATS_API, {
    method: 'GET',
    signal
  })
}

export function buildTemplateListUrl({
  page = 1,
  pageSize,
  keyword = '',
  tags = [],
  severity = [],
  protocol = [],
  kev = '',
  cve = ''
}) {
  const url = new URL(TEMPLATE_LIST_API, window.location.origin)

  url.searchParams.set('page', String(page))

  if (pageSize) {
    url.searchParams.set('pageSize', String(pageSize))
  }

  if (keyword.trim()) {
    url.searchParams.set('name', keyword.trim())
  }

  appendMultiValueParam(url.searchParams, 'tag', tags, TEMPLATE_MULTI_VALUE_QUERY_MODE)
  appendMultiValueParam(url.searchParams, 'severity', severity, TEMPLATE_MULTI_VALUE_QUERY_MODE)
  appendMultiValueParam(url.searchParams, 'protocol', protocol, TEMPLATE_MULTI_VALUE_QUERY_MODE)

  if (kev) {
    url.searchParams.set('iskev', kev)
  }

  if (cve) {
    url.searchParams.set('iscve', cve)
  }

  return url
}

export async function getTemplateList(filters, signal) {
  return requestJson(buildTemplateListUrl(filters).toString(), {
    method: 'GET',
    signal
  })
}

export async function getTemplateTags(signal) {
  return requestJson(TEMPLATE_TAGS_API, {
    method: 'GET',
    signal
  })
}

export async function getTemplateProtocols(signal) {
  return requestJson(TEMPLATE_PROTOCOLS_API, {
    method: 'GET',
    signal
  })
}

export async function getTemplateDetail(templateId, signal) {
  return requestJson(`${TEMPLATE_DETAIL_API}/${encodeURIComponent(templateId)}`, {
    method: 'GET',
    signal
  })
}
