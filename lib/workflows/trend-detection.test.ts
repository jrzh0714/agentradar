import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isTrending, shouldSnapshot } from './trend-detection'

describe('isTrending', () => {
  it('returns true when delta is above 1.5', () => {
    assert.equal(isTrending(58, 55), true)
  })

  it('returns true when delta is exactly 1.5', () => {
    assert.equal(isTrending(56.5, 55), true)
  })

  it('returns false when delta is below 1.5', () => {
    assert.equal(isTrending(56.4, 55), false)
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

  it('returns true when last snapshot was 4 days ago', () => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 4)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns true when last snapshot was exactly 3 days ago', () => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 3)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), true)
  })

  it('returns false when last snapshot was 2 days ago', () => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - 2)
    assert.equal(shouldSnapshot(d.toISOString().split('T')[0]), false)
  })

  it('returns false when last snapshot was today', () => {
    const today = new Date().toISOString().split('T')[0]
    assert.equal(shouldSnapshot(today), false)
  })
})
