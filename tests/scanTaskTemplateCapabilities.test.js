import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isHeadlessTemplate,
  isScanTemplateSelectionValid,
  isTemplateAllowedForMainScan,
  migrateLegacyScreenshotSelection
} from '../src/utils/scanTaskTemplateCapabilities.js'
import {
  consumeScanTaskRecreateDraft,
  saveScanTaskRecreateDraft
} from '../src/utils/scanTaskRecreateDraft.js'

test('legacy screenshot template selection migrates to the standalone capture capability', () => {
  assert.deepEqual(
    migrateLegacyScreenshotSelection(['screenshot', 'http-check', 'screenshot']),
    { screenshotCapture: true, templateIds: ['http-check'] }
  )
  assert.deepEqual(
    migrateLegacyScreenshotSelection(['http-check'], true),
    { screenshotCapture: true, templateIds: ['http-check'] }
  )
})

test('main scan selection always excludes screenshot and optionally excludes headless templates', () => {
  const screenshot = { id: 'screenshot', protocols: ['headless'] }
  const headlessVulnerability = { id: 'headless-xss', protocols: ['http', 'headless'] }
  const httpTemplate = { id: 'http-check', protocols: ['http'] }

  assert.equal(isHeadlessTemplate(headlessVulnerability), true)
  assert.equal(isTemplateAllowedForMainScan(screenshot, true), false)
  assert.equal(isTemplateAllowedForMainScan(screenshot, false), false)
  assert.equal(isTemplateAllowedForMainScan(headlessVulnerability, true), false)
  assert.equal(isTemplateAllowedForMainScan(httpTemplate, true), true)
  assert.equal(isTemplateAllowedForMainScan(headlessVulnerability, false), true)
})

test('headless protocol detection tolerates string values and casing differences', () => {
  assert.equal(isHeadlessTemplate({ protocol: 'HTTP, HEADLESS' }), true)
  assert.equal(isHeadlessTemplate({ protocols: ['HeadLess'] }), true)
  assert.equal(isHeadlessTemplate({ protocols: 'http' }), false)
  assert.equal(isHeadlessTemplate(null), false)
})

test('standalone screenshot capture satisfies the template selection requirement', () => {
  assert.equal(isScanTemplateSelectionValid(), false)
  assert.equal(isScanTemplateSelectionValid({ screenshotCapture: true }), true)
  assert.equal(isScanTemplateSelectionValid({ templateIds: ['http-check'] }), true)
  assert.equal(isScanTemplateSelectionValid({ automaticScan: true }), true)
  assert.equal(isScanTemplateSelectionValid({ allFilteredTemplatesSelected: true }), true)
})

test('recreate draft preserves standalone screenshot capability fields', () => {
  saveScanTaskRecreateDraft({
    targets: ['https://example.com'],
    screenshot_capture: true,
    disable_headless_templates: false
  })

  assert.deepEqual(consumeScanTaskRecreateDraft()?.form, {
    targets: ['https://example.com'],
    screenshot_capture: true,
    disable_headless_templates: false
  })
})
