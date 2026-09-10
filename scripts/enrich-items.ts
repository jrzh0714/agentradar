/**
 * Enrich raw items with AI-generated metadata.
 *
 * Usage:
 *   npm run enrich                          # process up to 10 new/failed items
 *   npm run enrich -- --limit 25            # process up to 25 items
 *   npm run enrich -- --dry-run             # list items, skip AI calls and DB writes
 *   npm run enrich -- --mock                # use mock provider (no API key required)
 *   npm run enrich -- --limit 5 --mock      # mock, 5 items, writes to DB
 *   npm run enrich -- --dry-run --mock      # mock + preview output, no DB writes
 *   npm run enrich -- --dry-run --eval --limit 3  # real provider eval, no DB writes
 */
import { config } from 'dotenv'

// tsx sometimes injects empty strings for long API key values from .env.local,
// so we load with override:true to correct those. We first snapshot any vars
// the user explicitly set in the shell so we can restore them afterward —
// explicit shell values always win for provider, model, credentials, and budget.
const SHELL_PASSTHROUGH = [
  'AI_PROVIDER',
  'AI_MODEL',
  'ANTHROPIC_MODEL',
  'OPENAI_MODEL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MAX_DAILY_AI_COST_USD',
] as const
const shellSnapshot = Object.fromEntries(
  SHELL_PASSTHROUGH.map((k) => [k, process.env[k]]),
) as Record<(typeof SHELL_PASSTHROUGH)[number], string | undefined>

config({ path: '.env.local', override: true })

for (const key of SHELL_PASSTHROUGH) {
  if (shellSnapshot[key] !== undefined) process.env[key] = shellSnapshot[key]
}

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import { enrichItem } from '@/lib/ai/enrich'
import { ProviderRequestError, activeModel } from '@/lib/ai/provider'
import { parseBoundedPositiveInt } from '@/lib/http/limits'
import {
  assertWithinDailyAiBudget,
  estimateStandaloneEnrichmentCost,
  parseDailyAiBudget,
} from '@/lib/workflows/cost-estimation'
import type { Item, ItemEnrichmentUpdate } from '@/lib/db/types'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const evalMode = args.includes('--eval')
const mockMode = args.includes('--mock')
const limitIdx = args.indexOf('--limit')
const requestedLimit = parseBoundedPositiveInt(
  limitIdx !== -1 ? args[limitIdx + 1] : null,
  { fallback: 10, max: 500 },
)
const LIMIT = evalMode ? Math.min(requestedLimit, 10) : requestedLimit
const DELAY_MS = 500

// --mock overrides AI_PROVIDER before any AI module reads it
if (mockMode) process.env.AI_PROVIDER = 'mock'

// Real providers: skip AI calls during dry-run to avoid charges.
// Mock: still call it (free, useful for output preview).
const skipAiCalls = dryRun && !mockMode && !evalMode

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPendingItems(limit: number): Promise<Item[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or('status.eq.new,ai_summary.is.null')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`Failed to fetch items: ${error.message}`)
  return (data ?? []) as Item[]
}

async function saveEnrichment(itemId: string, update: ItemEnrichmentUpdate): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase.from('items').update(update).eq('id', itemId)
  if (error) throw new Error(`DB update failed: ${error.message}`)
}

async function saveFailure(itemId: string, errorMessage: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('items')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', itemId)
  if (error) throw new Error(`DB failure update failed: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (evalMode && !dryRun) {
    throw new Error('--eval must be combined with --dry-run so model output cannot mutate the database')
  }

  const provider = process.env.AI_PROVIDER ?? 'openai'
  const model = activeModel()

  console.log(`\n🤖 AgentRadar — AI Enrichment`)
  console.log(`   Provider : ${provider}`)
  console.log(`   Model    : ${model}`)
  console.log(`   Limit    : ${LIMIT}`)
  console.log(`   Dry-run  : ${dryRun}\n`)
  if (evalMode) console.log('   Eval mode: real model calls enabled; database writes disabled\n')

  const items = await fetchPendingItems(LIMIT)
  console.log(`  Selected : ${items.length} item(s) pending enrichment\n`)

  if (!skipAiCalls && !mockMode) {
    const estimatedUsd = estimateStandaloneEnrichmentCost(items.length, model)
    const maxDailyAiCostUsd = parseDailyAiBudget(process.env.MAX_DAILY_AI_COST_USD)
    assertWithinDailyAiBudget(estimatedUsd, maxDailyAiCostUsd)
    console.log(`  Cost cap : up to $${estimatedUsd.toFixed(4)} of $${maxDailyAiCostUsd.toFixed(2)}\n`)
  }

  if (items.length === 0) {
    console.log('  Nothing to do — all items are already enriched.')
    return
  }

  let enriched = 0
  let failed = 0
  let skipped = 0
  let providerError: ProviderRequestError | null = null

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const prefix = `  [${i + 1}/${items.length}]`
    console.log(`${prefix} ${item.title.slice(0, 80)}`)
    console.log(`         source=${item.source} id=${item.id}`)

    if (skipAiCalls) {
      console.log(`         ⏭  dry-run — skipping AI call`)
      skipped++
      continue
    }

    try {
      const result = await enrichItem(item)

      if (result.success) {
        const u = result.update
        if (dryRun) {
          // Mock + dry-run: show output, don't write
          console.log(
            `         ✓ (dry-run) category="${u.ai_category}" maturity="${u.ai_maturity}" score=${u.ai_relevance_score}`,
          )
          console.log(`              tags: ${u.ai_tags.join(', ')}`)
          enriched++
        } else {
          await saveEnrichment(item.id, u)
          console.log(
            `         ✓ enriched — category="${u.ai_category}" score=${u.ai_relevance_score}`,
          )
          enriched++
        }
      } else {
        if (!dryRun) await saveFailure(item.id, result.error)
        console.log(`         ✗ failed — ${result.error}`)
        failed++
      }
    } catch (err) {
      if (err instanceof ProviderRequestError) {
        providerError = err
        break // stop batch — do not mark this item as failed
      }

      const msg = err instanceof Error ? err.message : String(err)
      console.error(`         ✗ error — ${msg}`)
      if (!dryRun) {
        try {
          await saveFailure(item.id, msg)
        } catch {
          // best-effort; don't crash the loop
        }
      }
      failed++
    }

    // Delay between calls — skipped for mock (no cost) and after the last item
    if (!mockMode && !providerError && i < items.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  // ── Provider error ──────────────────────────────────────────────────────────
  if (providerError) {
    console.error(`\n  ⚠  Batch stopped early — provider request failed`)
    console.error(`     ${providerError.message}`)
    console.error(`     Resolve provider access or quota, then re-run; the item was not marked failed.`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n  ── Summary ──────────────────────────────`)
  console.log(`  Provider : ${provider} (${model})`)
  console.log(`  Selected : ${items.length}`)
  if (skipAiCalls) {
    console.log(`  Skipped  : ${skipped} (dry-run, no AI calls made)`)
  } else {
    console.log(`  Enriched : ${enriched}`)
    console.log(`  Failed   : ${failed}`)
    if (skipped > 0) console.log(`  Skipped  : ${skipped}`)
  }
  console.log()

  if (providerError) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
