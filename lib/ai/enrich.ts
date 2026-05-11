import { callAi } from '@/lib/ai/provider'
import { EnrichmentSchema } from '@/lib/ai/schemas'
import { ENRICHMENT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import type { Item, ItemEnrichmentUpdate } from '@/lib/db/types'

/** Strip optional markdown code fences from an AI response. */
function extractJson(raw: string): string {
  const trimmed = raw.trim()
  // Handle ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  if (fenced) return fenced[1].trim()
  return trimmed
}

// Character budgets — keeps API costs low while giving the model enough context.
const DESC_LIMIT = 500
const CONTENT_LIMIT = 4000

/** Build the user message from an item's fields, safely truncated. */
function buildUserMessage(
  item: Pick<
    Item,
    | 'title'
    | 'url'
    | 'source'
    | 'description'
    | 'raw_content'
    | 'github_stars'
    | 'github_language'
    | 'hn_points'
    | 'hn_comments'
  >,
): string {
  const lines: string[] = [
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Source: ${item.source}`,
  ]

  if (item.description) lines.push(`Description: ${item.description.slice(0, DESC_LIMIT)}`)
  if (item.raw_content) {
    const snippet = item.raw_content.slice(0, CONTENT_LIMIT)
    lines.push(`Content snippet: ${snippet}`)
  }
  if (item.github_stars != null) lines.push(`GitHub stars: ${item.github_stars}`)
  if (item.github_language) lines.push(`Language: ${item.github_language}`)
  if (item.hn_points != null) lines.push(`HN points: ${item.hn_points}`)
  if (item.hn_comments != null) lines.push(`HN comments: ${item.hn_comments}`)

  return lines.join('\n')
}

export interface EnrichResult {
  success: true
  update: ItemEnrichmentUpdate
}

export interface EnrichFailure {
  success: false
  error: string
}

/**
 * Call the AI to enrich a single item, retry once on validation failure.
 * Maps the non-prefixed AI output to ai_-prefixed DB fields.
 * Divides relevance_score by 10 (AI returns 1–10; DB stores 0–1).
 */
export async function enrichItem(item: Item): Promise<EnrichResult | EnrichFailure> {
  const userMessage = buildUserMessage(item)

  async function attempt(): Promise<EnrichResult | null> {
    const raw = await callAi({
      systemPrompt: ENRICHMENT_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 512,
    })

    const jsonStr = extractJson(raw)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return null
    }

    const result = EnrichmentSchema.safeParse(parsed)
    if (!result.success) return null

    const data = result.data
    const update: ItemEnrichmentUpdate = {
      ai_summary:         data.summary,
      ai_why_it_matters:  data.why_it_matters,
      ai_category:        data.category,
      ai_tags:            data.tags,
      ai_audience:        data.audience,
      ai_maturity:        data.maturity,
      ai_relevance_score: Math.round((data.relevance_score / 10) * 1000) / 1000, // 3 decimal places
      ranking_score:      0, // set in Phase 3B
      status:             'enriched',
    }

    return { success: true, update }
  }

  // First attempt
  const first = await attempt()
  if (first) return first

  // Retry once
  const second = await attempt()
  if (second) return second

  return { success: false, error: 'AI response failed Zod validation after 2 attempts' }
}
