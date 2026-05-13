// ============================================================
// Database types — mirrors supabase/migrations/001_initial_schema.sql
// ============================================================

export type ItemSource = 'github' | 'hackernews' | 'rss'
export type ItemStatus = 'new' | 'enriched' | 'failed'

// ------------------------------------------------------------
// Item
// ------------------------------------------------------------

export interface Item {
  id: string
  title: string
  url: string
  canonical_url: string | null
  source: ItemSource
  source_id: string | null
  author: string | null
  description: string | null
  raw_content: string | null
  raw_data: Record<string, unknown> | null
  published_at: string | null
  discovered_at: string

  // GitHub-specific
  github_stars: number | null
  github_forks: number | null
  github_language: string | null

  // Hacker News-specific
  hn_points: number | null
  hn_comments: number | null

  // AI enrichment
  ai_summary: string | null
  ai_why_it_matters: string | null
  ai_category: string | null
  ai_tags: string[] | null
  ai_audience: string[] | null
  ai_maturity: string | null
  ai_relevance_score: number | null

  // Translations
  ai_summary_zh: string | null
  ai_why_it_matters_zh: string | null

  // Ranking / pipeline state
  ranking_score: number
  // Trend detection
  trending: boolean
  ranking_score_7d_ago: number | null
  score_snapshot_date: string | null   // 'YYYY-MM-DD'
  needs_reclassification: boolean
  status: ItemStatus
  error_message: string | null

  // Timestamps
  created_at: string
  updated_at: string
}

/** Minimal shape needed to insert a new raw item (before enrichment). */
export interface ItemInsert {
  title: string
  url: string
  canonical_url?: string
  source: ItemSource
  source_id?: string
  author?: string
  description?: string
  raw_content?: string
  raw_data?: Record<string, unknown>
  published_at?: string

  // Source-specific
  github_stars?: number
  github_forks?: number
  github_language?: string
  hn_points?: number
  hn_comments?: number
}

/** Shape for AI enrichment update. */
export interface ItemEnrichmentUpdate {
  ai_summary: string
  ai_why_it_matters: string
  ai_category: string
  ai_tags: string[]
  ai_audience: string[]
  ai_maturity: string
  ai_relevance_score: number
  ranking_score: number
  status: 'enriched'
  updated_at?: string
}

/** Shape when marking an item as failed enrichment. */
export interface ItemFailureUpdate {
  status: 'failed'
  error_message: string
  updated_at?: string
}

/** Lightweight card shape for feed and search results. */
export type ItemCard = Pick<
  Item,
  | 'id'
  | 'title'
  | 'url'
  | 'source'
  | 'author'
  | 'description'
  | 'published_at'
  | 'github_stars'
  | 'github_language'
  | 'hn_points'
  | 'ai_summary'
  | 'ai_category'
  | 'ai_tags'
  | 'ai_relevance_score'
  | 'ranking_score'
  | 'status'
>


// ------------------------------------------------------------
// Digest
// ------------------------------------------------------------

export interface Digest {
  id: string
  title: string
  period_start: string   // ISO date string e.g. '2025-01-06'
  period_end: string     // ISO date string e.g. '2025-01-12'
  summary: string | null
  created_at: string
}

export interface DigestInsert {
  title: string
  period_start: string
  period_end: string
  summary?: string
}

// ------------------------------------------------------------
// DigestItem
// ------------------------------------------------------------

export interface DigestItem {
  digest_id: string
  item_id: string
  rank: number
  section: string | null
}

export interface DigestItemInsert {
  digest_id: string
  item_id: string
  rank: number
  section?: string
}

/** Digest with its items joined. */
export interface DigestWithItems extends Digest {
  digest_items: Array<DigestItem & { item: ItemCard }>
}

// ------------------------------------------------------------
// RssFeed
// ------------------------------------------------------------

export interface RssFeed {
  id: string
  name: string
  url: string
  active: boolean
  category_hint: string | null
  created_at: string
}

export interface RssFeedInsert {
  name: string
  url: string
  active?: boolean
  category_hint?: string
}
