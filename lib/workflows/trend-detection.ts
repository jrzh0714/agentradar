import { createServerClient } from '@/lib/supabase/server'

// Score must rise by this many points over the snapshot window to qualify as trending.
// Kept low because composite ranking_score typically moves by 1–3 pts per cycle.
const TREND_THRESHOLD = 1.5
const SNAPSHOT_INTERVAL_DAYS = 3
const BATCH_SIZE = 500
const WRITE_CONCURRENCY = 50

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

export function isTrending(
  currentScore: number,
  previousScore: number | null,
): boolean {
  if (previousScore === null) return false
  return currentScore - previousScore >= TREND_THRESHOLD
}

export function shouldSnapshot(lastSnapshotDate: string | null): boolean {
  if (!lastSnapshotDate) return true
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - SNAPSHOT_INTERVAL_DAYS)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return lastSnapshotDate <= cutoffStr
}

// ── DB phases ──────────────────────────────────────────────────────────────────

/**
 * Copies ranking_score → ranking_score_7d_ago for items whose snapshot
 * is older than 7 days (or has never been taken).
 * Skips items snapshotted less than 7 days ago.
 */
export async function runTrendSnapshot(): Promise<{ snapshotted: number }> {
  const supabase = createServerClient()
  const today = new Date().toISOString().split('T')[0]
  let snapshotted = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, ranking_score, score_snapshot_date')
      .eq('status', 'enriched')
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(`Trend snapshot fetch failed: ${error.message}`)

    const rows = (data ?? []) as Array<{
      id: string
      ranking_score: number
      score_snapshot_date: string | null
    }>

    const toSnapshot = rows.filter((r) => shouldSnapshot(r.score_snapshot_date))

    for (let i = 0; i < toSnapshot.length; i += WRITE_CONCURRENCY) {
      const chunk = toSnapshot.slice(i, i + WRITE_CONCURRENCY)
      await Promise.allSettled(
        chunk.map((row) =>
          supabase
            .from('items')
            .update({ ranking_score_7d_ago: row.ranking_score, score_snapshot_date: today })
            .eq('id', row.id),
        ),
      )
      snapshotted += chunk.length
    }

    if (rows.length < BATCH_SIZE) break
    from += rows.length
  }

  return { snapshotted }
}

/**
 * Sets trending=true on items where ranking_score increased ≥ 20 points
 * since their 7-day snapshot. Clears trending=false on all others.
 * Runs every day after ranking.
 */
export async function runTrendFlagUpdate(): Promise<{ trendingCount: number }> {
  const supabase = createServerClient()
  let trendingCount = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, ranking_score, ranking_score_7d_ago')
      .eq('status', 'enriched')
      .range(from, from + BATCH_SIZE - 1)

    if (error) throw new Error(`Trend flag fetch failed: ${error.message}`)

    const rows = (data ?? []) as Array<{
      id: string
      ranking_score: number
      ranking_score_7d_ago: number | null
    }>

    const results = await Promise.allSettled(
      rows.map((row) => {
        const trending = isTrending(row.ranking_score, row.ranking_score_7d_ago)
        if (trending) trendingCount++
        return supabase.from('items').update({ trending }).eq('id', row.id)
      }),
    )

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) console.warn(`[trend-detection] ${failed} flag writes failed`)

    if (rows.length < BATCH_SIZE) break
    from += rows.length
  }

  return { trendingCount }
}
