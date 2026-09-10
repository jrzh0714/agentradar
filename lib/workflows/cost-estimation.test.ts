/**
 * Unit tests for lib/workflows/cost-estimation.ts
 * Run with: npx tsx --test lib/workflows/cost-estimation.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertWithinDailyAiBudget,
  computeCostEstimate,
  DEFAULT_MAX_DAILY_AI_COST_USD,
  estimateStandaloneEnrichmentCost,
  MAX_DIGEST_SUMMARIES,
  MAX_RECLASSIFICATION_ITEMS,
  MAX_TRANSLATION_ITEMS,
  MODEL_RATES,
  parseDailyAiBudget,
} from './cost-estimation'

const TEST_RATES = {
  enrichmentItemUsd: 0.01,
  translationItemUsd: 0.002,
  digestSummaryUsd: 0.003,
}

describe('computeCostEstimate', () => {
  it('willProcess is capped at enrichLimit when pending > limit', () => {
    const r = computeCostEstimate(200, 150, TEST_RATES)
    assert.equal(r.willProcess, 150)
    assert.equal(r.pendingItems, 200)
  })

  it('willProcess equals pending when pending < limit', () => {
    const r = computeCostEstimate(30, 150, TEST_RATES)
    assert.equal(r.willProcess, 30)
  })

  it('includes enrichment, reclassification, translation, and digest worst cases', () => {
    const r = computeCostEstimate(5, 150, TEST_RATES)
    assert.deepEqual(r.breakdown, {
      enrichmentUsd: 0.05,
      reclassificationUsd: 0.1,
      translationUsd: 0.04,
      digestSummariesUsd: 0.039,
    })
    assert.equal(r.estimatedUsd, 0.229)
    assert.deepEqual(r.assumptions, {
      reclassificationItems: MAX_RECLASSIFICATION_ITEMS,
      translationItems: MAX_TRANSLATION_ITEMS,
      digestSummaryCalls: MAX_DIGEST_SUMMARIES,
    })
  })

  it('still reserves follow-on phase cost when no enrichment is pending', () => {
    const r = computeCostEstimate(0, 150, TEST_RATES)
    assert.equal(r.estimatedUsd, 0.179)
    assert.equal(r.willProcess, 0)
  })

  it('returns ratePerItem unchanged', () => {
    const r = computeCostEstimate(10, 150, TEST_RATES)
    assert.equal(r.ratePerItem, TEST_RATES.enrichmentItemUsd)
  })

  it('mock work remains free across every phase', () => {
    const r = computeCostEstimate(500, 500, MODEL_RATES.mock)
    assert.equal(r.estimatedUsd, 0)
  })
})

describe('MODEL_RATES', () => {
  it('has a positive rate for the default GPT-5.4 nano snapshot', () => {
    assert.ok(MODEL_RATES['gpt-5.4-nano-2026-03-17'].enrichmentItemUsd > 0)
  })

  it('default enrichment estimate reserves both attempts and capped output', () => {
    assert.ok(MODEL_RATES['gpt-5.4-nano-2026-03-17'].enrichmentItemUsd >= 0.005)
  })

  it('mock provider has rate 0', () => {
    assert.deepEqual(MODEL_RATES.mock, {
      enrichmentItemUsd: 0,
      translationItemUsd: 0,
      digestSummaryUsd: 0,
    })
  })

  it('standalone estimates fail closed for unknown models', () => {
    assert.equal(estimateStandaloneEnrichmentCost(3, 'gpt-5.4-nano-2026-03-17'), 0.015)
    assert.throws(() => estimateStandaloneEnrichmentCost(3, 'unknown-model'), /No cost rate/)
  })
})

describe('daily AI budget', () => {
  it('uses the default only when the configured value is missing', () => {
    assert.equal(parseDailyAiBudget(undefined), DEFAULT_MAX_DAILY_AI_COST_USD)
    assert.throws(() => parseDailyAiBudget('0'), /positive number/)
    assert.throws(() => parseDailyAiBudget('not-a-number'), /positive number/)
  })

  it('accepts a positive configured budget', () => {
    assert.equal(parseDailyAiBudget('0.25'), 0.25)
  })

  it('rejects an estimate above budget', () => {
    assert.throws(() => assertWithinDailyAiBudget(0.26, 0.25), /exceeds/)
    assert.doesNotThrow(() => assertWithinDailyAiBudget(0.25, 0.25))
  })
})
