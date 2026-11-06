import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { normalizeHostAssetDetail } = await server.ssrLoadModule('/src/utils/hostAsset.js')
after(() => server.close())

test('host detail counts each valid port number once while retaining all fingerprints', () => {
  const detail = normalizeHostAssetDetail({
    ip_address: '10.0.0.1',
    ports: [
      { port_protocol: 'tcp', port_number: 443, service_name: 'https', is_alive: true },
      { port_protocol: 'tcp', port_number: 443, service_name: 'nginx', is_alive: true },
      { port_protocol: 'udp', port_number: 443, service_name: 'quic', is_alive: false },
      { port_protocol: 'tcp', port_number: 22, service_name: 'ssh', is_alive: false },
      { port_protocol: 'tcp', port_number: 80, service_name: 'http', is_alive: true },
      { port_protocol: 'tcp', port_number: null, service_name: 'unknown', is_alive: true },
      { port_protocol: 'tcp', port_number: 0, service_name: 'invalid', is_alive: true }
    ]
  })

  assert.equal(detail.portCountDisplay, '3')
  assert.equal(detail.alivePortCountDisplay, '2')
  assert.equal(detail.ports.length, 7)
})

test('host detail treats a port as alive when any fingerprint for that number is alive', () => {
  const detail = normalizeHostAssetDetail({
    ports: [
      { port_number: 8443, is_alive: false },
      { port_number: 8443, is_alive: true },
      { port_number: 53, is_alive: false }
    ]
  })

  assert.equal(detail.portCountDisplay, '2')
  assert.equal(detail.alivePortCountDisplay, '1')
})
