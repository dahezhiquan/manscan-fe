import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { buildApiKeyPayload, normalizeApiKey, normalizeApiKeyPage, validateApiKeyForm } from '../src/utils/thirdPartyApiKeys.js'

const form = (overrides = {}) => ({ platformUrl: 'https://api.example.com', key: 'test-provider-key', rateLimit: '0', description: '测试', ...overrides })
const record = (overrides = {}) => ({ id: 1, platform_url: 'https://api.example.com', rate_limit_per_minute: 60, key_configured: true, ...overrides })
const page = (overrides = {}) => ({ items: [record()], page: 1, page_size: 10, total: 1, total_pages: 1, ...overrides })

test('create requires a key; edits omit empty key and preserve replacement key bytes', () => {
  assert.match(validateApiKeyForm(form({ key: '' }), true), /API Key/)
  assert.equal(validateApiKeyForm(form({ key: '' }), false), '')
  assert.equal('key' in buildApiKeyPayload(form({ key: '' }), false), false)
  const payload = buildApiKeyPayload(form({ platformUrl: ' https://api.example.com ', key: ' new-key ', rateLimit: '60', description: ' 用途 ' }), false)
  assert.deepEqual(payload, { platform_url: 'https://api.example.com', rate_limit_per_minute: 60, description: '用途', key: ' new-key ' })
})

test('UTF-8 byte limits include multibyte keys, descriptions and URLs', () => {
  assert.equal(validateApiKeyForm(form({ key: '密'.repeat(170) + 'ab' }), true), '')
  assert.match(validateApiKeyForm(form({ key: '密'.repeat(171) }), true), /512 字节/)
  assert.match(validateApiKeyForm(form({ description: '描'.repeat(171) }), true), /512 字节/)
  assert.match(validateApiKeyForm(form({ platformUrl: 'https://example.com/' + '径'.repeat(700) }), true), /2048 字节/)
})

test('key controls, invalid URL schemes, credentials and fragments are rejected', () => {
  for (const key of ['  ', 'key\u0000', 'key\u007f', 'key\u0085']) assert.notEqual(validateApiKeyForm(form({ key }), false), '')
  for (const platformUrl of ['javascript:alert(1)', 'ftp://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com/#fragment', 'https://api.example.com/#', 'https://api.example.com/with space', 'http:api.example.com']) {
    assert.notEqual(validateApiKeyForm(form({ platformUrl }), true), '', platformUrl)
  }
})

test('rate limit allows uint32 boundaries and rejects fractions, empty and negative values', () => {
  for (const rateLimit of ['0', 0, '4294967295']) assert.equal(validateApiKeyForm(form({ rateLimit }), true), '')
  for (const rateLimit of ['', -1, '1.5', '4294967296', '1e2']) assert.match(validateApiKeyForm(form({ rateLimit }), true), /限流/)
})

test('response normalization never carries returned secrets and rejects invalid IDs and pages', () => {
  const item = normalizeApiKey(record({ key: 'should-not-be-copied', encrypted_key: 'should-not-be-copied', description: null }))
  assert.equal('key' in item, false)
  assert.equal('encrypted_key' in item, false)
  assert.equal(item.description, '')
  for (const id of [0, -1, null, '1', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => normalizeApiKey(record({ id })))
  for (const value of [null, page({ items: null }), page({ page_size: 0 }), page({ total: -1 })]) assert.throws(() => normalizeApiKeyPage(value))
  assert.equal(normalizeApiKeyPage(page({ items: [], total: 0, total_pages: 0 })).totalPages, 1)
})

test('page normalization accepts the backend camelCase pagination fields', () => {
  const normalized = normalizeApiKeyPage({ page: 1, pageSize: 10, total: 0, totalPages: 0, items: [] })
  assert.deepEqual(normalized, { page: 1, pageSize: 10, total: 0, totalPages: 1, items: [] })
})

test('API Key management does not render a false zero before the first list response', async () => {
  const component = await readFile(new URL('../src/components/settings/ThirdPartyApiKeyManagement.vue', import.meta.url), 'utf8')
  assert.match(component, /configuredServiceCount = computed\(\(\) => listState\.loaded \? listState\.total : '—'\)/)
  assert.match(component, /Object\.assign\(listState, normalizeApiKeyPage\(data\), \{ loaded: true \}\)/)
  assert.doesNotMatch(component, /已配置 \{\{ listState\.total \}\} 个第三方服务/)
})

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/thirdPartyApiKeys.js')
after(() => server.close())

test('all six APIs use the documented method, path, JSON payload, auth and cancellation signal', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const requests = []
  globalThis.window = { localStorage: { getItem: (key) => key === 'manscan-auth-access-token' ? 'test-only-token' : '' } }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return { ok: true, json: async () => ({ code: 0, data: String(url).endsWith('/plaintext') ? { key: 'test-provider-key' } : { id: 1 } }) }
  }
  try {
    const signal = new AbortController().signal
    const payload = buildApiKeyPayload(form(), true)
    await api.getThirdPartyApiKeyList({ page: 2, pageSize: 10 }, signal)
    await api.getThirdPartyApiKey(1, signal)
    assert.equal(await api.getThirdPartyApiKeyPlaintext(1, signal), 'test-provider-key')
    await api.createThirdPartyApiKey(payload, signal)
    await api.updateThirdPartyApiKey(1, buildApiKeyPayload(form({ key: '' }), false), signal)
    await api.deleteThirdPartyApiKey(1, signal)
    assert.deepEqual(requests.map(({ url, options }) => [options.method, url]), [
      ['GET', '/api/v1/third-party-api-keys?page=2&page_size=10'],
      ['GET', '/api/v1/third-party-api-keys/1'],
      ['GET', '/api/v1/third-party-api-keys/1/plaintext'],
      ['POST', '/api/v1/third-party-api-keys'],
      ['PUT', '/api/v1/third-party-api-keys/1'],
      ['DELETE', '/api/v1/third-party-api-keys/1']
    ])
    for (const { options } of requests) {
      assert.equal(options.signal, signal)
      assert.equal(options.headers.get('Authorization'), 'Bearer test-only-token')
    }
    assert.equal(requests[2].options.cache, 'no-store')
    assert.deepEqual(JSON.parse(requests[3].options.body), payload)
    assert.equal('key' in JSON.parse(requests[4].options.body), false)
    assert.equal(requests[3].options.headers.get('Content-Type'), 'application/json')
    globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ code: 40301, message: '无权限', data: null }) })
    await assert.rejects(api.getThirdPartyApiKeyList(), { code: 40301, status: 403 })
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ code: 40401, message: '密钥不存在', data: null }) })
    await assert.rejects(api.getThirdPartyApiKeyPlaintext(1), { code: 40401, status: 404 })
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
