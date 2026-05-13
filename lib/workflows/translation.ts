/**
 * Simplified Chinese translation workflow.
 *
 * Translates ai_summary and ai_why_it_matters for enriched items that have
 * not yet been translated. Uses the same callAi() provider as enrichment,
 * so AI_PROVIDER controls which model runs the translations.
 *
 * Cost model (GPT-4o-mini):
 *   - ~245 tokens input per item (system prompt + English text)
 *   - ~200 tokens output per item (Chinese text)
 *   - ~$0.0002 per item  →  2,000-item corpus ≈ $0.40 one-time
 *   - 30 new items/day × $0.0002 ≈ $0.006/day ≈ $0.18/month ongoing
 */
import { createServerClient } from '@/lib/supabase/server'
import { callAi } from '@/lib/ai/provider'

const TRANSLATION_SYSTEM_PROMPT = `You are a precise technical translator. Translate the given English AI tool descriptions into natural, professional Simplified Chinese (简体中文) for developers.

Rules:
- Keep technical terms, product names, framework names, and proper nouns in English (e.g. "LangChain", "MCP", "RAG", "LLM", "GitHub")
- Translate surrounding prose naturally — not word-for-word
- Be concise: match the brevity of the original
- Return ONLY valid JSON, no markdown fences:
{"summary_zh":"<translated summary>","why_it_matters_zh":"<translated why it matters>"}`

const BATCH_SIZE = 30

/**
 * Delay between translation calls.
 * Local Ollama needs a longer pause — the 400ms cloud default leaves no
 * thermal headroom when the GPU is doing all inference work locally.
 * With OPENAI_BASE_URL pointing to localhost we use 3 s, which keeps
 * the M-series chip below sustained-load temps and leaves the GPU free
 * to render the display between calls.
 */
const isLocalOllama = (process.env.OPENAI_BASE_URL ?? '').includes('localhost')
const REQUEST_DELAY_MS = isLocalOllama ? 3000 : 400

/**
 * Max items per run when using local Ollama.
 * Prevents multi-hour sustained GPU sessions that make the machine
 * unresponsive. Run the script multiple times across different sessions
 * to translate a large backlog incrementally.
 */
const LOCAL_MAX_ITEMS = 100

interface TranslationResult {
  summary_zh: string
  why_it_matters_zh: string
}

async function translateItem(
  summary: string,
  whyItMatters: string | null,
): Promise<TranslationResult | null> {
  const userMessage = [
    `Summary: ${summary}`,
    whyItMatters ? `Why it matters: ${whyItMatters}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const raw = await callAi({
      systemPrompt: TRANSLATION_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 400,
    })

    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned) as Partial<TranslationResult>

    if (!parsed.summary_zh?.trim()) return null

    return {
      summary_zh: parsed.summary_zh.trim(),
      why_it_matters_zh: parsed.why_it_matters_zh?.trim() ?? '',
    }
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export interface TranslationRunResult {
  translated: number
  failed: number
  skipped: number
}

/**
 * Translate up to `limit` enriched items that have no Chinese summary yet.
 * Safe to call daily — idempotent (skips already-translated items).
 */
export async function runTranslation(
  limit = BATCH_SIZE,
): Promise<TranslationRunResult> {
  // Clamp to LOCAL_MAX_ITEMS when running against local Ollama to prevent
  // sustained GPU load that makes the machine unresponsive.
  const effectiveLimit = isLocalOllama ? Math.min(limit, LOCAL_MAX_ITEMS) : limit
  if (isLocalOllama && limit > LOCAL_MAX_ITEMS) {
    console.log(
      `[translation] Local Ollama detected — clamping limit from ${limit} → ${LOCAL_MAX_ITEMS} (thermal safety). Re-run to continue the backlog.`,
    )
  }

  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('items')
    .select('id, ai_summary, ai_why_it_matters')
    .eq('status', 'enriched')
    .not('ai_summary', 'is', null)
    .is('ai_summary_zh', null)
    .order('ranking_score', { ascending: false })
    .limit(effectiveLimit)

  if (error) {
    console.error('[translation] Fetch failed:', error.message)
    return { translated: 0, failed: 0, skipped: 0 }
  }

  type Row = { id: string; ai_summary: string; ai_why_it_matters: string | null }
  const items = (data ?? []) as Row[]

  let translated = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (!item.ai_summary?.trim()) {
      skipped++
      continue
    }

    const result = await translateItem(item.ai_summary, item.ai_why_it_matters)

    if (!result) {
      console.warn(`[translation] Failed for item ${item.id}`)
      failed++
    } else {
      const { error: updateErr } = await supabase
        .from('items')
        .update({
          ai_summary_zh: result.summary_zh,
          ai_why_it_matters_zh: result.why_it_matters_zh || null,
        })
        .eq('id', item.id)

      if (updateErr) {
        console.error(`[translation] DB write failed for ${item.id}:`, updateErr.message)
        failed++
      } else {
        translated++
      }
    }

    if (i < items.length - 1) await sleep(REQUEST_DELAY_MS)
  }

  return { translated, failed, skipped }
}
