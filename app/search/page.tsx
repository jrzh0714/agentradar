// Force dynamic — results depend on live DB data and URL search params.
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemCard } from '@/components/ItemCard'
import { SearchControls } from './SearchControls'
import { searchItems } from '@/lib/db/search'
import type { DateRange, SearchSort } from '@/lib/db/search'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Search — AgentRadar',
  description: 'Search the AgentRadar corpus of AI-enriched tools, repos, and articles.',
}

// ── Param parsers ─────────────────────────────────────────────────────────────

const VALID_SORTS: SearchSort[] = ['ranking', 'newest', 'relevance', 'stars', 'discussed']
const VALID_DATE_RANGES: DateRange[] = ['all', '1d', '7d', '30d', '90d']

function parseSort(raw: string | string[] | undefined): SearchSort {
  if (typeof raw === 'string' && VALID_SORTS.includes(raw as SearchSort)) {
    return raw as SearchSort
  }
  return 'ranking'
}

function parseDateRange(raw: string | string[] | undefined): DateRange {
  if (typeof raw === 'string' && VALID_DATE_RANGES.includes(raw as DateRange)) {
    return raw as DateRange
  }
  return 'all'
}

function parseString(raw: string | string[] | undefined): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function parseFloat_(raw: string | string[] | undefined): number {
  const n = parseFloat(typeof raw === 'string' ? raw : '0')
  return isFinite(n) ? n : 0
}

// ── Sort label ────────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SearchSort, string> = {
  ranking: 'radar score',
  newest: 'publish date',
  relevance: 'AI relevance',
  stars: 'GitHub stars',
  discussed: 'HN discussion',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const q         = parseString(params.q)
  const source    = parseString(params.source) || 'all'
  const category  = parseString(params.category)
  const maturity  = parseString(params.maturity)
  const minScore  = parseFloat_(params.min_score)
  const dateRange = parseDateRange(params.date_range)
  const sort      = parseSort(params.sort)

  const results = await searchItems({ q, source, category, maturity, minScore, dateRange, sort })

  const resultLabel = q
    ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"`
    : `${results.length} high-signal item${results.length !== 1 ? 's' : ''}`

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight text-zinc-100 hover:text-white">
              AgentRadar
            </Link>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-500">
              beta
            </span>
          </div>
          <nav className="flex items-center gap-6 font-mono text-xs text-zinc-500">
            <Link href="/search" className="text-zinc-200">
              search
            </Link>
            <Link href="/digest" className="transition-colors hover:text-zinc-200">
              digest
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* ── Page title ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="mb-1 font-mono text-xl font-semibold text-zinc-100">Search</h1>
          <p className="font-mono text-xs text-zinc-500">
            AI-enriched tools, repos, and articles indexed from GitHub, HN, and blogs.
          </p>
        </div>

        {/* ── Search controls ─────────────────────────────────────────────── */}
        {/*
          key={q} remounts the component when the search term changes via URL,
          so the uncontrolled text input reflects the new value correctly.
        */}
        <SearchControls
          key={q}
          q={q}
          source={source}
          category={category}
          maturity={maturity}
          minScore={minScore}
          dateRange={dateRange}
          sort={sort}
        />

        {/* ── Result count ────────────────────────────────────────────────── */}
        <div className="mt-6 mb-4 flex items-center gap-2 border-b border-zinc-800 pb-4">
          <span className="font-mono text-xs text-zinc-500">{resultLabel}</span>
          {results.length > 0 && (
            <span className="font-mono text-xs text-zinc-700">
              · sorted by {SORT_LABELS[sort]}
            </span>
          )}
        </div>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {results.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50">
            <p className="mb-1 font-mono text-sm text-zinc-400">No results found</p>
            <p className="font-mono text-xs text-zinc-600">
              {q ? 'Try a broader query or remove some filters.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-6">
        <div className="mx-auto max-w-6xl px-6">
          <span className="font-mono text-xs text-zinc-700">
            AgentRadar — built with Next.js, Supabase, and Claude
          </span>
        </div>
      </footer>
    </div>
  )
}
