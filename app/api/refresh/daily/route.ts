/**
 * /api/refresh/daily — daily data pipeline endpoint.
 *
 * Called automatically by Vercel Cron at 08:00 UTC. Can also be triggered
 * manually for testing.
 *
 * Auth: every request must carry `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron attaches this header automatically when CRON_SECRET is set in
 * the project environment variables.
 *
 * Returns a JSON summary of the run:
 *   { success, ingestionCounts, titleFixedCount, enrichedCount, failedCount, rankedCount, durationMs }
 */
import { type NextRequest, NextResponse } from 'next/server'
import {
  runDailyRefresh,
  DEFAULT_ENRICH_LIMIT,
  MAX_DAILY_ENRICH_LIMIT,
} from '@/lib/workflows/daily-refresh'
import { parseBoundedPositiveInt } from '@/lib/http/limits'
import { acquirePipelineLease, releasePipelineLease } from '@/lib/db/pipeline-lock'

// Allow up to 5 minutes. The default batch is deliberately conservative so
// enrichment plus follow-on AI phases have time to finish before this ceiling.
export const maxDuration = 300

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[refresh/daily] CRON_SECRET is not set — all requests denied.')
    return false
  }
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${cronSecret}`
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const enrichLimit = parseBoundedPositiveInt(process.env.DAILY_ENRICH_LIMIT, {
    fallback: DEFAULT_ENRICH_LIMIT,
    max: MAX_DAILY_ENRICH_LIMIT,
  })

  let lease
  try {
    lease = await acquirePipelineLease('daily-refresh')
  } catch {
    return NextResponse.json({ error: 'Unable to acquire pipeline lease' }, { status: 503 })
  }
  if (!lease) {
    return NextResponse.json({ error: 'Daily refresh is already running' }, { status: 409 })
  }

  try {
    console.log(`[refresh/daily] Starting refresh — enrichLimit=${enrichLimit}`)

    const result = await runDailyRefresh(enrichLimit)

    console.log('[refresh/daily] Completed:', JSON.stringify(result))

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } finally {
    await releasePipelineLease(lease).catch((error) => {
      console.error('[refresh/daily] Failed to release lease:', error instanceof Error ? error.message : error)
    })
  }
}

// GET  — called by Vercel Cron (which sends GET requests).
export const GET = handler

// POST — optional manual trigger, e.g. curl -X POST -H "Authorization: Bearer $CRON_SECRET" ...
export const POST = handler
