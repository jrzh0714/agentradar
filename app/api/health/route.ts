/**
 * /api/health — public data quality check endpoint.
 *
 * Returns a health report with anomaly counts. Always returns HTTP 200 — uptime monitors
 * trigger on non-200 (route down), not on healthy:false (data anomalies).
 *
 * Auth: none required — public read-only endpoint.
 */
import { NextResponse } from 'next/server'
import { runDataQualityCheck } from '@/lib/workflows/data-quality'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  try {
    const report = await runDataQualityCheck()
    // Always 200 — uptime monitors should alert on non-200, not on healthy:false
    return NextResponse.json(report, { status: 200 })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { healthy: false, error, checkedAt: new Date().toISOString() },
      { status: 200 }
    )
  }
}
