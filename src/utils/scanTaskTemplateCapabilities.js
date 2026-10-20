export const SCREENSHOT_TEMPLATE_ID = 'screenshot'

export function isScreenshotTemplate(templateId) {
  return String(templateId ?? '').trim().toLowerCase() === SCREENSHOT_TEMPLATE_ID
}

export function isHeadlessTemplate(template) {
  const rawProtocols = template?.protocols ?? template?.protocol
  const protocols = Array.isArray(rawProtocols)
    ? rawProtocols
    : String(rawProtocols ?? '').split(',')

  return protocols
    .some((protocol) => String(protocol).trim().toLowerCase() === 'headless')
}

export function isTemplateAllowedForMainScan(template, disableHeadlessTemplates) {
  if (isScreenshotTemplate(template?.id)) {
    return false
  }

  return !disableHeadlessTemplates || !isHeadlessTemplate(template)
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
