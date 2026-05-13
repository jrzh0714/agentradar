'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { DateRange, SearchSort } from '@/lib/db/search'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'AI Agents',
  'Code Agents',
  'LLM Frameworks',
  'MCP / Tool Use',
  'Workflow Automation',
  'RAG',
  'Research',
  'Product Updates',
  'AI Infrastructure',
  'Open Source Models',
  'Prompt Engineering',
  'Developer Tools',
  'Other',
]

const MATURITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Any maturity', value: '' },
  { label: 'Production-ready', value: 'production-ready' },
  { label: 'Promising', value: 'promising' },
  { label: 'Experimental', value: 'experimental' },
  { label: 'Unknown', value: 'unknown' },
]

const MIN_RELEVANCE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Any relevance', value: '0' },
  { label: '≥ 5 / 10', value: '0.5' },
  { label: '≥ 6 / 10', value: '0.6' },
  { label: '≥ 7 / 10', value: '0.7' },
  { label: '≥ 8 / 10', value: '0.8' },
  { label: '≥ 9 / 10', value: '0.9' },
]

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'Any time', value: 'all' },
  { label: 'Last 24 hours', value: '1d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
]

const SORT_OPTIONS: { label: string; value: SearchSort }[] = [
  { label: 'Best match', value: 'ranking' },
  { label: 'Highest relevance', value: 'relevance' },
  { label: 'Newest', value: 'newest' },
  { label: 'Most stars (GitHub)', value: 'stars' },
  { label: 'Most discussed (HN)', value: 'discussed' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchControlsProps {
  q: string
  source: string
  category: string
  maturity: string
  minScore: number
  dateRange: DateRange
  sort: SearchSort
}

// ── Chip sub-component ────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 font-mono text-xs text-zinc-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-zinc-500 transition-colors hover:text-zinc-200"
        aria-label={`Remove filter: ${label}`}
      >
        ×
      </button>
    </span>
  )
}

// ── Shared select style ───────────────────────────────────────────────────────

function selectCls(active: boolean) {
  return cn(
    'rounded-lg border px-2.5 py-1.5 bg-zinc-900',
    'font-mono text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer transition-colors',
    active
      ? 'border-zinc-500 text-zinc-100'
      : 'border-zinc-800 text-zinc-400 hover:border-zinc-700',
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchControls({
  q,
  source,
  category,
  maturity,
  minScore,
  dateRange,
  sort,
}: SearchControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  /** Build a /search URL from current state, merged with any overrides. */
  function buildUrl(overrides: Record<string, string>): string {
    const merged = {
      q,
      source,
      category,
      maturity,
      min_score: String(minScore),
      date_range: dateRange,
      sort,
      ...overrides,
    }
    const params = new URLSearchParams()
    if (merged.q)                                    params.set('q', merged.q)
    if (merged.source && merged.source !== 'all')    params.set('source', merged.source)
    if (merged.category)                             params.set('category', merged.category)
    if (merged.maturity)                             params.set('maturity', merged.maturity)
    if (merged.min_score && merged.min_score !== '0') params.set('min_score', merged.min_score)
    if (merged.date_range && merged.date_range !== 'all') params.set('date_range', merged.date_range)
    if (merged.sort && merged.sort !== 'ranking')    params.set('sort', merged.sort)
    const qs = params.toString()
    return qs ? `/search?${qs}` : '/search'
  }

  function navigate(overrides: Record<string, string>) {
    startTransition(() => router.push(buildUrl(overrides)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate({ q: inputRef.current?.value ?? '' })
  }

  // ── Active chips ────────────────────────────────────────────────────────────

  const chips: { label: string; onRemove: () => void }[] = []

  if (q) {
    chips.push({
      label: `"${q}"`,
      onRemove: () => navigate({ q: '' }),
    })
  }
  if (source && source !== 'all') {
    chips.push({
      label: `source: ${source === 'hackernews' ? 'HN' : source}`,
      onRemove: () => navigate({ source: 'all' }),
    })
  }
  if (category) {
    chips.push({
      label: category,
      onRemove: () => navigate({ category: '' }),
    })
  }
  if (maturity) {
    chips.push({
      label: `maturity: ${maturity}`,
      onRemove: () => navigate({ maturity: '' }),
    })
  }
  if (minScore > 0) {
    chips.push({
      label: `≥ ${Math.round(minScore * 10)}/10`,
      onRemove: () => navigate({ min_score: '0' }),
    })
  }
  if (dateRange && dateRange !== 'all') {
    const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? dateRange
    chips.push({
      label: dateLabel,
      onRemove: () => navigate({ date_range: 'all' }),
    })
  }
  if (sort && sort !== 'ranking') {
    const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort
    chips.push({
      label: `sort: ${sortLabel}`,
      onRemove: () => navigate({ sort: 'ranking' }),
    })
  }

  const hasActiveFilters = chips.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3 transition-opacity', isPending && 'opacity-60')}>
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search AgentRadar… try 'claude', 'mcp', 'rag'"
            className={cn(
              'w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 pl-9 pr-4',
              'font-mono text-sm text-zinc-100 placeholder:text-zinc-600',
              'focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500',
            )}
          />
        </div>
        <button
          type="submit"
          className={cn(
            'rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5',
            'font-mono text-sm text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-700',
          )}
        >
          Search
        </button>
      </form>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Source — pill tabs (most frequently used, worth the visual weight) */}
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(['all', 'github', 'hackernews', 'rss'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => navigate({ source: s })}
              className={cn(
                'rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
                source === s
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {s === 'hackernews' ? 'HN' : s}
            </button>
          ))}
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => navigate({ category: e.target.value })}
          className={selectCls(!!category)}
        >
          <option value="">Category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Maturity */}
        <select
          value={maturity}
          onChange={(e) => navigate({ maturity: e.target.value })}
          className={selectCls(!!maturity)}
        >
          {MATURITY_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Min relevance */}
        <select
          value={String(minScore)}
          onChange={(e) => navigate({ min_score: e.target.value })}
          className={selectCls(minScore > 0)}
        >
          {MIN_RELEVANCE_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Date range */}
        <select
          value={dateRange}
          onChange={(e) => navigate({ date_range: e.target.value })}
          className={selectCls(dateRange !== 'all')}
        >
          {DATE_RANGE_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          className={selectCls(sort !== 'ranking')}
        >
          {SORT_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Clear all — right-aligned, only when filters are active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              navigate({
                q: '',
                source: 'all',
                category: '',
                maturity: '',
                min_score: '0',
                date_range: 'all',
                sort: 'ranking',
              })
            }
            className="ml-auto font-mono text-xs text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
          >
            clear all
          </button>
        )}
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-600">Active:</span>
          {chips.map((chip) => (
            <FilterChip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}
    </div>
  )
}
