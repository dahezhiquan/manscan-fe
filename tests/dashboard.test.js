import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const utils = await server.ssrLoadModule('/src/utils/dashboard.js')
const api = await server.ssrLoadModule('/src/api/dashboard.js')
const { readEnumRouteFilter } = await server.ssrLoadModule('/src/utils/routeFilters.js')
const { VULNERABILITY_STATUS_OPTIONS, VULNERABILITY_SEVERITY_OPTIONS } = await server.ssrLoadModule('/src/constants/vulnerabilities.js')
const { DOMAIN_ASSET_RISK_OPTIONS } = await server.ssrLoadModule('/src/constants/domainAssets.js')
after(() => server.close())

test('dashboard entry filters keep status and severity separate, validate enums and deduplicate', () => {
  const search = '?status=unreviewed&severity=critical,high&severity=high&severity=invalid'
  assert.deepEqual(readEnumRouteFilter(search, 'status', VULNERABILITY_STATUS_OPTIONS), ['unreviewed'])
  assert.deepEqual(readEnumRouteFilter(search, 'severity', VULNERABILITY_SEVERITY_OPTIONS), ['critical', 'high'])
  assert.deepEqual(readEnumRouteFilter('?risk_level=critical&risk_level=high,invalid', 'risk_level', DOMAIN_ASSET_RISK_OPTIONS), ['critical', 'high'])
  assert.deepEqual(readEnumRouteFilter('?status=unknown&status=', 'status', VULNERABILITY_STATUS_OPTIONS), [])
  assert.deepEqual(readEnumRouteFilter('', 'risk_level', DOMAIN_ASSET_RISK_OPTIONS), [])
})

const overview = () => ({
  vulnerability_status: { total: 100, unreviewed: 40, confirmed: 20, ticketed: 10, fixed: 15, false_positive: 10, ignored: 5 },
  pending_vulnerabilities: { total: 40, critical: 5, high: 10, medium: 15, low: 8 },
  high_risk_open_ports: 12
})
const assetRisks = () => ({
  hosts: { critical: 3, high: 8, medium: 12, low: 5, no_risk: 20, unknown: 2 },
  domains: { critical: 1, high: 6, medium: 10, low: 4, no_risk: 15, unknown: 1 }
})

test('overview counts only unreviewed and derives unclassified severity remainder', () => {
  const result = utils.normalizeDashboardOverview(overview())
  assert.equal(result.pending.total, 40)
  assert.equal(result.pending.other, 2)
  assert.equal(result.statuses.total, 100)
  assert.equal(result.highRiskOpenPorts, 12)
  const data = overview()
  data.pending_vulnerabilities.total = '40'
  assert.equal(utils.normalizeDashboardOverview(data).pending.total, 40)
})

test('missing or invalid counts cannot masquerade as an empty database', () => {
  for (const value of [undefined, null, '', ' ', false, -1, 1.5, '12x', Infinity, {}, Number.MAX_SAFE_INTEGER + 1]) {
    const data = overview()
    data.high_risk_open_ports = value
    assert.throws(() => utils.normalizeDashboardOverview(data))
  }
  assert.throws(() => utils.normalizeDashboardOverview(null))
  const zero = overview()
  Object.values(zero).filter(value => typeof value === 'object').forEach(group => {
    Object.keys(group).forEach(key => { group[key] = 0 })
  })
  zero.high_risk_open_ports = 0
  assert.equal(utils.normalizeDashboardOverview(zero).pending.other, 0)
})

test('inconsistent severity and status aggregates reject the complete overview', () => {
  const mismatched = overview()
  mismatched.pending_vulnerabilities.total = 39
  assert.throws(() => utils.normalizeDashboardOverview(mismatched))
  const excessive = overview()
  excessive.pending_vulnerabilities.critical = 50
  assert.throws(() => utils.normalizeDashboardOverview(excessive))
  const badStatus = overview()
  badStatus.vulnerability_status.total = 90
  assert.throws(() => utils.normalizeDashboardOverview(badStatus))
})

test('asset totals include unknown risk separately from no risk', () => {
  const result = utils.normalizeDashboardAssetRisks(assetRisks())
  assert.equal(result.hosts.total, 50)
  assert.equal(result.domains.total, 37)
  assert.equal(result.hosts.counts.unknown, 2)
  assert.equal(result.hosts.counts.no_risk, 20)
  const incomplete = assetRisks()
  delete incomplete.domains.unknown
  assert.throws(() => utils.normalizeDashboardAssetRisks(incomplete))
})

