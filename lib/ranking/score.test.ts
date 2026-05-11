/**
 * Unit tests for lib/ranking/score.ts
 * Run with: npx tsx --test lib/ranking/score.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  computeRankingScore,
  recencyScore,
  githubMomentumScore,
  hnDiscussionScore,
  relevancePenalty,
} from './score'

// Fixed reference time used across all time-sensitive tests
const NOW = new Date('2025-06-01T00:00:00Z')

// Minimal stub for a fully-enriched GitHub item
function makeItem(overrides: Partial<Parameters<typeof computeRankingScore>[0]> = {}): Parameters<typeof computeRankingScore>[0] {
  return {
    source: 'github',
    published_at: '2025-05-29T00:00:00Z',  // 3 days before NOW
    discovered_at: '2025-05-29T00:00:00Z',
    ai_relevance_score: 0.8,
    github_stars: 1000,
    github_forks: 100,
    hn_points: null,
    hn_comments: null,
    ...overrides,
  }
}

// ── Test 1 ────────────────────────────────────────────────────────────────────
test('returns final=0 when ai_relevance_score is null', () => {
  const result = computeRankingScore(makeItem({ ai_relevance_score: null }), { now: NOW })
  assert.equal(result.final, 0)
  assert.equal(result.penalty, 0)
  assert.equal(result.weighted, 0)
})

// ── Test 2 ────────────────────────────────────────────────────────────────────
test('recencyScore: item published today is close to 100', () => {
  const score = recencyScore('2025-06-01T00:00:00Z', '2025-06-01T00:00:00Z', NOW)
  assert.ok(score >= 99, `Expected ~100, got ${score}`)
})

// ── Test 3 ────────────────────────────────────────────────────────────────────
test('recencyScore: item published 365 days ago floors at 10', () => {
  const old = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const score = recencyScore(old, old, NOW)
  assert.ok(score >= 10 && score < 11, `Expected ~10, got ${score}`)
})

// ── Test 4 ────────────────────────────────────────────────────────────────────
test('recencyScore: falls back to discovered_at when published_at is null', () => {
  // Use discovered_at = 3 days ago → expect score between 10 and 100
  const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const score = recencyScore(null, threeDaysAgo, NOW)
  assert.ok(score > 10 && score <= 100, `Expected score between 10 and 100, got ${score}`)
})

// ── Test 5 ────────────────────────────────────────────────────────────────────
test('githubMomentumScore: zero stars and forks returns 0', () => {
  const score = githubMomentumScore(0, 0, 100_000)
  assert.equal(score, 0)
})

// ── Test 6 ────────────────────────────────────────────────────────────────────
test('githubMomentumScore: maxStars item scores close to 100', () => {
  // Item with exactly maxStars stars, no forks — star component = 1 → combined ≈ 0.80 × 100 = 80
  const score = githubMomentumScore(100_000, 0, 100_000)
  // star portion = log(100001)/log(100001) = 1 → 0.80*100 = 80
  assert.ok(score >= 79 && score <= 81, `Expected ~80, got ${score}`)
})

// ── Test 7 ────────────────────────────────────────────────────────────────────
test('relevancePenalty: < 0.4 applies ×0.35 multiplier', () => {
  assert.equal(relevancePenalty(0.1), 0.35)
  assert.equal(relevancePenalty(0.39), 0.35)
})

// ── Test 8 ────────────────────────────────────────────────────────────────────
test('computeRankingScore: final score is in range 0–100 for typical items', () => {
  const cases = [
    makeItem({ ai_relevance_score: 0.9, github_stars: 50_000, hn_points: 500, hn_comments: 300 }),
    makeItem({ source: 'hackernews', ai_relevance_score: 0.3, github_stars: null }),
    makeItem({ source: 'rss', ai_relevance_score: 0.6, published_at: null }),
    makeItem({ ai_relevance_score: 0.5, github_stars: 0, github_forks: 0 }),
  ]

  for (const item of cases) {
    const { final } = computeRankingScore(item, { maxStars: 100_000, now: NOW })
    assert.ok(
      final >= 0 && final <= 100,
      `Expected score in [0,100], got ${final} for source=${item.source} rel=${item.ai_relevance_score}`,
    )
  }
})

// ── Bonus: penalty tiers ──────────────────────────────────────────────────────
test('relevancePenalty: 0.4–0.49 applies ×0.65, ≥0.5 applies ×1.0', () => {
  assert.equal(relevancePenalty(0.4), 0.65)
  assert.equal(relevancePenalty(0.49), 0.65)
  assert.equal(relevancePenalty(0.5), 1.0)
  assert.equal(relevancePenalty(0.9), 1.0)
})

// ── Bonus: hnDiscussionScore sanity ──────────────────────────────────────────
test('hnDiscussionScore: null points/comments returns 0, high signal approaches 100', () => {
  assert.equal(hnDiscussionScore(null, null), 0)
  const high = hnDiscussionScore(700, 300)   // 1000 combined → ~100
  assert.ok(high > 99 && high <= 100, `Expected ~100, got ${high}`)
})
