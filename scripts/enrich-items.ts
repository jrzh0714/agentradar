/**
 * Enrich raw items with AI-generated metadata.
 *
 * Usage:
 *   npm run enrich                  # process up to 10 new items
 *   npm run enrich -- --limit 25    # process up to 25 items
 *   npm run enrich -- --dry-run     # fetch items but skip AI calls and DB writes
 */
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import { enrichItem } from '@/lib/ai/enrich'
import type { Item } from '@/lib/db/types'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 10
const DELAY_MS = 500

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchNewItems(limit: number): Promise<Item[]> {
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

async function saveEnrichment(
  itemId: string,
  update: import('@/lib/db/types').ItemEnrichmentUpdate,
): Promise<void> {
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
  console.log(`\n🤖 AgentRadar — AI Enrichment`)
  console.log(`   Limit: ${LIMIT} | Dry-run: ${dryRun}\n`)

  const items = await fetchNewItems(LIMIT)
  console.log(`  Found ${items.length} item(s) to enrich\n`)

  if (items.length === 0) {
    console.log('  Nothing to do.')
    return
  }

  let enriched = 0
  let failed = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const prefix = `  [${i + 1}/${items.length}]`
    console.log(`${prefix} ${item.title.slice(0, 80)}`)
    console.log(`         source=${item.source} id=${item.id}`)

    if (dryRun) {
      console.log(`         ⏭  dry-run — skipping AI call\n`)
      continue
    }

    try {
      const result = await enrichItem(item)

      if (result.success) {
        await saveEnrichment(item.id, result.update)
        console.log(`         ✓ enriched — category="${result.update.ai_category}" score=${result.update.ai_relevance_score}`)
        enriched++
      } else {
        await saveFailure(item.id, result.error)
        console.log(`         ✗ failed — ${result.error}`)
        failed++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`         ✗ error — ${msg}`)
      try {
        await saveFailure(item.id, msg)
      } catch {
        // best-effort; don't crash the loop
      }
      failed++
    }

    // Rate-limit: wait between calls (except after the last item)
    if (i < items.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(`\n  ── Summary ──`)
  if (dryRun) {
    console.log(`  Dry-run complete. ${items.length} item(s) inspected, no writes performed.`)
  } else {
    console.log(`  Enriched: ${enriched}`)
    console.log(`  Failed:   ${failed}`)
    console.log(`  Total:    ${items.length}`)
  }
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
