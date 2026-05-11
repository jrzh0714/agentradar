/**
 * Compute and persist ranking scores for all enriched items.
 *
 * Usage:
 *   npm run rank                   # rank all enriched items, write to DB
 *   npm run rank -- --dry-run      # compute scores, print top 20, no DB writes
 *   npm run rank -- --limit 200    # rank only the first 200 enriched items
 */
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import { computeRankingScore } from '@/lib/ranking/score'
import type { Item } from '@/lib/db/types'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 0  // 0 = no limit

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchEnrichedItems(limit: number): Promise<Item[]> {
  const supabase = createServerClient()
  let query = supabase
    .from('items')
    .select('*')
    .eq('status', 'enriched')
    .not('ai_relevance_score', 'is', null)
    .order('created_at', { ascending: true })

  if (limit > 0) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch items: ${error.message}`)
  return (data ?? []) as Item[]
}

async function saveRankingScore(itemId: string, score: number): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('items')
    .update({ ranking_score: score })
    .eq('id', itemId)
  if (error) throw new Error(`DB update failed for ${itemId}: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏆 AgentRadar — Ranking`)
  console.log(`   Limit    : ${LIMIT > 0 ? LIMIT : 'none (all enriched)'}`)
  console.log(`   Dry-run  : ${dryRun}\n`)

  const items = await fetchEnrichedItems(LIMIT)
  console.log(`  Loaded : ${items.length} enriched item(s)\n`)

  if (items.length === 0) {
    console.log('  Nothing to rank — run enrichment first.')
    return
  }

  // Compute maxStars across the corpus for normalised GitHub momentum
  const maxStars = items.reduce((max, item) => Math.max(max, item.github_stars ?? 0), 0)
  console.log(`  maxStars (corpus) : ${maxStars.toLocaleString()}\n`)

  // Score every item
  const scored = items.map((item) => {
    const breakdown = computeRankingScore(item, { maxStars })
    return { item, score: breakdown.final }
  })

  // Sort descending for reporting
  const sorted = [...scored].sort((a, b) => b.score - a.score)

  if (dryRun) {
    // ── Dry-run: print top 20, no DB writes ───────────────────────────────────
    console.log('  ── Top 20 (dry-run preview) ─────────────────────────────────')
    const top20 = sorted.slice(0, 20)
    top20.forEach(({ item, score }, i) => {
      const rel = (item.ai_relevance_score! * 10).toFixed(1)
      const stars = item.github_stars != null ? `⭐${item.github_stars.toLocaleString()}` : ''
      const hn = item.hn_points != null ? `▲${item.hn_points}` : ''
      console.log(
        `  ${String(i + 1).padStart(2)}. [${score.toFixed(2).padStart(5)}] ${item.title.slice(0, 70)}`,
      )
      console.log(
        `       rel=${rel}/10  src=${item.source}  cat=${item.ai_category ?? '—'}  ${stars}${hn}`,
      )
    })
    console.log()
  } else {
    // ── Live run: write scores to DB ──────────────────────────────────────────
    let updated = 0
    let failed = 0

    for (const { item, score } of scored) {
      try {
        await saveRankingScore(item.id, score)
        updated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ✗ ${item.id}: ${msg}`)
        failed++
      }
    }

    console.log(`  Updated : ${updated}`)
    if (failed > 0) console.log(`  Failed  : ${failed}`)

    // ── Print top 20 after live run ───────────────────────────────────────────
    console.log('\n  ── Top 20 ───────────────────────────────────────────────────')
    const top20 = sorted.slice(0, 20)
    top20.forEach(({ item, score }, i) => {
      const rel = (item.ai_relevance_score! * 10).toFixed(1)
      const stars = item.github_stars != null ? `⭐${item.github_stars.toLocaleString()}` : ''
      const hn = item.hn_points != null ? `▲${item.hn_points}` : ''
      console.log(
        `  ${String(i + 1).padStart(2)}. [${score.toFixed(2).padStart(5)}] ${item.title.slice(0, 70)}`,
      )
      console.log(
        `       rel=${rel}/10  src=${item.source}  cat=${item.ai_category ?? '—'}  ${stars}${hn}`,
      )
    })
    console.log()
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const scores = scored.map((s) => s.score)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const max = Math.max(...scores)
  const min = Math.min(...scores)

  console.log('  ── Score distribution ───────────────────────────────────────')
  console.log(`  Items  : ${items.length}`)
  console.log(`  Min    : ${min.toFixed(2)}`)
  console.log(`  Avg    : ${avg.toFixed(2)}`)
  console.log(`  Max    : ${max.toFixed(2)}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
