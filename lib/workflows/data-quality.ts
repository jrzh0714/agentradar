import { createServerClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/ai/schemas'

export interface AnomalyCounts {
  stuckNew: number
  failedCount: number
  unranked: number
  missingCategory: number
  emptySections: string[]
}

export interface HealthReport {
  healthy: boolean
  checkedAt: string
  anomalies: AnomalyCounts
}

/** Pure — exported for unit tests. */
export function deriveHealthReport(anomalies: AnomalyCounts): HealthReport {
  const healthy =
    anomalies.stuckNew === 0 &&
    anomalies.failedCount === 0 &&
    anomalies.unranked === 0 &&
    anomalies.missingCategory === 0 &&
    anomalies.emptySections.length === 0

  return { healthy, checkedAt: new Date().toISOString(), anomalies }
}

async function postSlackAlert(report: HealthReport): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const { anomalies: a } = report
  const lines = [
    '*AgentRadar — Data Quality Alert* ⚠️',
    `Checked at: ${report.checkedAt}`,
    '',
  ]
  if (a.stuckNew > 0)        lines.push(`• ${a.stuckNew} items stuck in \`status=new\` > 48 h`)
  if (a.failedCount > 0)     lines.push(`• ${a.failedCount} items with \`status=failed\``)
  if (a.unranked > 0)        lines.push(`• ${a.unranked} enriched items with \`ranking_score=0\``)
  if (a.missingCategory > 0) lines.push(`• ${a.missingCategory} enriched items missing \`ai_category\``)
  if (a.emptySections.length > 0) lines.push(`• Empty digest sections: ${a.emptySections.join(', ')}`)

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
    })
  } catch (err) {
    console.warn('[data-quality] Slack webhook failed:', err instanceof Error ? err.message : err)
  }
}

export async function runDataQualityCheck(
  { notify = true }: { notify?: boolean } = {},
): Promise<HealthReport> {
  const supabase = createServerClient()
  const stuckCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const [stuckNewRes, failedRes, unrankedRes, missingCatRes] = await Promise.all([
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'new').lt('created_at', stuckCutoff),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('ranking_score', 0),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').is('ai_category', null),
  ])

  const coreError = [stuckNewRes, failedRes, unrankedRes, missingCatRes]
    .map((result) => result.error)
    .find(Boolean)
  if (coreError) throw new Error(`Data quality query failed: ${coreError.message}`)

  const categoryChecks = await Promise.all(
    CATEGORIES.map(async (category) => {
      const { count, error } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'enriched')
        .eq('ai_category', category)
      if (error) throw new Error(`Category health query failed: ${error.message}`)
      return { category, count: count ?? 0 }
    }),
  )

  const anomalies: AnomalyCounts = {
    stuckNew:        stuckNewRes.count   ?? 0,
    failedCount:     failedRes.count     ?? 0,
    unranked:        unrankedRes.count   ?? 0,
    missingCategory: missingCatRes.count ?? 0,
    emptySections:   categoryChecks.filter((r) => r.count === 0).map((r) => r.category),
  }

  const report = deriveHealthReport(anomalies)
  if (!report.healthy && notify) await postSlackAlert(report)
  return report
}
