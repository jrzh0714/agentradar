/**
 * Homepage data-fetching helpers.
 * All functions use the service-role server client — never import from client components.
 *
 * Deduplication strategy: each section fetches more items than displayed (headroom).
 * app/page.tsx filters duplicates in-memory after all queries resolve in parallel.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/db/types'

// ── Shared item shape for all homepage queries ───────────────────────────────

export type HomepageItem = Pick<
  Item,
  | 'id'
  | 'title'
  | 'url'
  | 'source'
  | 'description'
  | 'published_at'
  | 'github_stars'
  | 'github_forks'
  | 'github_language'
  | 'hn_points'
  | 'hn_comments'
  | 'ai_summary'
  | 'ai_why_it_matters'
  | 'ai_category'
  | 'ai_tags'
  | 'ai_maturity'
  | 'ai_relevance_score'
  | 'ranking_score'
  | 'trending'
  | 'ai_summary_zh'
  | 'ai_why_it_matters_zh'
>

const ITEM_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score', 'trending',
  'ai_summary_zh', 'ai_why_it_matters_zh',
].join(', ')

// ── Query helper ─────────────────────────────────────────────────────────────

async function safeQuery<T>(
  fn: (sb: ReturnType<typeof createServerClient>) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  try {
    const supabase = createServerClient()
    const { data, error } = await fn(supabase)
    if (error) {
      console.error('[homepage] query error:', error.message)
      return []
    }
    return (data as T[]) ?? []
  } catch (err) {
    console.error('[homepage] unexpected error:', err)
    return []
  }
}

// ── Section 1: Top Picks ─────────────────────────────────────────────────────
// Highest composite ranking_score — establishes the deduplication baseline.
// Fetches exactly 12 (no headroom needed — it has first priority).

export async function getTopPicks(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .gte('ranking_score', 40)
      .order('ranking_score', { ascending: false })
      .limit(12),
  )
}

// ── Section 2: AI News & Research ────────────────────────────────────────────
// RSS / HN articles in model, research, or infrastructure categories.
// Fetches 16 so dedup against Top Picks still leaves ≥8 unique items.
// (Low real overlap since Top Picks is GitHub-heavy; headroom is precautionary.)

const NEWS_CATEGORIES = [
  'Research',
  'Product Updates',
  'AI Infrastructure',
  'LLM Frameworks',
  'Open Source Models',
]

export async function getAiNews(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .in('source', ['rss', 'hackernews'])
      .in('ai_category', NEWS_CATEGORIES)
      .gte('ai_relevance_score', 0.6)
      .order('ranking_score', { ascending: false })
      .limit(16),
  )
}

// ── Section 3: Latest High-Signal Updates ────────────────────────────────────
// Only RSS and HN — sorts by publish date to surface genuinely recent content.
// GitHub is excluded because the ingester stamps repos with today's date,
// which would otherwise crowd out real articles.
// Fetches 16 for dedup headroom against Top Picks + AI News.

export async function getLatestHighSignal(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .in('source', ['rss', 'hackernews'])
      .gte('ai_relevance_score', 0.5)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(16),
  )
}

// ── Section 4: Agent & MCP Tools ─────────────────────────────────────────────
// Fetches 28 (12 Top Picks + up to 8 AI News + 8 buffer = 28 to guarantee 8 unique).
// Deduplication against all prior sections happens in app/page.tsx.

const AGENT_CATEGORIES = [
  'AI Agents',
  'MCP / Tool Use',
  'Code Agents',
  'Workflow Automation',
]

export async function getAgentTools(limit = 28): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .in('ai_category', AGENT_CATEGORIES)
      .gte('ai_relevance_score', 0.6)
      .order('ranking_score', { ascending: false })
      .limit(limit),
  )
}

// ── Trending ─────────────────────────────────────────────────────────────────
// Items explicitly flagged trending=true by the enrichment pipeline.
// Ordered by ranking_score so the highest-signal items float first.

export async function getTrendingItems(limit = 8): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .eq('trending', true)
      .order('ranking_score', { ascending: false })
      .limit(limit),
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface HomepageStats {
  total: number
  github: number
  hackernews: number
  rss: number
  /** ISO timestamp of the most recently enriched item, or null if none. */
  lastUpdatedAt: string | null
}

// ── Weekly Highlights ─────────────────────────────────────────────────────────
// Up-and-coming items from the last 7 days. GitHub repos above MAX_STARS are
// already well-known and excluded — AgentRadar is for discovery, not for
// surfacing projects that are already household names.
// RSS and HN items (github_stars IS NULL) are never filtered out by this cap.

/** GitHub star ceiling for "emerging" discovery sections. */
export const MAX_EMERGING_STARS = 10_000

const HIGHLIGHT_CATEGORIES = [
  'AI Agents',
  'MCP / Tool Use',
  'Code Agents',
  'Workflow Automation',
  'LLM Frameworks',
  'Research',
  'Product Updates',
  'AI Infrastructure',
  'Open Source Models',
]

export async function getWeeklyHighlights(): Promise<HomepageItem[]> {
  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString()

  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .in('ai_category', HIGHLIGHT_CATEGORIES)
      .gte('ai_relevance_score', 0.6)
      .gte('published_at', sinceStr)
      .or(`github_stars.is.null,github_stars.lt.${MAX_EMERGING_STARS}`)
      .order('ranking_score', { ascending: false })
      .limit(8),
  )
}

export async function getHomepageStats(): Promise<HomepageStats> {
  const supabase = createServerClient()
  const [
    { count: total },
    { count: github },
    { count: hackernews },
    { count: rss },
    { data: latestRow },
  ] = await Promise.all([
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'github'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'hackernews'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'rss'),
    supabase.from('items').select('updated_at').eq('status', 'enriched').order('updated_at', { ascending: false }).limit(1),
  ])
  const lastUpdatedAt = (latestRow as Array<{ updated_at: string }> | null)?.[0]?.updated_at ?? null
  return {
    total:         total      ?? 0,
    github:        github     ?? 0,
    hackernews:    hackernews ?? 0,
    rss:           rss        ?? 0,
    lastUpdatedAt,
  }
}
