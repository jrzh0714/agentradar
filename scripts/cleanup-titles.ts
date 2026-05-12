/**
 * Cleanup script — fix blank / placeholder titles in the DB.
 *
 * For each item with a bad title this script:
 *   1. Checks raw_data for a usable title field (RSS).
 *   2. Falls back to URL-path derivation.
 *   3. Falls back to first-sentence of description.
 *   4. Skips the row if no better title can be found.
 *
 * HN items are skipped here — their "Show HN:" / "Ask HN:" prefixes are
 * handled at display time by getDisplayTitle() and do not need DB changes.
 *
 * Usage:
 *   npm run cleanup:titles               # fix all recoverable items
 *   npm run cleanup:titles -- --dry-run  # preview without writing
 */
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import {
  normalizeTitle,
  deriveTitleFromUrl,
  deriveTitleFromDescription,
} from '@/lib/ingestion/title'

// ── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Check whether a stored title is considered bad (null, empty, placeholder).
 * This mirrors the logic in normalizeTitle — a title is bad when normalizing
 * it returns null.
 */
function isBadTitle(title: string | null | undefined): boolean {
  return normalizeTitle(title) === null
}

/**
 * Try to extract a title from raw_data, which may contain fields from the
 * original API response (e.g., RSS item title, feed title, etc.).
 */
function titleFromRawData(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  // Common field names across RSS parsers and HN API
  for (const key of ['title', 'feedTitle', 'name']) {
    const val = raw[key]
    if (typeof val === 'string') {
      const n = normalizeTitle(val)
      if (n) return n
    }
  }
  return null
}

/**
 * Given an item with a bad title, find the best replacement title.
 * Returns null if no better title can be derived.
 */
function resolveBetterTitle(item: {
  source: string
  title: string | null
  url: string
  description: string | null
  raw_data: Record<string, unknown> | null
}): string | null {
  // HN items: leave as-is — prefix handling is display-only.
  if (item.source === 'hackernews') return null

  // 1. Try raw_data title fields
  const fromRaw = titleFromRawData(item.raw_data)
  if (fromRaw) return fromRaw

  // 2. Derive from URL path segment
  const fromUrl = deriveTitleFromUrl(item.url)
  if (fromUrl) return fromUrl

  // 3. Derive from description
  const fromDesc = deriveTitleFromDescription(item.description)
  if (fromDesc) return fromDesc

  return null
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createServerClient()

  console.log(`\n🧹 AgentRadar — Title Cleanup`)
  console.log(`   Dry-run: ${dryRun}\n`)

  // Fetch all items — paginated to avoid the 1,000-row cap
  type Row = {
    id: string
    source: string
    title: string | null
    url: string
    description: string | null
    raw_data: Record<string, unknown> | null
  }

  const all: Row[] = []
  let from = 0
  const batchSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, source, title, url, description, raw_data')
      .range(from, from + batchSize - 1)
      .order('created_at', { ascending: true })

    if (error) throw new Error(`Fetch failed: ${error.message}`)
    const rows = (data ?? []) as Row[]
    all.push(...rows)
    if (rows.length < batchSize) break
    from += rows.length
  }

  console.log(`  Scanned: ${all.length} total items`)

  // Find rows with bad titles
  const bad = all.filter((i) => isBadTitle(i.title))
  console.log(`  Bad titles found: ${bad.length}\n`)

  if (bad.length === 0) {
    console.log('  ✓ No bad titles — nothing to fix.')
    return
  }

  // Resolve better titles
  let fixed = 0
  let skipped = 0

  for (const item of bad) {
    const better = resolveBetterTitle(item)

    const before = JSON.stringify(item.title)

    if (!better) {
      console.log(`  ⏭  SKIP  [${item.source}] ${item.id}`)
      console.log(`         before: ${before}`)
      console.log(`         reason: no usable title source found`)
      console.log(`         url:    ${item.url}`)
      skipped++
      continue
    }

    const after = JSON.stringify(better)
    console.log(`  ${dryRun ? '🔍 DRY-RUN' : '✓  UPDATE'} [${item.source}] ${item.id}`)
    console.log(`         before: ${before}`)
    console.log(`         after:  ${after}`)
    console.log(`         url:    ${item.url}`)

    if (!dryRun) {
      const { error } = await supabase
        .from('items')
        .update({ title: better })
        .eq('id', item.id)

      if (error) {
        console.error(`         ✗ DB update failed: ${error.message}`)
      } else {
        fixed++
      }
    } else {
      fixed++
    }
  }

  console.log(`\n  ── Summary ─────────────────────────────────`)
  console.log(`  Bad titles found : ${bad.length}`)
  console.log(`  Fixed (${dryRun ? 'would fix' : 'updated'}): ${fixed}`)
  console.log(`  Skipped          : ${skipped}`)
  if (dryRun) console.log(`\n  Re-run without --dry-run to apply changes.`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
