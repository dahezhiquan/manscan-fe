import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { downloadVulnerabilityExport } = await server.ssrLoadModule('/src/api/vulnerabilities.js')
after(() => server.close())

test('export sends the active filters without pagination and downloads the XLSX', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const calls = []
  const link = { style: {}, click() { calls.push(['click', this.download]) }, remove() { calls.push(['remove']) } }

  try {
    globalThis.window = {
      localStorage: { getItem: (key) => key === 'manscan-auth-access-token' ? 'test-token' : null },
      sessionStorage: { getItem: () => null },
      setTimeout: (callback) => callback()
    }
    globalThis.document = {
      createElement: () => link,
      body: { appendChild: () => calls.push(['append']) }
    }
    URL.createObjectURL = () => 'blob:export-test'
    URL.revokeObjectURL = (url) => calls.push(['revoke', url])
    globalThis.fetch = async (url, options) => {
      calls.push(['request', url, options])
      return new Response(new Blob(['xlsx']), {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': 'attachment; filename="vulnerabilities-20261103-194500.xlsx"'
        }
      })
    }

    const controller = new AbortController()
    await downloadVulnerabilityExport({
      page: 3,
      page_size: 10,
      keyword: 'header',
      asset_host: '192.0.2.10',
      status: ['unreviewed', 'confirmed'],
      tags: ['cve', 'kev'],
      severity: ['critical', 'high'],
      latest_scan_task_name: 'nightly',
      protocol: ['http']
    }, controller.signal)

    const [, requestUrl, options] = calls[0]
    const parsed = new URL(requestUrl, 'http://localhost')
    assert.equal(parsed.pathname, '/api/v1/vulnerabilities/export')
    assert.equal(parsed.searchParams.has('page'), false)
    assert.equal(parsed.searchParams.has('page_size'), false)
    assert.equal(parsed.searchParams.get('keyword'), 'header')
    assert.equal(parsed.searchParams.get('asset_host'), '192.0.2.10')
    assert.deepEqual(parsed.searchParams.getAll('status'), ['unreviewed', 'confirmed'])
    assert.deepEqual(parsed.searchParams.getAll('tags'), ['cve', 'kev'])
    assert.deepEqual(parsed.searchParams.getAll('severity'), ['critical', 'high'])
    assert.equal(parsed.searchParams.get('latest_scan_task_name'), 'nightly')
    assert.deepEqual(parsed.searchParams.getAll('protocol'), ['http'])
    assert.equal(options.signal, controller.signal)
    assert.equal(options.headers.get('Authorization'), 'Bearer test-token')
    assert.deepEqual(calls.slice(1), [
      ['append'],
      ['click', 'vulnerabilities-20261103-194500.xlsx'],
      ['remove'],
      ['revoke', 'blob:export-test']
    ])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})

test('export surfaces JSON errors without creating a download', async () => {
  const originalFetch = globalThis.fetch
  const originalCreateObjectURL = URL.createObjectURL

  try {
    URL.createObjectURL = () => { throw new Error('must not create a download') }
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 50001, message: '生成 XLSX 失败', data: null }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })

    await assert.rejects(downloadVulnerabilityExport(), (error) => {
      assert.equal(error.message, '生成 XLSX 失败')
      assert.equal(error.code, 50001)
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  }
})
