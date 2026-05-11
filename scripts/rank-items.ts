/**
 * Compute and persist ranking scores for all enriched items.
 *
 * Paginates through all enriched items in batches (BATCH_SIZE rows each) so
 * Supabase's implicit 1 000-row cap never silently truncates the result set.
 *
 * Usage:
 *   npm run rank                    # rank ALL enriched items, write to DB
 *   npm run rank -- --dry-run       # compute scores, print top 20, no DB writes
 *   npm run rank -- --limit 200     # cap total items (useful for testing)
 *   npm run rank -- --batch-size 250  # override fetch batch size
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
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 0

const batchSizeIdx = args.indexOf('--batch-size')
const BATCH_SIZE = batchSizeIdx !== -1 && args[batchSizeIdx + 1]
  ? parseInt(args[batchSizeIdx + 1], 10)
  : 500

// How many parallel DB writes to fire at once (keeps the live run fast without
// overwhelming the connection pool).
const WRITE_CONCURRENCY = 50

// ── DB helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch all enriched items using range-based pagination so Supabase's implicit
 * 1 000-row cap never silently truncates the result.
 *
 * If `hardLimit` > 0, fetching stops once that many items have been collected.
 */
async function fetchAllEnrichedItems(hardLimit: number, batchSize: number): Promise<Item[]> {
  const supabase = createServerClient()
  const all: Item[] = []
  let from = 0
  let batchNum = 0

  while (true) {
    // If we have a hard limit and have already hit it, stop.
    if (hardLimit > 0 && all.length >= hardLimit) break

    // Clamp the batch end so we never overshoot a hard limit.
    const effectiveBatch = hardLimit > 0
      ? Math.min(batchSize, hardLimit - all.length)
      : batchSize
    const to = from + effectiveBatch - 1

    batchNum++
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('status', 'enriched')
      .not('ai_relevance_score', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw new Error(`Batch ${batchNum} fetch failed: ${error.message}`)

    const rows = (data ?? []) as Item[]
    console.log(`  Batch ${batchNum}: fetched ${rows.length} rows (range ${from}–${to})`)
    all.push(...rows)

    // If fewer rows than requested, we've reached the end.
    if (rows.length < effectiveBatch) break

    from += rows.length
  }

  return all
}

/**
 * Write ranking scores to the DB in parallel bursts of WRITE_CONCURRENCY.
 * Returns counts of { updated, failed }.
 */
async function saveAllScores(
  scored: Array<{ item: Item; score: number }>,
): Promise<{ updated: number; failed: number }> {
  const supabase = createServerClient()
  let updated = 0
  let failed = 0

  // Process in chunks to avoid opening too many connections at once.
  for (let i = 0; i < scored.length; i += WRITE_CONCURRENCY) {
    const chunk = scored.slice(i, i + WRITE_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(({ item, score }) =>
        supabase
          .from('items')
          .update({ ranking_score: score })
          .eq('id', item.id)
          .then(({ error }) => {
            if (error) throw new Error(error.message)
          }),
      ),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') updated++
      else {
        console.error(`  ✗ write error: ${r.reason instanceof Error ? r.reason.message : r.reason}`)
        failed++
      }
    }
  }

  return { updated, failed }
}

// ── Reporting helper ──────────────────────────────────────────────────────────

function printTop20(sorted: Array<{ item: Item; score: number }>, label: string) {
  console.log(`\n  ── ${label} ──────────────────────────────────────────────────`)
  const top = sorted.slice(0, 20)
  top.forEach(({ item, score }, i) => {
    const rel   = (item.ai_relevance_score! * 10).toFixed(1)
    const stars = item.github_stars != null ? ` ⭐${item.github_stars.toLocaleString()}` : ''
    const hn    = item.hn_points    != null ? ` ▲${item.hn_points}pts` : ''
    console.log(
      `  ${String(i + 1).padStart(2)}. [${score.toFixed(2).padStart(5)}] ${item.title.slice(0, 68)}`,
    )
    console.log(
      `       rel=${rel}/10  src=${item.source}  cat=${item.ai_category ?? '—'}${stars}${hn}`,
    )
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🏆 AgentRadar — Ranking`)
  console.log(`   Batch size : ${BATCH_SIZE}`)
  console.log(`   Limit      : ${LIMIT > 0 ? LIMIT : 'none (all enriched)'}`)
  console.log(`   Dry-run    : ${dryRun}\n`)

  // ── 1. Fetch all enriched items (paginated) ─────────────────────────────────
  const items = await fetchAllEnrichedItems(LIMIT, BATCH_SIZE)
  const skipped = items.filter((i) => i.ai_relevance_score === null).length

  console.log(`\n  Total fetched    : ${items.length}`)
  console.log(`  Skipped (no rel) : ${skipped}`)

  if (items.length === 0) {
    console.log('  Nothing to rank — run enrichment first.')
    return
  }

  // ── 2. Compute corpus-wide maxStars for normalised GitHub momentum ────────
  const maxStars = items.reduce((max, item) => Math.max(max, item.github_stars ?? 0), 0)
  console.log(`  maxStars (corpus): ${maxStars.toLocaleString()}`)

  // ── 3. Score every item ────────────────────────────────────────────────────
  const scored = items.map((item) => ({
    item,
    score: computeRankingScore(item, { maxStars }).final,
  }))

  const sorted = [...scored].sort((a, b) => b.score - a.score)
  console.log(`  Total processed  : ${scored.length}`)

  // ── 4. Dry-run or live write ───────────────────────────────────────────────
  if (dryRun) {
    printTop20(sorted, 'Top 20 (dry-run preview)')
    console.log()
  } else {
    console.log(`\n  Writing scores (${WRITE_CONCURRENCY} concurrent)…`)
    const { updated, failed } = await saveAllScores(scored)
    console.log(`  Total updated    : ${updated}`)
    if (failed > 0) console.log(`  Write failures   : ${failed}`)
    printTop20(sorted, 'Top 20')
    console.log()
  }

  // ── 5. Score distribution ──────────────────────────────────────────────────
  const allScores = scored.map((s) => s.score)
  const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length
  const max = Math.max(...allScores)
  const min = Math.min(...allScores)

  console.log('  ── Score distribution ───────────────────────────────────────')
  console.log(`  Total processed : ${scored.length}`)
  console.log(`  Min             : ${min.toFixed(2)}`)
  console.log(`  Avg             : ${avg.toFixed(2)}`)
  console.log(`  Max             : ${max.toFixed(2)}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
