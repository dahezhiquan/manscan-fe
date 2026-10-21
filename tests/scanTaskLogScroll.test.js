import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePrependedLogScrollTop } from '../src/utils/scanTaskLogScroll.js'

test('final older-log page reaches the true top when loading started there', () => {
  assert.equal(resolvePrependedLogScrollTop({
    previousScrollTop: 0,
    previousScrollHeight: 1200,
    currentScrollHeight: 2400,
    scrollToTop: true
  }), 0)
})

test('intermediate older-log pages preserve the visible log anchor', () => {
  assert.equal(resolvePrependedLogScrollTop({
    previousScrollTop: 24,
    previousScrollHeight: 1200,
    currentScrollHeight: 2400
  }), 1224)
})
