import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTrending, shouldSnapshot } from './trend-detection'

describe('isTrending', () => {
  it('returns true when delta >= 20', () => {
    assert.equal(isTrending(80, 55), true)   // delta = 25
  })

  it('returns true when delta is exactly 20', () => {
    assert.equal(isTrending(75, 55), true)   // delta = 20
  })

  it('returns false when delta is 19', () => {
    assert.equal(isTrending(74, 55), false)  // delta = 19
  })

  it('returns false when delta is negative', () => {
    assert.equal(isTrending(40, 80), false)
  })

  it('returns false when previousScore is null', () => {
    assert.equal(isTrending(80, null), false)
  })

  it('returns false when both scores are equal', () => {
    assert.equal(isTrending(50, 50), false)
  })
})

describe('shouldSnapshot', () => {
  it('returns true when lastSnapshotDate is null', () => {
    assert.equal(shouldSnapshot(null), true)
  })

  it('returns true when last snapshot was 8 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 8)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns true when last snapshot was exactly 7 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns false when last snapshot was 3 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 3)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), false)
  })

  it('returns false when last snapshot was today', () => {
    const today = new Date().toISOString().split('T')[0]
    assert.equal(shouldSnapshot(today), false)
  })
})
