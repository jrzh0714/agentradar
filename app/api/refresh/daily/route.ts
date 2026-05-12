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
 *   { success, ingestionCounts, enrichedCount, failedCount, rankedCount, durationMs }
 */
import { type NextRequest, NextResponse } from 'next/server'
import { runDailyRefresh, DEFAULT_ENRICH_LIMIT } from '@/lib/workflows/daily-refresh'

// Allow up to 5 minutes — enriching 150 items sequentially takes ~3–4 min.
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

  const enrichLimit =
    parseInt(process.env.DAILY_ENRICH_LIMIT ?? String(DEFAULT_ENRICH_LIMIT), 10) ||
    DEFAULT_ENRICH_LIMIT

  console.log(`[refresh/daily] Starting refresh — enrichLimit=${enrichLimit}`)

  const result = await runDailyRefresh(enrichLimit)

  console.log('[refresh/daily] Completed:', JSON.stringify(result))

  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}

// GET  — called by Vercel Cron (which sends GET requests).
export const GET = handler

// POST — optional manual trigger, e.g. curl -X POST -H "Authorization: Bearer $CRON_SECRET" ...
export const POST = handler
