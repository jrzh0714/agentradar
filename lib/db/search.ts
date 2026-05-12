/**
 * Search helpers for /search.
 * All functions use the service-role server client — never import from client components.
 *
 * Keyword search uses PostgREST ilike across all text columns.
 * For array columns (ai_tags, ai_audience), single-word terms use the `cs`
 * (array-contains) operator for exact element matching; multi-word terms rely
 * on the text-column ilike matches instead.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DateRange = 'all' | '1d' | '7d' | '30d' | '90d'

export type SearchSort = 'ranking' | 'newest' | 'relevance' | 'stars' | 'discussed'

export interface SearchQuery {
  /** Free-text keyword (searches title, description, ai_summary, ai_why_it_matters, ai_category, source, and array columns). */
  q?: string
  /** 'all' or a specific source value. */
  source?: string
  /** Exact ai_category match. */
  category?: string
  /** Exact ai_maturity match. */
  maturity?: string
  /** Minimum ai_relevance_score (0–1). */
  minScore?: number
  /** Date range filter on published_at. */
  dateRange?: DateRange
  sort?: SearchSort
  limit?: number
}

// ── Column list ───────────────────────────────────────────────────────────────

const SEARCH_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score',
].join(', ')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip characters that would break the PostgREST or() filter string.
 * Commas split OR clauses; percent/underscore are unintended ilike wildcards;
 * braces/parens interfere with array and group syntax.
 */
function sanitizeTerm(raw: string): string {
  return raw.replace(/[%_,(){}[\]]/g, ' ').trim()
}

/** Compute the ISO timestamp cutoff for a date range. Returns null for 'all'. */
function getDateCutoff(range: DateRange): string | null {
  if (range === 'all' || !range) return null
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function searchItems(query: SearchQuery): Promise<HomepageItem[]> {
  const {
    q,
    source,
    category,
    maturity,
    minScore,
    dateRange = 'all',
    sort = 'ranking',
    limit = 60,
  } = query

  try {
    const supabase = createServerClient()
    const term = q ? sanitizeTerm(q) : ''

    let sb = supabase
      .from('items')
      .select(SEARCH_SELECT)
      .eq('status', 'enriched')

    // ── Keyword filter ────────────────────────────────────────────────────────
    if (term) {
      // Text columns: ilike (case-insensitive substring match)
      const orParts: string[] = [
        `title.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `ai_summary.ilike.%${term}%`,
        `ai_why_it_matters.ilike.%${term}%`,
        `ai_category.ilike.%${term}%`,
        `source.ilike.%${term}%`,
      ]
      // Array columns: exact element containment for single-word terms.
      // Multi-word terms are covered by the text column matches above.
      if (!term.includes(' ')) {
        orParts.push(`ai_tags.cs.{${term}}`)
        orParts.push(`ai_audience.cs.{${term}}`)
      }
      sb = sb.or(orParts.join(','))
    } else {
      // No keyword — default view: high-signal items only
      sb = sb.gte('ai_relevance_score', 0.5)
    }

    // ── Facet filters ─────────────────────────────────────────────────────────
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

    // ── Date range filter ─────────────────────────────────────────────────────
    const cutoff = getDateCutoff(dateRange)
    if (cutoff) {
      sb = sb.gte('published_at', cutoff)
    }

    // ── Sort + execute ────────────────────────────────────────────────────────
    // Double-cast through unknown: Supabase loses Result generic info when
    // select() receives a plain string (not a typed column list).
    const sorted =
      sort === 'newest'
        ? sb.order('published_at', { ascending: false, nullsFirst: false })
        : sort === 'relevance'
          ? sb.order('ai_relevance_score', { ascending: false })
          : sort === 'stars'
            ? sb.order('github_stars', { ascending: false, nullsFirst: false })
            : sort === 'discussed'
              ? sb.order('hn_points', { ascending: false, nullsFirst: false })
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
