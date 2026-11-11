'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatCount, formatRelativeDate } from '@/lib/utils'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import { getDisplayTitle } from '@/lib/ingestion/title'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'github' | 'hackernews' | 'rss'

const SOURCE_CONFIG: Record<SourceFilter, { en: string; zh: string }> = {
  all:         { en: 'All', zh: '全部' },
  github:      { en: 'GitHub', zh: 'GitHub' },
  hackernews:  { en: 'HN', zh: 'HN' },
  rss:         { en: 'Articles', zh: '文章' },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  items: HomepageItem[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendingSection({ items }: Props) {
  const availableSources = useMemo<SourceFilter[]>(() => {
    const srcs: SourceFilter[] = ['all']
    if (items.some((i) => i.source === 'github'))     srcs.push('github')
    if (items.some((i) => i.source === 'hackernews')) srcs.push('hackernews')
    if (items.some((i) => i.source === 'rss'))        srcs.push('rss')
    return srcs
  }, [items])

  const [activeSource, setActiveSource] = useState<SourceFilter>('all')
  const selectedSource = availableSources.includes(activeSource) ? activeSource : 'all'

  const filtered = selectedSource === 'all'
    ? items
    : items.filter((i) => i.source === selectedSource)

  // ── Render ─────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-zinc-500">
        <T k="home.no_trending" />
      </p>
    )
  }

  return (
    <div>
      {/* Source filters remain directly accessible on small screens. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {availableSources.map((src) => {
          const cfg = SOURCE_CONFIG[src]
          const count = src === 'all' ? items.length : items.filter((i) => i.source === src).length
          const isActive = selectedSource === src
          return (
            <button
              key={src}
              type="button"
              onClick={() => setActiveSource(src)}
              aria-pressed={isActive}
              className={[
                'inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                isActive
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300',
              ].join(' ')}
            >
              <TranslatedText en={cfg.en} zh={cfg.zh} />
              <span className="ml-1.5 tabular-nums text-zinc-500">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Item list ────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-zinc-500">
            <T k="home.no_trending" />
          </p>
        ) : (
          filtered.map((item, i) => (
            <TrendingRow key={item.id} item={item} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function TrendingRow({ item, rank }: { item: HomepageItem; rank: number }) {
  const summary   = item.ai_summary?.trim() || item.description?.trim()
  const dateLabel = item.published_at ? formatRelativeDate(item.published_at) : null
  const hasUrl    = Boolean(item.url?.trim())
  const title     = getDisplayTitle(item)

  return (
    <div className="group flex min-w-0 items-start gap-3 px-4 py-4 transition-colors hover:bg-zinc-800/30 focus-within:bg-zinc-800/30 sm:gap-4">
      {/* Rank */}
      <span className="mt-0.5 w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-500">
        {String(rank).padStart(2, '0')}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <SourcePill source={item.source} />
          {item.ai_category && (
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-500">
              {item.ai_category}
            </span>
          )}
          {dateLabel && (
            <span className="ml-auto text-[11px] text-zinc-500">{dateLabel}</span>
          )}
        </div>

        <Link href={`/items/${item.id}`} className="mt-2 block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
          <p className={`line-clamp-2 break-words [overflow-wrap:anywhere] text-sm font-semibold leading-snug text-zinc-100 ${item.source === 'github' ? 'font-mono' : ''}`}>
            {title}
          </p>
        </Link>

        {summary && (
          <TranslatedText
            as="p"
            en={summary}
            zh={item.ai_summary_zh ?? null}
            className="mt-1.5 line-clamp-2 break-words font-description text-sm leading-relaxed text-zinc-400"
          />
        )}

        {/* Signals */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs tabular-nums text-zinc-500">
          {item.github_stars != null && (
            <span>★ {formatCount(item.github_stars)}</span>
          )}
          {item.hn_points != null && item.hn_points > 0 && (
            <span>▲ {item.hn_points} pts</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
          <Link
            href={`/items/${item.id}`}
            className="inline-flex min-h-10 items-center rounded-md px-2 font-medium text-indigo-700 underline-offset-4 hover:bg-zinc-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-300"
          >
            <TranslatedText en="Read brief" zh="阅读简报" />
            <span className="sr-only">: {title}</span>
            <span aria-hidden="true" className="ml-1">→</span>
          </Link>
          {hasUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-md px-2 text-zinc-500 underline-offset-4 hover:bg-zinc-800 hover:text-zinc-300 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            >
              <TranslatedText en="Source" zh="来源" />
              <span className="sr-only">: {title}</span>
              <span aria-hidden="true" className="ml-1">↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Source pill ───────────────────────────────────────────────────────────────

function SourcePill({ source }: { source: string }) {
  const label = SOURCE_CONFIG[source as SourceFilter] ?? { en: source, zh: source }
  return (
    <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
      <TranslatedText en={label.en} zh={label.zh} />
    </span>
  )
}
