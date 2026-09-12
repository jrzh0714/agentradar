import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { createServerClient } from '@/lib/supabase/server'

const PAGE_SIZE = 1_000
const MAX_ITEM_URLS = 49_000

// Refresh the cached metadata route as newly enriched items become indexable.
export const revalidate = 3_600

type SitemapItem = {
  id: string
  updated_at: string
}

async function getItemEntries(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerClient()
  const items: SitemapItem[] = []

  for (let from = 0; from < MAX_ITEM_URLS; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, MAX_ITEM_URLS) - 1
    const { data, error } = await supabase
      .from('items')
      .select('id, updated_at')
      .eq('status', 'enriched')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error

    const page = (data ?? []) as SitemapItem[]
    items.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return items.map((item) => ({
    url: `${SITE_URL}/items/${encodeURIComponent(item.id)}`,
    lastModified: item.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/digest`, changeFrequency: 'weekly', priority: 0.8 },
  ]

  try {
    return [...staticEntries, ...(await getItemEntries())]
  } catch (error) {
    console.error('Failed to add item detail pages to sitemap:', error instanceof Error ? error.message : error)
    return staticEntries
  }
}
