import Parser from 'rss-parser'
import { RssItemSchema } from '@/lib/validation/rss'
import { createServerClient } from '@/lib/supabase/server'
import type { ItemInsert } from '@/lib/db/types'

const parser = new Parser({ timeout: 10000 })

// Only ingest RSS items published within this many days
const RSS_LOOKBACK_DAYS = 30

interface ActiveFeed {
  id: string
  name: string
  url: string
  category_hint: string | null
}

async function getActiveFeeds(): Promise<ActiveFeed[]> {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('rss_feeds')
    .select('id, name, url, category_hint')
    .eq('active', true)

  if (error) throw new Error(`Failed to fetch RSS feeds: ${error.message}`)
  return data ?? []
}

async function fetchFeed(feed: ActiveFeed, cutoff: Date): Promise<ItemInsert[]> {
  const raw = await parser.parseURL(feed.url)
  const results: ItemInsert[] = []

  for (const rawItem of raw.items) {
    const parsed = RssItemSchema.safeParse(rawItem)
    if (!parsed.success) continue

    const item = parsed.data
    const publishedAt = item.isoDate ?? item.pubDate ?? undefined

    // Skip items older than RSS_LOOKBACK_DAYS
    if (publishedAt) {
      const date = new Date(publishedAt)
      if (!isNaN(date.getTime()) && date < cutoff) continue
    }

    results.push({
      title: item.title,
      url: item.link,
      canonical_url: item.link,          // RSS links are canonical by convention
      source: 'rss' as const,
      source_id: item.guid ?? item.link, // guid preferred; fall back to link
      author: item.creator ?? feed.name,
      description: item.contentSnippet?.slice(0, 500) ?? undefined,
      raw_content: item.content ?? undefined,
      raw_data: rawItem as unknown as Record<string, unknown>,
      published_at: publishedAt,
    })
  }

  return results
}

/**
 * Fetch all active RSS feeds from the rss_feeds table and return
 * deduplicated ItemInsert rows published within RSS_LOOKBACK_DAYS days.
 */
export async function fetchRssItems(): Promise<ItemInsert[]> {
  const feeds = await getActiveFeeds()
  console.log(`  Found ${feeds.length} active RSS feeds`)

  const cutoff = new Date(Date.now() - RSS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const seen = new Set<string>()
  const all: ItemInsert[] = []

  for (const feed of feeds) {
    console.log(`  → RSS feed: ${feed.name}`)
    try {
      const items = await fetchFeed(feed, cutoff)
      for (const item of items) {
        if (item.canonical_url && !seen.has(item.canonical_url)) {
          seen.add(item.canonical_url)
          all.push(item)
        }
      }
      console.log(`    ${items.length} recent items, ${seen.size} unique so far`)
    } catch (err) {
      console.error(
        `  ✗ Feed failed: ${feed.name} (${feed.url})`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  return all
}
