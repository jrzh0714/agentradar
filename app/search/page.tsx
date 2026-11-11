// Force dynamic — results depend on live DB data and URL search params.
export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { ItemCard } from '@/components/ItemCard'
import { SearchControls } from './SearchControls'
import { SearchResultsLabel, SortedByLabel } from './SearchResultsLabel'
import { parseSearchPage, SEARCH_PAGE_SIZE, searchItems } from '@/lib/db/search'
import type { DateRange, SearchCollection, SearchSort } from '@/lib/db/search'
import { SiteHeader } from '@/components/SiteHeader'
import { T } from '@/components/T'
import { SOCIAL_IMAGE } from '@/lib/site'
import { TranslatedText } from '@/components/TranslatedText'

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Search — AgentRadar',
  description: 'Search the AgentRadar corpus of AI-enriched tools, repos, and articles.',
  alternates: { canonical: '/search' },
  openGraph: {
    type: 'website',
    url: '/search',
    title: 'Search — AgentRadar',
    description: 'Search the AgentRadar corpus of AI-enriched tools, repos, and articles.',
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search — AgentRadar',
    description: 'Search the AgentRadar corpus of AI-enriched tools, repos, and articles.',
    images: [SOCIAL_IMAGE],
  },
  robots: { index: false, follow: true },
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
  return typeof raw === 'string' ? raw.trim().slice(0, 120) : ''
}

function parseFloat_(raw: string | string[] | undefined): number {
  const n = parseFloat(typeof raw === 'string' ? raw : '0')
  return isFinite(n) ? n : 0
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
  const page      = parseSearchPage(params.page)
  const collection: SearchCollection | undefined = params.collection === 'news' || params.collection === 'agents'
    ? params.collection : undefined

  const { items: results, total, unavailable } = await searchItems({
    q, source, category, maturity, minScore, dateRange, sort, page, collection,
  })
  const offset = (page - 1) * SEARCH_PAGE_SIZE
  const totalPages = Math.ceil(total / SEARCH_PAGE_SIZE)

  function pageHref(target: number): string {
    const search = new URLSearchParams()
    if (q) search.set('q', q)
    if (source !== 'all') search.set('source', source)
    if (category) search.set('category', category)
    if (maturity) search.set('maturity', maturity)
    if (minScore > 0) search.set('min_score', String(minScore))
    if (dateRange !== 'all') search.set('date_range', dateRange)
    if (sort !== 'ranking') search.set('sort', sort)
    if (collection) search.set('collection', collection)
    if (target > 1) search.set('page', String(target))
    return search.size ? `/search?${search}` : '/search'
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SiteHeader active="explore" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {/* ── Page title ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-semibold tracking-tight text-zinc-100">
            <T k="search.title" />
          </h1>
          <p className="text-sm leading-relaxed text-zinc-500">
            <T k="search.subtitle" />
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
          collection={collection}
        />

        {/* ── Result count ────────────────────────────────────────────────── */}
        {!unavailable && <div className="mt-6 mb-4 flex items-center gap-2 border-b border-zinc-800 pb-4">
          <span className="font-mono text-xs text-zinc-500">
            <SearchResultsLabel count={total} shownCount={results.length} q={q} offset={offset} />
          </span>
          {results.length > 0 && (
            <span className="font-mono text-xs text-zinc-700 dark:text-zinc-600">
              <SortedByLabel sort={sort} />
            </span>
          )}
        </div>}

        {/* ── Results ─────────────────────────────────────────────────────── */}
        {unavailable ? (
          <div role="alert" className="mt-6 rounded-xl border border-amber-700/50 bg-zinc-900 p-6">
            <TranslatedText as="p" en="Search is temporarily unavailable." zh="搜索暂时不可用。" className="text-sm text-zinc-200" />
            <TranslatedText as="p" en="We couldn't load results. Your filters are preserved; try again in a moment." zh="暂时无法加载结果。筛选条件已保留，请稍后重试。" className="mt-2 text-sm text-zinc-400" />
            <a href={pageHref(page)} className="mt-4 inline-block rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-200">
              <TranslatedText en="Try again" zh="重试" />
            </a>
          </div>
        ) : results.length === 0 && page > 1 ? (
          <div className="rounded-xl border border-zinc-800 p-6 text-sm text-zinc-400">
            <TranslatedText as="p" en="There are no results on this page. The collection may have changed." zh="此页暂无结果，内容集合可能已更新。" />
            <Link href={pageHref(1)} className="mt-3 inline-block text-zinc-200 underline underline-offset-4">
              <TranslatedText en="Back to the first page" zh="返回第一页" />
            </Link>
          </div>
        ) : results.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50">
            <p className="mb-1 font-mono text-sm text-zinc-400">
              <T k="search.no_results" />
            </p>
            <p className="font-mono text-xs text-zinc-600">
              {q ? <T k="search.no_results_q" /> : <T k="search.no_results_f" />}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!unavailable && results.length > 0 && totalPages > 1 && (
          <nav aria-label="Search result pages" className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 pt-5 text-sm">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} prefetch={false} className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200">
                <TranslatedText en="← Previous" zh="← 上一页" />
              </Link>
            ) : <span />}
            <TranslatedText en={`Page ${page} of ${totalPages}`} zh={`第 ${page} 页，共 ${totalPages} 页`} className="text-zinc-500" />
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} prefetch={false} className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200">
                <TranslatedText en="Next →" zh="下一页 →" />
              </Link>
            ) : <span />}
          </nav>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-6">
        <div className="mx-auto max-w-6xl px-6">
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-600">
            <T k="footer.built_with" />
          </span>
        </div>
      </footer>
    </div>
  )
}
