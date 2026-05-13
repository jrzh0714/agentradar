/**
 * Pipeline run log — read/write helpers for the pipeline_runs table.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { RefreshResult } from '@/lib/workflows/daily-refresh'

export interface PipelineRun {
  id: string
  ran_at: string
  success: boolean
  ingested_github: number
  ingested_hn: number
  ingested_rss: number
  enriched_count: number
  failed_count: number
  ranked_count: number
  translated_count: number
  trending_count: number
  digest_summaries_generated: number
  anomalies_found: number
  duration_ms: number
  error: string | null
  estimated_cost: unknown | null
}

/** Persist a RefreshResult to the pipeline_runs table. Best-effort — never throws. */
export async function logPipelineRun(result: RefreshResult): Promise<void> {
  try {
    const supabase = createServerClient()
    await supabase.from('pipeline_runs').insert({
      success:                    result.success,
      ingested_github:            result.ingestionCounts.github,
      ingested_hn:                result.ingestionCounts.hn,
      ingested_rss:               result.ingestionCounts.rss,
      enriched_count:             result.enrichedCount,
      failed_count:               result.failedCount,
      ranked_count:               result.rankedCount,
      translated_count:           result.translatedCount,
      trending_count:             result.trendingCount,
      digest_summaries_generated: result.digestSummariesGenerated,
      anomalies_found:            result.anomaliesFound,
      duration_ms:                result.durationMs,
      error:                      result.error ?? null,
      estimated_cost:             result.estimatedCost ?? null,
    })
  } catch (err) {
    // Never crash the main pipeline over a logging failure.
    console.error('[pipeline-runs] Failed to log run:', err instanceof Error ? err.message : err)
  }
}

/** Fetch the most recent N pipeline runs, newest first. */
export async function getRecentPipelineRuns(limit = 14): Promise<PipelineRun[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[pipeline-runs] Fetch error:', error.message)
    return []
  }
  return (data ?? []) as PipelineRun[]
}
