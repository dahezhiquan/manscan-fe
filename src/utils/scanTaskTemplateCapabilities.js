export const SCREENSHOT_TEMPLATE_ID = 'screenshot'

export function isScreenshotTemplate(templateId) {
  return String(templateId ?? '').trim().toLowerCase() === SCREENSHOT_TEMPLATE_ID
}

export function migrateLegacyScreenshotSelection(templateIds, screenshotCapture = false) {
  const normalizedIds = [...new Set(
    (Array.isArray(templateIds) ? templateIds : [])
      .map((templateId) => String(templateId ?? '').trim())
      .filter(Boolean)
  )]

  return {
    screenshotCapture: Boolean(screenshotCapture) || normalizedIds.some(isScreenshotTemplate),
    templateIds: normalizedIds.filter((templateId) => !isScreenshotTemplate(templateId))
  }
}

export function isScanTemplateSelectionValid({
  automaticScan = false,
  allFilteredTemplatesSelected = false,
  templateIds = [],
  screenshotCapture = false
} = {}) {
  return Boolean(
    automaticScan ||
    allFilteredTemplatesSelected ||
    screenshotCapture ||
    (Array.isArray(templateIds) && templateIds.length > 0)
  )
}

export function resolveAllTemplateSelectionSubmission({
  keyword = '',
  tags = [],
  severities = [],
  protocols = [],
  screenshotCapture = false
} = {}) {
  const hasKeyword = Boolean(String(keyword ?? '').trim())
  const hasStructuredFilters = tags.length > 0 || severities.length > 0 || protocols.length > 0
  const requiresTemplateIds = hasKeyword || (Boolean(screenshotCapture) && !hasStructuredFilters)

  return {
    requiresTemplateIds,
    tags: requiresTemplateIds ? [] : [...tags],
    severities: requiresTemplateIds ? [] : [...severities],
    protocols: requiresTemplateIds ? [] : [...protocols]
  }
}
