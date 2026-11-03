import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const domainApi = await server.ssrLoadModule('/src/api/domain-assets.js')
const hostApi = await server.ssrLoadModule('/src/api/host-assets.js')
after(() => server.close())

test('domain and host exports preserve list filters, omit pagination, and download XLSX', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  const requests = []
  const filenames = []
  const link = { style: {}, click() { filenames.push(this.download) }, remove() {} }

  try {
    globalThis.window = {
      localStorage: { getItem: (key) => key === 'manscan-auth-access-token' ? 'test-token' : null },
      sessionStorage: { getItem: () => null },
      setTimeout: (callback) => callback()
    }
    globalThis.document = { createElement: () => link, body: { appendChild() {} } }
    URL.createObjectURL = () => 'blob:asset-export-test'
    URL.revokeObjectURL = () => {}
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options })
      return new Response(new Blob(['xlsx']), {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="${url.includes('domain-assets') ? 'domain-assets' : 'host-assets'}-20261103-194500.xlsx"`
        }
      })
    }

    const domainParams = {
      page: 3, page_size: 20, keyword: 'example', title: 'Portal', region: 'internal',
      risk_level: 'critical,high', has_vulnerability: false, has_component: true
    }
    const hostParams = {
      page: 2, page_size: 50, keyword: '192.0.2', os_type: 'linux', region: 'prod',
      risk_level: 'high'
    }
    const controller = new AbortController()
    await domainApi.getDomainAssetList(domainParams, controller.signal)
    await domainApi.downloadDomainAssetExport(domainParams, controller.signal)
    await hostApi.getHostAssetList(hostParams, controller.signal)
    await hostApi.downloadHostAssetExport(hostParams, controller.signal)

    for (const [listIndex, exportIndex, path] of [
      [0, 1, '/api/v1/domain-assets/export'],
      [2, 3, '/api/v1/host-assets/export']
    ]) {
      const list = new URL(requests[listIndex].url, 'http://localhost')
      const exported = new URL(requests[exportIndex].url, 'http://localhost')
      const listFilters = new URLSearchParams(list.search)
      listFilters.delete('page')
      listFilters.delete('page_size')
      assert.equal(exported.pathname, path)
      assert.equal(exported.search, `?${listFilters.toString()}`)
      assert.equal(requests[exportIndex].options.signal, controller.signal)
      assert.equal(requests[exportIndex].options.headers.get('Authorization'), 'Bearer test-token')
    }
    assert.deepEqual(filenames, [
      'domain-assets-20261103-194500.xlsx',
      'host-assets-20261103-194500.xlsx'
    ])
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})

test('asset export surfaces JSON errors without starting a download', async () => {
  const originalFetch = globalThis.fetch
  const originalCreateObjectURL = URL.createObjectURL

  try {
    URL.createObjectURL = () => { throw new Error('must not create a download') }
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 50001, message: '生成 XLSX 失败', data: null }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })
    for (const download of [domainApi.downloadDomainAssetExport, hostApi.downloadHostAssetExport]) {
      await assert.rejects(download(), (error) => {
        assert.equal(error.message, '生成 XLSX 失败')
        assert.equal(error.code, 50001)
        return true
      })
    }
  } finally {
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  }
})
