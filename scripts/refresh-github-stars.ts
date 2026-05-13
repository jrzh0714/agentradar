/**
 * Refresh GitHub star and fork counts for existing items.
 *
 * Star counts captured at ingestion time grow stale. This script re-fetches
 * live counts so the discovery filter (MAX_EMERGING_STARS) stays accurate and
 * items that have become "famous" since ingestion are correctly excluded.
 *
 * Usage:
 *   npm run refresh:stars                    # refresh ALL github items
 *   npm run refresh:stars -- --dry-run       # preview changes, no DB writes
 *   npm run refresh:stars -- --limit 100     # cap items processed
 *   npm run refresh:stars -- --stale-days 30 # only items not refreshed in N days
 */
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/db/types'

// ── Config ──────────────────────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com/repos'
const WRITE_CONCURRENCY = 10
const REQUEST_DELAY_MS = 150

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 0

const staleDaysIdx = args.indexOf('--stale-days')
const STALE_DAYS = staleDaysIdx !== -1 && args[staleDaysIdx + 1]
  ? parseInt(args[staleDaysIdx + 1], 10)
  : 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('Missing GITHUB_TOKEN')
  return token
}

/** Extract owner/repo from a GitHub URL. Returns null if not parseable. */
function extractOwnerRepo(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return `${parts[0]}/${parts[1]}`
  } catch {
    return null
  }
}

interface RepoStats {
  stars: number
  forks: number
}

async function fetchRepoStats(ownerRepo: string): Promise<RepoStats | null> {
  try {
    const res = await fetch(`${GITHUB_API}/${ownerRepo}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (res.status === 404) return null
    if (!res.ok) {
      console.warn(`  ⚠ GitHub API ${res.status} for ${ownerRepo}`)
      return null
    }
    const data = await res.json() as { stargazers_count?: number; forks_count?: number }
    return {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
    }
  } catch (err) {
    console.warn(`  ⚠ Fetch error for ${ownerRepo}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⭐  AgentRadar — GitHub Star Refresh')
  console.log(`   Limit      : ${LIMIT > 0 ? LIMIT : 'none (all GitHub items)'}`)
  console.log(`   Stale days : ${STALE_DAYS > 0 ? `only items not refreshed in ${STALE_DAYS}d` : 'all'}`)
  console.log(`   Dry-run    : ${dryRun}\n`)

  const supabase = createServerClient()

  // ── 1. Fetch GitHub items ────────────────────────────────────────────────────
  let query = supabase
    .from('items')
    .select('id, url, github_stars, github_forks, title')
    .eq('source', 'github')
    .not('url', 'is', null)
    .order('created_at', { ascending: true })

  if (STALE_DAYS > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - STALE_DAYS)
    query = query.lt('updated_at', cutoff.toISOString())
  }

  if (LIMIT > 0) query = query.limit(LIMIT)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch items: ${error.message}`)

  const items = (data ?? []) as Array<Pick<Item, 'id' | 'url' | 'github_stars' | 'github_forks' | 'title'>>
  console.log(`  Found ${items.length} GitHub items to check`)

  if (items.length === 0) {
    console.log('  Nothing to refresh.')
    return
  }

  // ── 2. Fetch live stats and detect changes ────────────────────────────────
  interface Change {
    id: string
    title: string
    oldStars: number | null
    newStars: number
    oldForks: number | null
    newForks: number
  }

  const changes: Change[] = []
  let skipped = 0
  let noChange = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const ownerRepo = extractOwnerRepo(item.url)

    if (!ownerRepo) {
      skipped++
      continue
    }

    const stats = await fetchRepoStats(ownerRepo)
    if (!stats) {
      skipped++
      continue
    }

    const starsChanged = stats.stars !== (item.github_stars ?? 0)
    const forksChanged = stats.forks !== (item.github_forks ?? 0)

    if (starsChanged || forksChanged) {
      changes.push({
        id: item.id,
        title: item.title,
        oldStars: item.github_stars,
        newStars: stats.stars,
        oldForks: item.github_forks,
        newForks: stats.forks,
      })
    } else {
      noChange++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Progress: ${i + 1}/${items.length} checked, ${changes.length} changes found`)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  console.log(`\n  Results:`)
  console.log(`    Checked  : ${items.length}`)
  console.log(`    Changed  : ${changes.length}`)
  console.log(`    No change: ${noChange}`)
  console.log(`    Skipped  : ${skipped}`)

  if (changes.length === 0) {
    console.log('\n  All star counts are current.\n')
    return
  }

  // ── 3. Show preview ────────────────────────────────────────────────────────
  const MAX_PREVIEW = 20
  console.log(`\n  ── Changes (top ${Math.min(changes.length, MAX_PREVIEW)}) ────────────`)
  for (const c of changes.slice(0, MAX_PREVIEW)) {
    const starDelta = c.newStars - (c.oldStars ?? 0)
    const sign = starDelta >= 0 ? '+' : ''
    console.log(`  ${c.title.slice(0, 60)}`)
    console.log(`    ⭐ ${c.oldStars?.toLocaleString() ?? '?'} → ${c.newStars.toLocaleString()} (${sign}${starDelta.toLocaleString()})`)
  }
  if (changes.length > MAX_PREVIEW) {
    console.log(`  ... and ${changes.length - MAX_PREVIEW} more`)
  }

  if (dryRun) {
    console.log('\n  Dry-run — no DB writes.\n')
    return
  }

  // ── 4. Write updates ───────────────────────────────────────────────────────
  console.log(`\n  Writing ${changes.length} updates (${WRITE_CONCURRENCY} concurrent)…`)
  let updated = 0
  let failed = 0

  for (let i = 0; i < changes.length; i += WRITE_CONCURRENCY) {
    const chunk = changes.slice(i, i + WRITE_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map((c) =>
        supabase
          .from('items')
          .update({ github_stars: c.newStars, github_forks: c.newForks })
          .eq('id', c.id)
          .then(({ error: err }) => {
            if (err) throw new Error(err.message)
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

  console.log(`\n  Updated : ${updated}`)
  if (failed > 0) console.log(`  Failed  : ${failed}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
