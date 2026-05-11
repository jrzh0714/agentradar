import { HN_QUERIES, HN_HITS_PER_QUERY, HN_LOOKBACK_HOURS } from '@/config/hn-queries'
import { HnSearchResponseSchema } from '@/lib/validation/hn'
import type { ItemInsert } from '@/lib/db/types'

const HN_API = 'https://hn.algolia.com/api/v1/search'

async function fetchQuery(query: string, cutoffUnix: number): Promise<ItemInsert[]> {
  const url = new URL(HN_API)
  url.searchParams.set('query', query)
  url.searchParams.set('tags', 'story')
  url.searchParams.set('hitsPerPage', String(HN_HITS_PER_QUERY))
  url.searchParams.set('numericFilters', `created_at_i>${cutoffUnix}`)

  const res = await fetch(url.toString())

  if (!res.ok) {
    throw new Error(`HN Algolia API ${res.status}: ${res.statusText}`)
  }

  const json = await res.json()

  // Validate the outer envelope first
  const envelope = HnSearchResponseSchema.safeParse(json)
  if (!envelope.success) {
    // Envelope failed — try salvaging individual hits from the raw array
    const rawHits: unknown[] = Array.isArray(json?.hits) ? json.hits : []
    if (rawHits.length === 0) {
      console.error('  ✗ HN response validation failed (no hits):', envelope.error.flatten().fieldErrors)
      return []
    }
    // Fall through with raw hits; we'll validate each one below
    const salvaged: ItemInsert[] = []
    for (const rawHit of rawHits) {
      const hit = HnSearchResponseSchema.shape.hits.element.safeParse(rawHit)
      if (hit.success && hit.data.title) {
        const storyUrl = hit.data.url ?? `https://news.ycombinator.com/item?id=${hit.data.objectID}`
        salvaged.push({
          title: hit.data.title,
          url: storyUrl,
          canonical_url: storyUrl,
          source: 'hackernews' as const,
          source_id: hit.data.objectID,
          author: hit.data.author ?? undefined,
          description: hit.data.story_text
            ? hit.data.story_text.replace(/<[^>]*>/g, '').slice(0, 500)
            : undefined,
          raw_data: rawHit as Record<string, unknown>,
          published_at: hit.data.created_at,
          hn_points: hit.data.points ?? undefined,
          hn_comments: hit.data.num_comments ?? undefined,
        })
      }
    }
    return salvaged
  }

  return envelope.data.hits
    .filter((hit) => !!hit.title)
    .map((hit) => {
      // Use story URL if available; fall back to HN item permalink
      const storyUrl = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`
      const canonicalUrl = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`

      return {
        title: hit.title,
        url: storyUrl,
        canonical_url: canonicalUrl,
        source: 'hackernews' as const,
        source_id: hit.objectID,
        author: hit.author ?? undefined,
        description: hit.story_text
          ? hit.story_text.replace(/<[^>]*>/g, '').slice(0, 500)
          : undefined,
        raw_data: hit as unknown as Record<string, unknown>,
        published_at: hit.created_at,
        hn_points: hit.points ?? undefined,
        hn_comments: hit.num_comments ?? undefined,
      }
    })
}

/**
 * Fetch all configured HN queries and return deduplicated ItemInsert rows.
 * Only includes stories from the last HN_LOOKBACK_HOURS hours.
 */
export async function fetchHnItems(): Promise<ItemInsert[]> {
  const cutoffUnix = Math.floor((Date.now() - HN_LOOKBACK_HOURS * 60 * 60 * 1000) / 1000)
  const seen = new Set<string>()
  const all: ItemInsert[] = []

  for (const query of HN_QUERIES) {
    console.log(`  → HN query: "${query}"`)
    try {
      const items = await fetchQuery(query, cutoffUnix)
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
  }

  return all
}
