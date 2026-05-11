import { GITHUB_QUERIES, GITHUB_RESULTS_PER_QUERY } from '@/config/github-queries'
import { GithubSearchResponseSchema } from '@/lib/validation/github'
import type { ItemInsert } from '@/lib/db/types'

const GITHUB_API = 'https://api.github.com/search/repositories'

function getToken(): string {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('Missing GITHUB_TOKEN')
  return token
}

async function fetchQuery(query: string, token: string): Promise<ItemInsert[]> {
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
    return []
  }

  return parsed.data.items.map((repo) => ({
    title: repo.full_name,
    url: repo.html_url,
    canonical_url: `https://github.com/${repo.full_name}`,
    source: 'github' as const,
    source_id: repo.full_name,
    author: repo.owner.login,
    description: repo.description ?? undefined,
    raw_data: repo as unknown as Record<string, unknown>,
    published_at: repo.pushed_at ?? repo.created_at ?? undefined,
    github_stars: repo.stargazers_count,
    github_forks: repo.forks_count,
    github_language: repo.language ?? undefined,
  }))
}

/**
 * Fetch all configured GitHub queries and return deduplicated ItemInsert rows.
 * Adds a 1-second delay between queries to respect rate limits.
 */
export async function fetchGithubItems(): Promise<ItemInsert[]> {
  const token = getToken()
  const seen = new Set<string>()
  const all: ItemInsert[] = []

  for (const query of GITHUB_QUERIES) {
    console.log(`  → GitHub query: "${query}"`)
    try {
      const items = await fetchQuery(query, token)
      for (const item of items) {
        if (item.canonical_url && !seen.has(item.canonical_url)) {
          seen.add(item.canonical_url)
          all.push(item)
        }
      }
      console.log(`    ${items.length} results, ${seen.size} unique so far`)
    } catch (err) {
      console.error(`  ✗ Query failed: "${query}"`, err instanceof Error ? err.message : err)
    }

    // Respect GitHub Search API secondary rate limit (1 req/sec recommended)
    await new Promise((r) => setTimeout(r, 1100))
  }

  return all
}
