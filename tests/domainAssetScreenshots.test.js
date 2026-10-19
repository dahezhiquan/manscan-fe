import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const utils = await server.ssrLoadModule('/src/utils/domainAsset.js')
const api = await server.ssrLoadModule('/src/api/domain-assets.js')
after(() => server.close())

const screenshotFixture = (overrides = {}) => ({
  domain: 'https://example.test:8443',
  captured_date: '2026-10-15',
  file_name: 'https:__example.test:8443_20261015.png',
  content_type: 'image/png',
  image_base64: 'aW1hZ2U=',
  ...overrides
})

test('screenshot normalization builds an image-only data URL and keeps metadata as text', () => {
  const screenshot = utils.normalizeDomainAssetScreenshot(screenshotFixture({
    file_name: '<img src=x onerror=alert(1)>.png'
  }))

  assert.equal(screenshot.imageUrl, 'data:image/png;base64,aW1hZ2U=')
  assert.equal(screenshot.capturedDateDisplay, '2026-10-15')
  assert.equal(screenshot.fileName, '<img src=x onerror=alert(1)>.png')
})

test('screenshot normalization rejects executable MIME types and malformed base64', () => {
  assert.throws(
    () => utils.normalizeDomainAssetScreenshot(screenshotFixture({
      content_type: 'image/svg+xml',
      image_base64: 'PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+'
    })),
    /截图图片类型无效/
  )
  assert.throws(
    () => utils.normalizeDomainAssetScreenshot(screenshotFixture({ image_base64: 'not base64!' })),
    /截图图片数据无效/
  )
})

test('screenshot page normalizes camel and snake pagination without changing item order', () => {
  const result = utils.normalizeDomainAssetScreenshotPage({
    page: 2,
    page_size: 4,
    total: 6,
    total_pages: 2,
    items: [
      screenshotFixture({ captured_date: '2026-10-14', file_name: 'second.png' }),
      screenshotFixture({ captured_date: '2026-10-13', file_name: 'first.png' })
    ]
  })

  assert.equal(result.page, 2)
  assert.equal(result.pageSize, 4)
  assert.equal(result.totalPages, 2)
  assert.deepEqual(result.items.map((item) => item.fileName), ['second.png', 'first.png'])
})

test('screenshot lookup adds protocol candidates for canonical scheme-less assets', () => {
  assert.deepEqual(
    utils.buildDomainAssetScreenshotLookupCandidates('10.107.71.65:8889'),
    [
      'http://10.107.71.65:8889',
      'https://10.107.71.65:8889',
      '10.107.71.65:8889'
    ]
  )
  assert.deepEqual(
    utils.buildDomainAssetScreenshotLookupCandidates('ai-force.duxiaoman-int.com:443'),
    [
      'https://ai-force.duxiaoman-int.com',
      'https://ai-force.duxiaoman-int.com:443',
      'http://ai-force.duxiaoman-int.com:443',
      'ai-force.duxiaoman-int.com:443'
    ]
  )
  assert.deepEqual(
    utils.buildDomainAssetScreenshotLookupCandidates('example.test:80'),
    [
      'http://example.test',
      'http://example.test:80',
      'https://example.test:80',
      'example.test:80'
    ]
  )
  assert.deepEqual(
    utils.buildDomainAssetScreenshotLookupCandidates('https://example.test:443/'),
    ['https://example.test']
  )
})

test('screenshot APIs encode the full domain, forward pagination and include authorization', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const controller = new AbortController()
  const calls = []

  try {
    globalThis.window = {
      localStorage: {
        getItem: (key) => key === 'manscan-auth-access-token' ? 'unit-test-token' : null
      }
    }
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: calls.length === 1
            ? screenshotFixture()
            : { page: 2, pageSize: 4, total: 6, totalPages: 2, items: [] }
        })
      }
    }

    const domain = 'https://example.test:8443/path?a=1&b=2'
    await api.getLatestDomainAssetScreenshot(domain, controller.signal)
    await api.getDomainAssetScreenshots(domain, { page: 2, pageSize: 4 }, controller.signal)

    const latestUrl = new URL(calls[0].url, 'http://localhost')
    const historyUrl = new URL(calls[1].url, 'http://localhost')
    assert.equal(latestUrl.pathname, '/api/v1/domain-assets/screenshots/latest')
    assert.equal(latestUrl.searchParams.get('domain'), domain)
    assert.equal(historyUrl.pathname, '/api/v1/domain-assets/screenshots')
    assert.equal(historyUrl.searchParams.get('domain'), domain)
    assert.equal(historyUrl.searchParams.get('page'), '2')
    assert.equal(historyUrl.searchParams.get('page_size'), '4')

    for (const { options } of calls) {
      assert.equal(options.method, 'GET')
      assert.equal(options.signal, controller.signal)
      assert.equal(options.headers.get('Authorization'), 'Bearer unit-test-token')
    }
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
