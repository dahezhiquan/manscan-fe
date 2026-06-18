export function normalizeTemplateListPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  return []
}

export function appendMultiValueParam(searchParams, key, values, mode = 'repeat') {
  if (!Array.isArray(values) || values.length === 0) {
    return
  }

  if (mode === 'comma') {
    searchParams.set(key, values.join(','))
    return
  }

  values.forEach((value) => {
    searchParams.append(key, value)
  })
}

export function readMultiValueParam(searchParams, key) {
  return [
    ...new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ]
}

export function mapSeverityTone(severity) {
  const normalized = String(severity ?? '').trim().toLowerCase()

  switch (normalized) {
    case 'critical':
    case '严重':
      return 'critical'
    case 'high':
    case '高危':
      return 'high'
    case 'medium':
    case '中危':
      return 'medium'
    case 'low':
    case '低危':
      return 'low'
    case 'info':
    case '信息':
      return 'info'
    case '未知':
    case '未定义':
    default:
      return normalized ? 'unknown' : 'unknown'
  }
}

export function normalizeTagOptions(payload) {
  const uniqueValues = new Map()

  normalizeTemplateListPayload(payload).forEach((item) => {
    if (typeof item === 'string') {
      const value = item.trim()
      if (value) {
        uniqueValues.set(value, { value, label: value, count: '' })
      }
      return
    }

    const value = String(item?.value ?? item?.tag ?? item?.name ?? item?.label ?? '').trim()
    if (!value) {
      return
    }

    uniqueValues.set(value, {
      value,
      label: String(item?.label ?? item?.tag ?? item?.name ?? value).trim(),
      count: item?.count ? String(item.count) : ''
    })
  })

  return [...uniqueValues.values()]
}

export function normalizeProtocolOptions(payload) {
  const uniqueValues = new Map()

  normalizeTemplateListPayload(payload).forEach((item) => {
    if (typeof item === 'string') {
      const value = item.trim().toLowerCase()
      if (value) {
        uniqueValues.set(value, { value, label: toTitleCase(value), count: '' })
      }
      return
    }

    const value = String(item?.value ?? item?.protocol ?? item?.name ?? item?.label ?? '')
      .trim()
      .toLowerCase()

    if (!value) {
      return
    }

    uniqueValues.set(value, {
      value,
      label: String(item?.label ?? item?.protocol ?? item?.name ?? toTitleCase(value)).trim(),
      count: item?.count ? String(item.count) : ''
    })
  })

  return [...uniqueValues.values()]
}

export function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export function toTitleCase(value) {
  return String(value ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(' ')
}
