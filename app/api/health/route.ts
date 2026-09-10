/**
 * /api/health — public data quality check endpoint.
 *
 * Returns a cached, side-effect-free readiness report with anomaly counts.
 *
 * Auth: none required — public read-only endpoint.
 */
import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { runDataQualityCheck } from '@/lib/workflows/data-quality'

const getCachedHealthReport = unstable_cache(
  () => runDataQualityCheck({ notify: false }),
  ['public-health-report'],
  { revalidate: 60 },
)

export async function GET(): Promise<NextResponse> {
  try {
    const report = await getCachedHealthReport()
    return NextResponse.json(report, {
      status: report.healthy ? 200 : 503,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  } catch {
    return NextResponse.json(
      { healthy: false, error: 'Health check unavailable', checkedAt: new Date().toISOString() },
      { status: 503 },
    )
  }
}
