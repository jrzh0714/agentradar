/**
 * Cleanup script: remove GitHub rows that are known data artifacts.
 *
 * Two passes:
 *   1. Delete rows where raw_data.fork = true (any source_id).
 *      These may have inflated star/fork counts inherited from their upstream.
 *   2. Delete a hardcoded list of known-bad source_ids identified by audit.
 *
 * Safe to re-run — both passes are idempotent.
 *
 * Usage:
 *   npm run cleanup:github              # live delete
 *   npm run cleanup:github -- --dry-run # report only, no deletes
 */
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createClient } from '@supabase/supabase-js'
import { GITHUB_INGESTION_BLOCKLIST } from '@/config/github-queries'

// ── Known-bad source_ids — driven by the shared ingestion blocklist ────────────
// Adding a repo to GITHUB_INGESTION_BLOCKLIST in config/github-queries.ts is the
// single source of truth; this script removes those same rows from the DB.
const KNOWN_BAD_SOURCE_IDS: string[] = GITHUB_INGESTION_BLOCKLIST

// ── Entry ─────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(`=== GitHub artifact cleanup ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'} ===\n`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const sb = createClient(url, key, { auth: { persistSession: false } })

  // ── Pass 1: rows where raw_data->>'fork' = 'true' ──────────────────────────
  console.log('Pass 1: rows where raw_data.fork = true (DB-wide fork scan)')

  const { data: forkRows, error: forkSelectErr } = await sb
    .from('items')
    .select('id, title, source_id, github_stars')
    .eq('source', 'github')
    .filter('raw_data->>fork', 'eq', 'true')

  if (forkSelectErr) {
    console.error('  ✗ Fork scan failed:', forkSelectErr.message)
  } else if (!forkRows || forkRows.length === 0) {
    console.log('  ✓ No fork rows found in DB')
  } else {
    console.log(`  Found ${forkRows.length} fork row(s):`)
    forkRows.forEach((r) =>
      console.log(`    - ${r.source_id ?? r.title}  ⭐ ${r.github_stars ?? '?'}`),
    )

    if (!DRY_RUN) {
      const ids = forkRows.map((r) => r.id)
      const { error: delErr } = await sb.from('items').delete().in('id', ids)
      if (delErr) {
        console.error('  ✗ Delete failed:', delErr.message)
      } else {
        console.log(`  ✓ Deleted ${forkRows.length} fork row(s)`)
      }
    } else {
      console.log('  [dry-run] Would delete the above rows')
    }
  }

  // ── Pass 2: known-bad source_ids from the quality audit ────────────────────
  console.log('\nPass 2: known-bad source_ids from audit')

  const { data: knownBad, error: knownSelectErr } = await sb
    .from('items')
    .select('id, title, source_id, github_stars')
    .eq('source', 'github')
    .in('source_id', KNOWN_BAD_SOURCE_IDS)

  if (knownSelectErr) {
    console.error('  ✗ Known-bad scan failed:', knownSelectErr.message)
  } else if (!knownBad || knownBad.length === 0) {
    console.log('  ✓ Known-bad records already absent (possibly removed in Pass 1)')
  } else {
    console.log(`  Found ${knownBad.length} known-bad row(s):`)
    knownBad.forEach((r) =>
      console.log(`    - ${r.source_id}  ⭐ ${r.github_stars ?? '?'}`),
    )

    if (!DRY_RUN) {
      const ids = knownBad.map((r) => r.id)
      const { error: delErr } = await sb.from('items').delete().in('id', ids)
      if (delErr) {
        console.error('  ✗ Delete failed:', delErr.message)
      } else {
        console.log(`  ✓ Deleted ${knownBad.length} known-bad row(s)`)
      }
    } else {
      console.log('  [dry-run] Would delete the above rows')
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const { count } = await sb
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'github')

  console.log(`\n✓ Done. GitHub rows remaining in DB: ${count ?? '?'}`)

  if (DRY_RUN) {
    console.log('\nRe-run without --dry-run to apply deletions.')
  } else {
    console.log('\nNext steps:')
    console.log('  npm run ingest:github   # re-ingest with fork:false queries')
    console.log('  npm run enrich          # enrich any new rows')
    console.log('  npm run rank            # recompute ranking scores')
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
