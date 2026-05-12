import { createServerClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/provider'
import { CATEGORIES } from '@/lib/ai/schemas'
import { getCurrentMonday } from '@/lib/db/digest-summaries'
import type { Item } from '@/lib/db/types'

const MIN_ITEMS_PER_CATEGORY = 3
const ITEMS_PER_SUMMARY = 5
const SUMMARY_MIN_LENGTH = 50
const SUMMARY_MAX_LENGTH = 300

function isMonday(): boolean {
  return new Date().getDay() === 1
}

async function generateCategorySummary(
  category: string,
  items: Array<Pick<Item, 'title' | 'ai_summary' | 'description'>>,
): Promise<string | null> {
  const itemLines = items
    .map((item, i) => `${i + 1}. "${item.title}" — ${item.ai_summary ?? item.description ?? '(no description)'}`)
    .join('\n')

  const raw = await callAi({
    systemPrompt:
      'You are an editorial assistant for AgentRadar, a discovery hub for AI developer tools. Return valid JSON only.',
    userMessage: `Write a single editorial paragraph (50–300 characters) summarizing this week's highlights in the "${category}" category. Focus on patterns and what's notable. Return JSON: { "summary": "<paragraph>" }\n\nTop items this week:\n${itemLines}`,
    maxTokens: 200,
  })

  try {
    const parsed = JSON.parse(raw) as { summary?: string }
    const summary = parsed.summary?.trim() ?? ''
    if (summary.length < SUMMARY_MIN_LENGTH || summary.length > SUMMARY_MAX_LENGTH) {
      console.warn(`[digest-summaries] Invalid summary length for "${category}": ${summary.length} chars`)
      return null
    }
    return summary
  } catch {
    console.warn(`[digest-summaries] Failed to parse JSON response for "${category}"`)
    return null
  }
}

/**
 * Generates and upserts AI editorial summaries for each digest category.
 * Only runs on Mondays — returns { generated: 0, skipped: 0 } on other days.
 * Skips categories with fewer than 3 enriched items.
 */
export async function runDigestSummaries(): Promise<{ generated: number; skipped: number }> {
  if (!isMonday()) return { generated: 0, skipped: 0 }

  const supabase = createServerClient()
  const weekOf = getCurrentMonday().toISOString().split('T')[0]
  let generated = 0
  let skipped = 0

  for (const category of CATEGORIES) {
    const { data, error } = await supabase
      .from('items')
      .select('title, ai_summary, description')
      .eq('status', 'enriched')
      .eq('ai_category', category)
      .order('ranking_score', { ascending: false })
      .limit(ITEMS_PER_SUMMARY)

    if (error) {
      console.error(`[digest-summaries] Fetch failed for "${category}":`, error.message)
      skipped++
      continue
    }

    const items = (data ?? []) as Array<Pick<Item, 'title' | 'ai_summary' | 'description'>>

    if (items.length < MIN_ITEMS_PER_CATEGORY) {
      skipped++
      continue
    }

    try {
      const summary = await generateCategorySummary(category, items)
      if (!summary) { skipped++; continue }

      const { error: upsertErr } = await supabase
        .from('digest_summaries')
        .upsert({ category, summary, week_of: weekOf }, { onConflict: 'category,week_of' })

      if (upsertErr) {
        console.error(`[digest-summaries] Upsert failed for "${category}":`, upsertErr.message)
        skipped++
      } else {
        generated++
      }
    } catch (err) {
      console.error(`[digest-summaries] AI call failed for "${category}":`, err instanceof Error ? err.message : err)
      skipped++
    }
  }

  return { generated, skipped }
}
