/**
 * /api/pipeline/estimate — cost estimation endpoint.
 *
 * Returns a pre-flight cost estimate before the enrichment pipeline runs.
 * Callers can inspect the estimate and decide whether to proceed.
 *
 * Query params:
 *   ?limit=N — override the default enrichment limit (default: DAILY_ENRICH_LIMIT env or DEFAULT_ENRICH_LIMIT const)
 *
 * Auth: every request must carry `Authorization: Bearer <CRON_SECRET>`.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { estimatePipelineCost } from '@/lib/workflows/cost-estimation'
import { DEFAULT_ENRICH_LIMIT } from '@/lib/workflows/daily-refresh'

export const dynamic = 'force-dynamic'

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[pipeline/estimate] CRON_SECRET is not set — all requests denied.')
    return false
  }
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${cronSecret}`
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = req.nextUrl.searchParams.get('limit')
  const enrichLimit =
    (limitParam ? parseInt(limitParam, 10) : null) ||
    parseInt(process.env.DAILY_ENRICH_LIMIT ?? String(DEFAULT_ENRICH_LIMIT), 10) ||
    DEFAULT_ENRICH_LIMIT

  try {
    const estimate = await estimatePipelineCost(enrichLimit)
    return NextResponse.json(estimate)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error }, { status: 500 })
  }
}
