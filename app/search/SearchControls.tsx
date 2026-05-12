'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SearchSort } from '@/lib/db/search'

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

const MIN_SCORE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Any score', value: '0' },
  { label: '≥ 5 / 10', value: '0.5' },
  { label: '≥ 6 / 10', value: '0.6' },
  { label: '≥ 7 / 10', value: '0.7' },
  { label: '≥ 8 / 10', value: '0.8' },
]

const SORT_OPTIONS: { label: string; value: SearchSort }[] = [
  { label: 'Best match', value: 'ranking' },
  { label: 'Highest relevance', value: 'relevance' },
  { label: 'Newest', value: 'newest' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SearchControlsProps {
  q: string
  source: string
  category: string
  maturity: string
  minScore: number
  sort: SearchSort
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchControls({
  q,
  source,
  category,
  maturity,
  minScore,
  sort,
}: SearchControlsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  /** Build a new /search URL from current state + overrides. */
  function buildUrl(overrides: Record<string, string>) {
    const merged = {
      q,
      source,
      category,
      maturity,
      min_score: String(minScore),
      sort,
      ...overrides,
    }
    const params = new URLSearchParams()
    if (merged.q) params.set('q', merged.q)
    if (merged.source && merged.source !== 'all') params.set('source', merged.source)
    if (merged.category) params.set('category', merged.category)
    if (merged.maturity) params.set('maturity', merged.maturity)
    if (merged.min_score && merged.min_score !== '0') params.set('min_score', merged.min_score)
    if (merged.sort && merged.sort !== 'ranking') params.set('sort', merged.sort)
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

  return (
    <div className={cn('transition-opacity', isPending && 'opacity-60')}>
      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
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

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3">

        {/* Source tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(['all', 'github', 'hackernews', 'rss'] as const).map((s) => (
            <button
              key={s}
              onClick={() => navigate({ source: s })}
              className={cn(
                'rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
                source === s
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {s === 'hackernews' ? 'HN' : s === 'all' ? 'all' : s}
            </button>
          ))}
        </div>

        {/* Category select */}
        <select
          value={category}
          onChange={(e) => navigate({ category: e.target.value })}
          className={cn(
            'rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5',
            'font-mono text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600',
            !category && 'text-zinc-500',
          )}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Maturity tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
          {(['', 'stable', 'promising', 'experimental'] as const).map((m) => (
            <button
              key={m}
              onClick={() => navigate({ maturity: m })}
              className={cn(
                'rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
                maturity === m
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {m || 'any'}
            </button>
          ))}
        </div>

        {/* Min score */}
        <select
          value={String(minScore)}
          onChange={(e) => navigate({ min_score: e.target.value })}
          className={cn(
            'rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5',
            'font-mono text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600',
          )}
        >
          {MIN_SCORE_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          className={cn(
            'rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5',
            'font-mono text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600',
          )}
        >
          {SORT_OPTIONS.map(({ label, value }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Clear link — only when any filter is active */}
        {(q || source !== 'all' || category || maturity || minScore > 0 || sort !== 'ranking') && (
          <button
            onClick={() => navigate({ q: '', source: 'all', category: '', maturity: '', min_score: '0', sort: 'ranking' })}
            className="ml-auto font-mono text-xs text-zinc-600 underline-offset-2 hover:text-zinc-400 hover:underline"
          >
            clear all
          </button>
        )}
      </div>
    </div>
  )
}
