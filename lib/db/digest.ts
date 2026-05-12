/**
 * Digest data-fetching helpers.
 *
 * Strategy:
 *   - Six fixed sections, each mapped to one or more ai_category values.
 *   - Each section fetches its top-N (FETCH_PER_SECTION) candidates, sorted by
 *     ranking_score desc, with ai_relevance_score >= MIN_RELEVANCE.
 *   - Cross-section deduplication runs in-memory: first section to claim an item
 *     wins. Each section keeps at most ITEMS_PER_SECTION items.
 *   - Sections with zero items after dedup are returned with an empty array so
 *     the page can hide them.
 */
import { createServerClient } from '@/lib/supabase/server'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Config ─────────────────────────────────────────────────────────────────────

/** Items displayed per section. */
export const ITEMS_PER_SECTION = 5

/** Candidates fetched per section before in-memory dedup. 3× gives enough headroom. */
const FETCH_PER_SECTION = 15

/** Minimum relevance score — items below this are noise. */
const MIN_RELEVANCE = 0.5

// ── Column list ───────────────────────────────────────────────────────────────
// Matches HomepageItem exactly so DigestRow can reuse ItemCard's type.

const DIGEST_SELECT = [
  'id', 'title', 'url', 'source', 'description', 'published_at',
  'github_stars', 'github_forks', 'github_language',
  'hn_points', 'hn_comments',
  'ai_summary', 'ai_why_it_matters', 'ai_category', 'ai_tags',
  'ai_maturity', 'ai_relevance_score', 'ranking_score',
].join(', ')

// ── Section definitions ────────────────────────────────────────────────────────

export interface DigestSection {
  /** Short identifier used as an anchor id. */
  slug: string
  /** Display heading. */
  title: string
  /** Brief editorial description shown under the heading. */
  description: string
  /** ai_category values that feed this section. */
  categories: string[]
  /** Populated by getDigestSections(). */
  items: HomepageItem[]
}

export const SECTION_DEFINITIONS: Omit<DigestSection, 'items'>[] = [
  {
    slug: 'agent-frameworks',
    title: 'Top Agent Frameworks',
    description: 'The highest-signal agent platforms, orchestration libraries, and workflow engines.',
    categories: ['AI Agents', 'Workflow Automation'],
  },
  {
    slug: 'model-api-updates',
    title: 'Model & API Updates',
    description: 'New model releases, API changes, and inference infrastructure worth tracking.',
    categories: ['Product Updates', 'AI Infrastructure', 'Open Source Models', 'LLM Frameworks'],
  },
  {
    slug: 'ai-research',
    title: 'AI Research',
    description: 'Papers, benchmarks, and findings that will shape the next generation of AI systems.',
    categories: ['Research'],
  },
  {
    slug: 'mcp-tool-use',
    title: 'MCP / Tool Use',
    description: 'Model Context Protocol servers, tool-calling frameworks, and integration layers.',
    categories: ['MCP / Tool Use'],
  },
  {
    slug: 'code-agents',
    title: 'Code Agents',
    description: 'Autonomous coding assistants, code-review agents, and developer-facing AI tools.',
    categories: ['Code Agents'],
  },
  {
    slug: 'developer-tools',
    title: 'Developer Tools',
    description: 'Infrastructure, observability, testing, and platform tools for AI builders.',
    categories: ['Developer Tools'],
  },
]

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch and return all digest sections with items populated.
 * Sections with zero items are included (page hides them).
 */
export async function getDigestSections(): Promise<DigestSection[]> {
  const supabase = createServerClient()
  const seen = new Set<string>()
  const sections: DigestSection[] = []

  for (const def of SECTION_DEFINITIONS) {
    let candidates: HomepageItem[] = []

    try {
      const { data } = await supabase
        .from('items')
        .select(DIGEST_SELECT)
        .eq('status', 'enriched')
        .in('ai_category', def.categories)
        .gte('ai_relevance_score', MIN_RELEVANCE)
        .order('ranking_score', { ascending: false })
        .limit(FETCH_PER_SECTION)

      candidates = (data as unknown as HomepageItem[]) ?? []
    } catch {
      candidates = []
    }

    // In-memory cross-section dedup
    const items: HomepageItem[] = []
    for (const item of candidates) {
      if (items.length >= ITEMS_PER_SECTION) break
      if (!seen.has(item.id)) {
        seen.add(item.id)
        items.push(item)
      }
    }

    sections.push({ ...def, items })
  }

  return sections
}