test('derived percentages distinguish unavailable data from genuine zero', () => {
  assert.equal(utils.sumDashboardCounts([6, 4]), 10)
  assert.equal(utils.sumDashboardCounts([6, null]), null)
  assert.equal(utils.sumDashboardCounts([Number.MAX_SAFE_INTEGER, 1]), null)
  assert.equal(utils.dashboardPercentage(15, 20), 75)
  assert.equal(utils.dashboardPercentage(0, 0), 0)
  assert.equal(utils.dashboardPercentage(null, 20), null)
  assert.equal(utils.dashboardPercentage(21, 20), null)
})

test('host rankings preserve backend ordering, cap Top10 and encode detail routes', () => {
  const data = {
    top_vulnerabilities: Array.from({ length: 12 }, (_, i) => ({ ip_address: `10.0.0.${i + 1}`, vulnerability_count: 25 - i })),
    top_ports: [{ ip_address: '::1', port_count: 20 }]
  }
  const result = utils.normalizeDashboardHostRankings(data)
  assert.equal(result.vulnerabilities.length, 10)
  assert.equal(result.vulnerabilities[0].label, '10.0.0.1')
  assert.equal(result.ports[0].route, '/assets/hosts/%3A%3A1')
  data.top_ports[0].ip_address = 'http://example.test/a?b=c'
  assert.equal(utils.normalizeDashboardHostRankings(data).ports[0].route, '/assets/hosts/http%3A%2F%2Fexample.test%2Fa%3Fb%3Dc')
})

test('empty rankings succeed while missing, malformed and duplicate entries fail', () => {
  assert.deepEqual(utils.normalizeDashboardHostRankings({ top_vulnerabilities: [], top_ports: [] }), { vulnerabilities: [], ports: [] })
  for (const items of [null, undefined, {}, [{}], [{ ip_address: ' ', port_count: 0 }], [{ ip_address: '::1', port_count: -1 }], [{ ip_address: '::1', port_count: 2 }, { ip_address: '::1', port_count: 1 }]]) {
    assert.throws(() => utils.normalizeDashboardHostRankings({ top_vulnerabilities: [], top_ports: items }))
  }
})

test('fingerprint names stay as text and compound names are not split or linked', () => {
  const result = utils.normalizeDashboardServiceFingerprints({
    domains: [{ app_name: 'nginx / PHP', count: 30 }, { app_name: '<img src=x onerror=alert(1)>', count: 2 }],
    hosts: [{ service_name: 'ssh', count: 50 }]
  })
  assert.equal(result.domains.length, 2)
  assert.equal(result.domains[0].label, 'nginx / PHP')
  assert.equal(result.domains[1].label, '<img src=x onerror=alert(1)>')
  assert.equal(result.domains[1].route, null)
  assert.equal(result.hosts[0].label, 'ssh')
})

test('four GET APIs have no parameters, forward abort/auth and propagate query errors', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const controller = new AbortController()
  const calls = []
  const fixtures = [overview(), assetRisks(), { top_vulnerabilities: [], top_ports: [] }, { domains: [], hosts: [] }]
  const loaders = [api.getDashboardOverview, api.getDashboardAssetRisks, api.getDashboardHostRankings, api.getDashboardServiceFingerprints]
  try {
    globalThis.window = { localStorage: { getItem: key => key === 'manscan-auth-access-token' ? 'unit-test-token' : null } }
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return { ok: true, json: async () => ({ code: 0, data: fixtures[calls.length - 1] }) }
    }
    for (const loader of loaders) await loader(controller.signal)
    assert.deepEqual(calls.map(({ url }) => new URL(url, 'http://localhost').pathname), [
      '/api/v1/dashboard/overview', '/api/v1/dashboard/asset-risks', '/api/v1/dashboard/host-rankings', '/api/v1/dashboard/service-fingerprints'
    ])
    for (const { url, options } of calls) {
      assert.equal(new URL(url, 'http://localhost').search, '')
      assert.equal(options.method, 'GET')
      assert.equal(options.signal, controller.signal)
      assert.equal(options.headers.get('Authorization'), 'Bearer unit-test-token')
    }
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ code: 50301, message: '查询失败', data: null }) })
    for (const loader of loaders) await assert.rejects(loader(controller.signal), { status: 503, code: 50301 })
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})
