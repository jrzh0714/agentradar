import type { Item, ItemSource } from '@/lib/db/types'

// ── Weights (must sum to 1.0) ─────────────────────────────────────────────────

export const WEIGHTS = {
  ai_relevance:    0.40,
  recency:         0.25,
  source_quality:  0.10,
  github_momentum: 0.15,
  hn_discussion:   0.10,
} as const

// ── Source quality base scores (0–100) ───────────────────────────────────────

export const SOURCE_QUALITY: Record<ItemSource, number> = {
  github:      90,
  hackernews:  80,
  rss:         65,
}

// ── Component functions ───────────────────────────────────────────────────────

/**
 * Recency score 0–100.
 *
 * Uses published_at if available, else discovered_at.
 * Exponential decay with a half-life of ~14 days, floor at 10 so that old
 * items still carry a small signal.
 *
 *   age 0 days  → 100
 *   age 14 days → ~43
 *   age 30 days → ~17
 *   age 90 days → ~10 (floor)
 */
export function recencyScore(
  publishedAt: string | null,
  discoveredAt: string,
  now: Date = new Date(),
): number {
  const dateStr = publishedAt ?? discoveredAt
  const ageDays = (now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  const raw = 10 + 90 * Math.exp(-ageDays / 14)
  return Math.min(100, Math.max(10, raw))
}

/**
 * GitHub momentum score 0–100.
 *
 * Log-scaled to prevent mega-repos from dominating. Stars carry 80 % weight,
 * forks 20 %. maxStars is the highest star count seen across the current
 * ranking corpus and is used to normalise the log ratio.
 */
export function githubMomentumScore(
  stars: number | null,
  forks: number | null,
  maxStars: number,
): number {
  if (maxStars <= 0) return 0
  const s = Math.max(0, stars ?? 0)
  const f = Math.max(0, forks ?? 0)
  const logMax = Math.log(maxStars + 1)
  const starComponent = Math.log(s + 1) / logMax
  const forkComponent = Math.log(f + 1) / logMax
  const combined = starComponent * 0.80 + forkComponent * 0.20
  return Math.min(100, Math.max(0, combined * 100))
}

/**
 * Hacker News discussion score 0–100.
 *
 * Log-scaled. Treats a combined points + comments signal of 1 000 as 100 %.
 * Anything beyond that is clamped to 100.
 */
export function hnDiscussionScore(
  points: number | null,
  comments: number | null,
): number {
  const p = Math.max(0, points ?? 0)
  const c = Math.max(0, comments ?? 0)
  // log(1001) ≈ 6.909 → 1 000 combined maps to 100
  const score = (Math.log(p + c + 1) / Math.log(1001)) * 100
  return Math.min(100, Math.max(0, score))
}

/**
 * Low-relevance penalty multiplier.
 *
 * Aggressively suppresses items the AI scored as low-relevance so they don't
 * crowd out high-quality content via recency or GitHub star counts alone.
 *
 *   ai_relevance_score < 0.4  → ×0.35
 *   ai_relevance_score < 0.5  → ×0.65
 *   ai_relevance_score ≥ 0.5  → ×1.00 (no penalty)
 */
export function relevancePenalty(aiRelevanceScore: number): number {
  if (aiRelevanceScore < 0.4) return 0.35
  if (aiRelevanceScore < 0.5) return 0.65
  return 1.0
}

// ── Main scoring function ─────────────────────────────────────────────────────

export type RankableItem = Pick<
  Item,
  | 'source'
  | 'published_at'
  | 'discovered_at'
  | 'ai_relevance_score'
  | 'github_stars'
  | 'github_forks'
  | 'hn_points'
  | 'hn_comments'
>

export interface RankingOptions {
  /**
   * Maximum star count across the corpus used to normalise github_momentum.
   * Pass the highest github_stars value from the batch being ranked.
   * Defaults to 100 000 when not provided.
   */
  maxStars?: number
  /** Override current time — useful for deterministic tests. */
  now?: Date
}

export interface ScoreBreakdown {
  ai_relevance:    number  // component score 0–100
  recency:         number
  source_quality:  number
  github_momentum: number
  hn_discussion:   number
  weighted:        number  // sum of weighted components, before penalty
  penalty:         number  // multiplier applied
  final:           number  // ranking_score stored in DB (0–100)
}

/**
 * Compute a composite ranking score (0–100) for a single item.
 *
 * Returns `{ final: 0, ... }` for items where `ai_relevance_score` is null —
 * unenriched items are excluded from ranking.
 *
 * The `final` value is rounded to 4 decimal places to match the DB column
 * `numeric(10,4)`.
 */
export function computeRankingScore(
  item: RankableItem,
  opts: RankingOptions = {},
): ScoreBreakdown {
  const { maxStars = 100_000, now = new Date() } = opts

  // Unenriched — return a zero breakdown
  if (item.ai_relevance_score === null) {
    return {
      ai_relevance: 0, recency: 0, source_quality: 0,
      github_momentum: 0, hn_discussion: 0,
      weighted: 0, penalty: 0, final: 0,
    }
  }

  const rel = item.ai_relevance_score  // 0–1

  const components = {
    ai_relevance:    rel * 100,
    recency:         recencyScore(item.published_at, item.discovered_at, now),
    source_quality:  SOURCE_QUALITY[item.source],
    github_momentum: githubMomentumScore(item.github_stars, item.github_forks, maxStars),
    hn_discussion:   hnDiscussionScore(item.hn_points, item.hn_comments),
  }

  const weighted =
    components.ai_relevance    * WEIGHTS.ai_relevance    +
    components.recency         * WEIGHTS.recency         +
    components.source_quality  * WEIGHTS.source_quality  +
    components.github_momentum * WEIGHTS.github_momentum +
    components.hn_discussion   * WEIGHTS.hn_discussion

  const penalty = relevancePenalty(rel)
  const raw = weighted * penalty
  const final = Math.round(Math.min(100, Math.max(0, raw)) * 10000) / 10000

  return { ...components, weighted, penalty, final }
}
