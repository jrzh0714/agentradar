/**
 * Search helpers for /search.
 * All functions use the service-role server client — never import from client components.
 *
 * Keyword search uses PostgREST ilike across key text columns.
 * Array fields (ai_tags, ai_audience) are excluded from ilike matching because
 * PostgREST does not support ilike on array columns; they are filtered by the
 * source / category / maturity dropdowns instead.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchSort = 'ranking' | 'newest' | 'relevance'

export interface SearchQuery {
  /** Free-text keyword (searches title, description, ai_summary, ai_why_it_matters, ai_category). */
  q?: string
  /** 'all' or a specific ItemSource value. */
  source?: string
  /** Exact ai_category match. */
  category?: string
  /** Exact ai_maturity match. */
  maturity?: string
  /** Minimum ai_relevance_score (0–1). */
  minScore?: number
  sort?: SearchSort
  limit?: number
}

// ── Shared column list (matches HomepageItem) ──────────────────────────────────

const SEARCH_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score',
].join(', ')

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Strip characters that would break the PostgREST or() filter string.
 * Commas split OR clauses; percent/underscore are ilike wildcards the user
 * didn't intend.
 */
function sanitizeTerm(raw: string): string {
  return raw.replace(/[%_,()]/g, ' ').trim()
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function searchItems(query: SearchQuery): Promise<HomepageItem[]> {
  const {
    q,
    source,
    category,
    maturity,
    minScore,
    sort = 'ranking',
    limit = 40,
  } = query

  try {
    const supabase = createServerClient()
    const term = q ? sanitizeTerm(q) : ''

    // Build the filter stage — all methods return the same PostgrestFilterBuilder type
    let sb = supabase
      .from('items')
      .select(SEARCH_SELECT)
      .eq('status', 'enriched')

    if (term) {
      // ilike across all searchable text columns
      sb = sb.or(
        [
          `title.ilike.%${term}%`,
          `description.ilike.%${term}%`,
          `ai_summary.ilike.%${term}%`,
          `ai_why_it_matters.ilike.%${term}%`,
          `ai_category.ilike.%${term}%`,
        ].join(','),
      )
    } else {
      // Default view: surface high-signal items
      sb = sb.gte('ai_relevance_score', 0.5)
    }

    if (source && source !== 'all') {
      sb = sb.eq('source', source)
    }
    if (category) {
      sb = sb.eq('ai_category', category)
    }
    if (maturity) {
      sb = sb.eq('ai_maturity', maturity)
    }
    if (minScore && minScore > 0) {
      sb = sb.gte('ai_relevance_score', minScore)
    }

    // Apply sort + limit and execute — chain after all filters are set.
    // Double-cast through unknown: Supabase loses Result generic info when
    // select() receives a plain string (not a typed column list).
    const sorted =
      sort === 'newest'
        ? sb.order('published_at', { ascending: false, nullsFirst: false })
        : sort === 'relevance'
          ? sb.order('ai_relevance_score', { ascending: false })
          : sb.order('ranking_score', { ascending: false })

    const { data, error } = await sorted.limit(limit)

    if (error) {
      console.error('[search] query error:', error.message)
      return []
    }
    return (data as unknown as HomepageItem[]) ?? []
  } catch (err) {
    console.error('[search] unexpected error:', err)
    return []
  }
}
