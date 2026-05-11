export type Source = 'github' | 'hn' | 'rss'

export interface Item {
  id: string
  source: Source
  source_id: string
  title: string
  url: string
  description: string | null
  author: string | null
  published_at: string
  ingested_at: string
  raw_data: Record<string, unknown>
  enriched: boolean
  enrichment_failed: boolean
  tldr: string | null
  tags: string[] | null
  relevance_score: number | null
  rank_score: number | null
}

export interface Digest {
  id: string
  week_start: string
  title: string
  intro: string
  top_item_ids: string[]
  generated_at: string
  published: boolean
}

export interface RssFeed {
  id: string
  name: string
  url: string
  active: boolean
}

export type ItemPreview = Pick<
  Item,
  'id' | 'source' | 'title' | 'url' | 'tldr' | 'description' | 'tags' | 'published_at' | 'rank_score' | 'enriched'
>
