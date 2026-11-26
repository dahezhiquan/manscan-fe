import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { normalizeNotification, normalizeNotificationStyles, validateNotificationForm } from '../src/utils/notificationManagement.js'

const styles = [{ id: 'orange', name: '橙色' }, { id: 'future-style', name: '后端新增样式' }]
const form = (overrides = {}) => ({ name: '扫描通知', description: '', enabled: false, event: 'scan_started', style: 'orange', webhook: '', ...overrides })
const webhook = 'https://open.feishu.cn/open-apis/bot/v2/hook/00000000-0000-0000-0000-000000000000'

test('style options follow server order, accept new IDs and discard invalid or duplicate entries', () => {
  assert.deepEqual(normalizeNotificationStyles({ items: [...styles, null, {}, { id: 'orange', name: '重复' }, { id: ' ', name: '空值' }] }), styles)
  assert.throws(() => normalizeNotificationStyles(null), /格式异常/)
  assert.deepEqual(normalizeNotificationStyles({ items: [] }), [])
  assert.equal(validateNotificationForm(form({ style: 'future-style' }), styles), '')
  assert.match(validateNotificationForm(form({ style: 'unavailable' }), styles), /样式/)
  assert.match(validateNotificationForm(form(), []), /样式/)
})

test('edit validation handles empty names, Unicode limits, cleared descriptions and replacement webhooks', () => {
  assert.equal(validateNotificationForm(form({ name: ' 名称 ', description: ' ', webhook: ' ' }), styles), '')
  assert.match(validateNotificationForm(form({ name: ' ' }), styles), /名称/)
  assert.match(validateNotificationForm(form({ name: '名'.repeat(101) }), styles), /名称/)
  assert.equal(validateNotificationForm(form({ description: '🐱'.repeat(500) }), styles), '')
  assert.match(validateNotificationForm(form({ description: '🐱'.repeat(501) }), styles), /描述/)
  assert.equal(validateNotificationForm(form({ webhook }), styles), '')
  for (const value of [webhook.replace('https:', 'http:'), webhook.replace('open.feishu.cn', 'example.com'), webhook + '?a=1', webhook.replace('00000000-0000-0000-0000-000000000000', '********')]) {
    assert.match(validateNotificationForm(form({ webhook: value }), styles), /Webhook/)
  }
  assert.equal('webhook' in normalizeNotification({ id: 1, webhook }), false)
})

const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
const api = await server.ssrLoadModule('/src/api/settings.js')
after(() => server.close())

test('notification APIs preserve enabled=false, event, style and cleared description; only send replacement webhooks', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const requests = []
  globalThis.window = { localStorage: { getItem: (key) => key === 'manscan-auth-access-token' ? 'test-only-token' : '' } }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return { ok: true, json: async () => ({ code: 0, data: { id: 1 } }) }
  }
  try {
    const signal = new AbortController().signal
    await api.getNotificationStyles(signal)
    await api.updateNotification(1, form(), signal)
    await api.updateNotification(1, form({ webhook: ` ${webhook} ` }), signal)
    await api.updateNotification(1, form({ webhook: '   ' }), signal)
    assert.deepEqual(requests.map(({ url, options }) => [options.method, url]), [
      ['GET', '/api/v1/notifications/styles'],
      ['PUT', '/api/v1/notifications/1'],
      ['PUT', '/api/v1/notifications/1'],
      ['PUT', '/api/v1/notifications/1']
    ])
    const { webhook: ignored, ...expected } = form()
    assert.deepEqual(JSON.parse(requests[1].options.body), expected)
    assert.equal(JSON.parse(requests[2].options.body).webhook, webhook)
    assert.equal('webhook' in JSON.parse(requests[3].options.body), false)
    for (const { options } of requests) {
      assert.equal(options.signal, signal)
      assert.equal(options.headers.get('Authorization'), 'Bearer test-only-token')
    }
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ code: 40001, message: '参数错误', data: null }) })
    await assert.rejects(api.updateNotification(1, form()), { code: 40001, message: '参数错误' })
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})
