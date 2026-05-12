import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deriveHealthReport } from './data-quality'

describe('deriveHealthReport', () => {
  it('healthy=true when all counts are zero and emptySections is empty', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, true)
  })

  it('healthy=false when stuckNew > 0', () => {
    const r = deriveHealthReport({ stuckNew: 2, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when failedCount > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 5, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when unranked > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 1, missingCategory: 0, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when missingCategory > 0', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 3, emptySections: [] })
    assert.equal(r.healthy, false)
  })

  it('healthy=false when emptySections is non-empty', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: ['RAG'] })
    assert.equal(r.healthy, false)
  })

  it('passes anomaly counts through to report unchanged', () => {
    const anomalies = { stuckNew: 1, failedCount: 2, unranked: 3, missingCategory: 4, emptySections: ['RAG', 'Research'] }
    const r = deriveHealthReport(anomalies)
    assert.deepEqual(r.anomalies, anomalies)
  })

  it('checkedAt is a non-empty ISO string', () => {
    const r = deriveHealthReport({ stuckNew: 0, failedCount: 0, unranked: 0, missingCategory: 0, emptySections: [] })
    assert.ok(typeof r.checkedAt === 'string')
    assert.ok(r.checkedAt.includes('T'))
  })
})
