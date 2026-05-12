/**
 * Unit tests for lib/workflows/cost-estimation.ts
 * Run with: npx tsx --test lib/workflows/cost-estimation.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCostEstimate, MODEL_RATES } from './cost-estimation'

describe('computeCostEstimate', () => {
  it('willProcess is capped at enrichLimit when pending > limit', () => {
    const r = computeCostEstimate(200, 150, 0.0002)
    assert.equal(r.willProcess, 150)
    assert.equal(r.pendingItems, 200)
  })

  it('willProcess equals pending when pending < limit', () => {
    const r = computeCostEstimate(30, 150, 0.0002)
    assert.equal(r.willProcess, 30)
  })

  it('estimatedUsd = willProcess * ratePerItem (rounded to 4dp)', () => {
    const r = computeCostEstimate(50, 150, 0.0002)
    assert.equal(r.estimatedUsd, 0.01)
  })

  it('zero pending items gives zero cost', () => {
    const r = computeCostEstimate(0, 150, 0.0002)
    assert.equal(r.estimatedUsd, 0)
    assert.equal(r.willProcess, 0)
  })

  it('returns ratePerItem unchanged', () => {
    const r = computeCostEstimate(10, 150, 0.0005)
    assert.equal(r.ratePerItem, 0.0005)
  })
})

describe('MODEL_RATES', () => {
  it('has a positive rate for gpt-4o-mini', () => {
    assert.ok(MODEL_RATES['gpt-4o-mini'] > 0)
  })

  it('gpt-4o-mini rate is between 0.0001 and 0.001', () => {
    assert.ok(MODEL_RATES['gpt-4o-mini'] >= 0.0001)
    assert.ok(MODEL_RATES['gpt-4o-mini'] <= 0.001)
  })

  it('mock provider has rate 0', () => {
    assert.equal(MODEL_RATES['mock'], 0)
  })
})
