/**
 * GitHub ingestion helpers.
 *
 * Quality filters applied per-repo:
 *   1. fork:false in the search query (primary gate)
 *   2. Defensive repo.fork === true check (catches API edge cases)
 *   3. repo.archived === true → skip
 *   4. repo.disabled === true → skip
 *   5. Empty description + fewer than MIN_STARS_NO_DESC stars → skip
 *
 * published_at uses pushed_at (last commit date) so freshness reflects real
 * activity rather than the ingestion timestamp. created_at is preserved in
 * raw_data for auditability.
 */
import { GITHUB_QUERIES, GITHUB_RESULTS_PER_QUERY, GITHUB_INGESTION_BLOCKLIST } from '@/config/github-queries'
import { GithubSearchResponseSchema } from '@/lib/validation/github'
import type { GithubRepo } from '@/lib/validation/github'
import type { ItemInsert } from '@/lib/db/types'

const GITHUB_API = 'https://api.github.com/search/repositories'

/**
 * Repos with no description AND fewer than this many stars are skipped.
 * Repos with many stars but no description are kept — they may be well-known
 * tools with sparse metadata (e.g. minimal CLI utilities).
 */
const MIN_STARS_NO_DESC = 100

// ── Per-query stats ────────────────────────────────────────────────────────────

interface QueryStats {
  fetched:             number
  blocklisted:         number
  forksSkipped:        number
  archivedSkipped:     number
  disabledSkipped:     number
  noDescSkipped:       number
  accepted:            number
}

// ── Token ─────────────────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('Missing GITHUB_TOKEN')
  return token
}

// ── Quality filter ─────────────────────────────────────────────────────────────

// Build a Set for O(1) blocklist lookups
const BLOCKLIST = new Set(GITHUB_INGESTION_BLOCKLIST)

/**
 * Returns a reason string if the repo should be skipped, or null if it's clean.
 */
function rejectReason(repo: GithubRepo): string | null {
  if (BLOCKLIST.has(repo.full_name)) return 'blocklisted'
  if (repo.fork)     return 'fork'
  if (repo.archived) return 'archived'
  if (repo.disabled) return 'disabled'
  const hasDesc = repo.description && repo.description.trim().length > 0
  if (!hasDesc && repo.stargazers_count < MIN_STARS_NO_DESC) return 'no-description'
  return null
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toItemInsert(repo: GithubRepo): ItemInsert {
  return {
    title:         repo.full_name,
    url:           repo.html_url,
    canonical_url: `https://github.com/${repo.full_name}`,
    source:        'github' as const,
    source_id:     repo.full_name,
    author:        repo.owner.login,
    description:   repo.description ?? undefined,
    // Keep the full GitHub API payload — includes fork, archived, created_at
    // for auditability and future filtering without re-fetching.
    raw_data:      repo as unknown as Record<string, unknown>,
    // pushed_at = last commit date, best proxy for content freshness.
    // created_at is stored in raw_data only.
    published_at:  repo.pushed_at ?? undefined,
    github_stars:  repo.stargazers_count,
    github_forks:  repo.forks_count,
    github_language: repo.language ?? undefined,
  }
}

// ── Single-query fetch ────────────────────────────────────────────────────────

async function fetchQuery(
  query: string,
  token: string,
): Promise<{ items: ItemInsert[]; stats: QueryStats }> {
  const stats: QueryStats = {
    fetched: 0, blocklisted: 0, forksSkipped: 0, archivedSkipped: 0,
    disabledSkipped: 0, noDescSkipped: 0, accepted: 0,
  }

  const url = new URL(GITHUB_API)
  url.searchParams.set('q', query)
  url.searchParams.set('sort', 'updated')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(GITHUB_RESULTS_PER_QUERY))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`)
  }

  const json = await res.json()
  const parsed = GithubSearchResponseSchema.safeParse(json)

  if (!parsed.success) {
    console.error('  ✗ GitHub response validation failed:', parsed.error.flatten().fieldErrors)
    return { items: [], stats }
  }

  const accepted: ItemInsert[] = []

  for (const repo of parsed.data.items) {
    stats.fetched++
    const reason = rejectReason(repo)

    if (reason === 'blocklisted')    { stats.blocklisted++;     continue }
    if (reason === 'fork')           { stats.forksSkipped++;    continue }
    if (reason === 'archived')       { stats.archivedSkipped++; continue }
    if (reason === 'disabled')       { stats.disabledSkipped++; continue }
    if (reason === 'no-description') { stats.noDescSkipped++;   continue }

    accepted.push(toItemInsert(repo))
    stats.accepted++
  }

  return { items: accepted, stats }
}

// ── Public export ─────────────────────────────────────────────────────────────

/**
 * Fetch all configured GitHub queries and return deduplicated ItemInsert rows.
 * Applies quality filters (fork / archived / disabled / no-description).
 * Adds a 1-second delay between queries to respect rate limits.
 */
export async function fetchGithubItems(): Promise<ItemInsert[]> {
  const token = getToken()
  const seen  = new Set<string>()
  const all:  ItemInsert[] = []

  // Aggregate stats across all queries
  const totals: QueryStats = {
    fetched: 0, blocklisted: 0, forksSkipped: 0, archivedSkipped: 0,
    disabledSkipped: 0, noDescSkipped: 0, accepted: 0,
  }

  for (const query of GITHUB_QUERIES) {
    console.log(`  → query: "${query}"`)
    try {
      const { items, stats } = await fetchQuery(query, token)

      // Merge stats
      totals.fetched          += stats.fetched
      totals.blocklisted      += stats.blocklisted
      totals.forksSkipped     += stats.forksSkipped
      totals.archivedSkipped  += stats.archivedSkipped
      totals.disabledSkipped  += stats.disabledSkipped
      totals.noDescSkipped    += stats.noDescSkipped
      totals.accepted         += stats.accepted

      console.log(
        `    fetched ${stats.fetched} · ` +
        `blocklisted ${stats.blocklisted} · ` +
        `forks ${stats.forksSkipped} · ` +
        `archived ${stats.archivedSkipped} · ` +
        `disabled ${stats.disabledSkipped} · ` +
        `no-desc ${stats.noDescSkipped} · ` +
        `accepted ${stats.accepted}`,
      )

      // Cross-query deduplication
      let dupes = 0
      for (const item of items) {
        if (item.canonical_url && !seen.has(item.canonical_url)) {
          seen.add(item.canonical_url)
          all.push(item)
        } else {
          dupes++
        }
      }
      if (dupes > 0) console.log(`    (${dupes} cross-query duplicate${dupes !== 1 ? 's' : ''} skipped)`)

    } catch (err) {
      console.error(`  ✗ Query failed: "${query}"`, err instanceof Error ? err.message : err)
    }

    // Respect GitHub Search API secondary rate limit (≥1 req/sec recommended)
    await new Promise((r) => setTimeout(r, 1100))
  }

  console.log('\n  ── Ingestion summary ────────────────────────────────')
  console.log(`  Total fetched    : ${totals.fetched}`)
  console.log(`  Blocklisted      : ${totals.blocklisted}`)
  console.log(`  Forks skipped    : ${totals.forksSkipped}`)
  console.log(`  Archived skipped : ${totals.archivedSkipped}`)
  console.log(`  Disabled skipped : ${totals.disabledSkipped}`)
  console.log(`  No-desc skipped  : ${totals.noDescSkipped}`)
  console.log(`  Accepted         : ${totals.accepted}`)
  console.log(`  Unique (deduped) : ${seen.size}`)
  console.log('  ─────────────────────────────────────────────────────')

  return all
}
