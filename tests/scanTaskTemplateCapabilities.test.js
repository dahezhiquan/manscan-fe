import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isScanTemplateSelectionValid,
  migrateLegacyScreenshotSelection,
  resolveAllTemplateSelectionSubmission
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

test('standalone screenshot capture satisfies the template selection requirement', () => {
  assert.equal(isScanTemplateSelectionValid(), false)
  assert.equal(isScanTemplateSelectionValid({ screenshotCapture: true }), true)
  assert.equal(isScanTemplateSelectionValid({ templateIds: ['http-check'] }), true)
  assert.equal(isScanTemplateSelectionValid({ automaticScan: true }), true)
  assert.equal(isScanTemplateSelectionValid({ allFilteredTemplatesSelected: true }), true)
})

test('all-template selection only materializes IDs when required to preserve its scope', () => {
  assert.deepEqual(
    resolveAllTemplateSelectionSubmission({
      tags: ['cve'],
      severities: ['high'],
      protocols: ['http']
    }),
    {
      requiresTemplateIds: false,
      tags: ['cve'],
      severities: ['high'],
      protocols: ['http']
    }
  )
  assert.deepEqual(
    resolveAllTemplateSelectionSubmission({
      keyword: 'spring',
      tags: ['cve'],
      severities: ['high'],
      protocols: ['http']
    }),
    {
      requiresTemplateIds: true,
      tags: [],
      severities: [],
      protocols: []
    }
  )
  assert.equal(
    resolveAllTemplateSelectionSubmission({ screenshotCapture: true }).requiresTemplateIds,
    true
  )
  assert.equal(
    resolveAllTemplateSelectionSubmission({
      severities: ['high'],
      screenshotCapture: true
    }).requiresTemplateIds,
    false
  )
})

test('recreate draft preserves screenshot capability and drops the removed headless exclusion field', () => {
  saveScanTaskRecreateDraft({
    targets: ['https://example.com'],
    screenshot_capture: true
  })

  assert.deepEqual(consumeScanTaskRecreateDraft()?.form, {
    targets: ['https://example.com'],
    screenshot_capture: true
  })
})
