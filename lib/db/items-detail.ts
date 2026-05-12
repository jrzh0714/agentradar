/**
 * Item detail data-fetching helpers.
 * All functions use the service-role server client — never import from client components.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { Item } from '@/lib/db/types'
import type { HomepageItem } from '@/lib/db/homepage'

// ── DetailItem type ────────────────────────────────────────────────────────────
// Superset of HomepageItem — includes all fields needed for the detail page.
// Structurally assignable to HomepageItem, so DetailItem[] works with ItemCard.

export type DetailItem = Pick<
  Item,
  // All HomepageItem fields:
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
  // Detail-only fields:
  | 'source_id'
  | 'author'
  | 'ai_audience'
  | 'created_at'
>

// ── Column lists ───────────────────────────────────────────────────────────────

const DETAIL_SELECT = [
  'id', 'title', 'url', 'source', 'source_id', 'author', 'description',
  'published_at', 'created_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags',
  'ai_audience', 'ai_maturity', 'ai_relevance_score', 'ranking_score',
].join(', ')

// Matches HomepageItem exactly — used for related items so ItemCard works without a cast.
const RELATED_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags', 'ai_maturity',
  'ai_relevance_score', 'ranking_score',
].join(', ')

// ── getItemById ────────────────────────────────────────────────────────────────

export async function getItemById(id: string): Promise<DetailItem | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('items')
      .select(DETAIL_SELECT)
      .eq('id', id)
      .single()

    if (error || !data) return null
    return data as unknown as DetailItem
  } catch {
    return null
  }
}

// ── getRelatedItems ────────────────────────────────────────────────────────────
//
// Strategy (two-pass):
//   Pass 1 — same ai_category, relevance ≥ 0.5, sorted by ranking_score.
//   Pass 2 — if Pass 1 has fewer than 6, supplement from same source.
//
// Returns at most 6 items, always excluding the current item.

export async function getRelatedItems(item: DetailItem): Promise<HomepageItem[]> {
  try {
    const supabase = createServerClient()
    const related: HomepageItem[] = []
    const seen = new Set<string>([item.id])

    // Pass 1: same category
    if (item.ai_category) {
      const { data } = await supabase
        .from('items')
        .select(RELATED_SELECT)
        .eq('status', 'enriched')
        .eq('ai_category', item.ai_category)
        .gte('ai_relevance_score', 0.5)
        .neq('id', item.id)
        .order('ranking_score', { ascending: false })
        .limit(8)

      for (const row of (data as unknown as HomepageItem[]) ?? []) {
        if (!seen.has(row.id)) {
          seen.add(row.id)
          related.push(row)
        }
      }
    }

    // Pass 2: supplement from same source if needed
    if (related.length < 6) {
      const { data } = await supabase
        .from('items')
        .select(RELATED_SELECT)
        .eq('status', 'enriched')
        .eq('source', item.source)
        .gte('ai_relevance_score', 0.5)
        .neq('id', item.id)
        .order('ranking_score', { ascending: false })
        .limit(12) // extra headroom for in-memory dedup

      for (const row of (data as unknown as HomepageItem[]) ?? []) {
        if (related.length >= 6) break
        if (!seen.has(row.id)) {
          seen.add(row.id)
          related.push(row)
        }
      }
    }

    return related.slice(0, 6)
  } catch {
    return []
  }
}
