/**
 * Homepage data-fetching helpers.
 * All functions use the service-role server client — never import from client components.
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
>

const ITEM_SELECT = [
  'id', 'title', 'url', 'source', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score',
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
// Highest composite ranking_score items — likely GitHub-heavy, which is fine.

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

// ── Section 2: Latest High-Signal ────────────────────────────────────────────
// Recent items with decent relevance — surfaces RSS/HN articles alongside GitHub.

export async function getLatestHighSignal(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .gte('ai_relevance_score', 0.5)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('ranking_score', { ascending: false })
      .limit(8),
  )
}

// ── Section 3: Trending GitHub Projects ──────────────────────────────────────

export async function getTrendingGithub(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .eq('source', 'github')
      .gte('ai_relevance_score', 0.5)
      .order('ranking_score', { ascending: false })
      .limit(8),
  )
}

// ── Section 4: AI News & Research ────────────────────────────────────────────
// RSS / HN articles in model, research, or infra categories.

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
      .limit(8),
  )
}

// ── Section 5: Agent & MCP Tools ─────────────────────────────────────────────

const AGENT_CATEGORIES = [
  'AI Agents',
  'MCP / Tool Use',
  'Code Agents',
  'Workflow Automation',
]

export async function getAgentTools(): Promise<HomepageItem[]> {
  return safeQuery<HomepageItem>((sb) =>
    sb
      .from('items')
      .select(ITEM_SELECT)
      .eq('status', 'enriched')
      .in('ai_category', AGENT_CATEGORIES)
      .gte('ai_relevance_score', 0.6)
      .order('ranking_score', { ascending: false })
      .limit(8),
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface HomepageStats {
  total: number
  github: number
  hackernews: number
  rss: number
}

export async function getHomepageStats(): Promise<HomepageStats> {
  const supabase = createServerClient()
  const [
    { count: total },
    { count: github },
    { count: hackernews },
    { count: rss },
  ] = await Promise.all([
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'github'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'hackernews'),
    supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'enriched').eq('source', 'rss'),
  ])
  return {
    total:      total      ?? 0,
    github:     github     ?? 0,
    hackernews: hackernews ?? 0,
    rss:        rss        ?? 0,
  }
}
