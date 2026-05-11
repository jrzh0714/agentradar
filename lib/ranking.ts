import type { Item, ItemSource } from '@/lib/db/types'

const SOURCE_WEIGHTS: Record<ItemSource, number> = {
  github: 1.0,
  hackernews: 0.9,
  rss: 0.8,
}

const DECAY_DAYS = 7

function recencyScore(publishedAt: string | null): number {
  if (!publishedAt) return 0.5 // unknown age → neutral score
  const ageMs = Date.now() - new Date(publishedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.max(0, 1 - ageDays / DECAY_DAYS)
}

export function computeRankScore(
  item: Pick<Item, 'source' | 'published_at' | 'ai_relevance_score'>,
): number {
  const relevance = item.ai_relevance_score ?? 0.5
  const recency = recencyScore(item.published_at)
  const sourceWeight = SOURCE_WEIGHTS[item.source]

  return relevance * 0.5 + recency * 0.3 + sourceWeight * 0.2
}
