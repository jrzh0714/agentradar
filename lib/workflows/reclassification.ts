import { createServerClient } from '@/lib/supabase/server'
import { enrichItem } from '@/lib/ai/enrich'
import { ProviderBillingError } from '@/lib/ai/provider'
import type { Item } from '@/lib/db/types'

const RECLASSIFY_LIMIT = 20
const ENRICH_DELAY_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Re-enriches items with low relevance scores or 'Other' category.
 * Uses the same enrichItem() pipeline — updates category, tags, summary, and score.
 * Limit 20 per run to control AI costs.
 */
export async function runReclassification(): Promise<{ reclassified: number; failed: number }> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('status', 'enriched')
    .or('ai_relevance_score.lt.0.5,ai_category.eq.Other')
    .order('created_at', { ascending: true })
    .limit(RECLASSIFY_LIMIT)

  if (error) throw new Error(`Reclassification fetch failed: ${error.message}`)

  const items = (data ?? []) as Item[]
  let reclassified = 0
  let failed = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    try {
      const result = await enrichItem(item)

      if (result.success) {
        const { error: updateErr } = await supabase
          .from('items')
          .update({ ...result.update, needs_reclassification: false })
          .eq('id', item.id)

        if (updateErr) {
          console.error(`[reclassification] DB update failed for ${item.id}:`, updateErr.message)
          failed++
        } else {
          reclassified++
        }
      } else {
        await supabase
          .from('items')
          .update({ needs_reclassification: true })
          .eq('id', item.id)
        console.warn(`[reclassification] Enrichment failed for ${item.id}:`, result.error)
        failed++
      }
    } catch (err) {
      if (err instanceof ProviderBillingError) {
        console.error('[reclassification] Billing error — stopping batch')
        break
      }
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[reclassification] Error for item ${item.id}:`, msg)
      try {
        await supabase.from('items').update({ needs_reclassification: true }).eq('id', item.id)
      } catch { /* best-effort */ }
      failed++
    }

    if (i < items.length - 1) await sleep(ENRICH_DELAY_MS)
  }

  return { reclassified, failed }
}
