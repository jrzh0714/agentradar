'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { formatCount, formatRelativeDate } from '@/lib/utils'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'github' | 'hackernews' | 'rss'

const SOURCE_CONFIG: Record<SourceFilter, { label: string; pillCls: string }> = {
  all:         { label: 'All',     pillCls: 'border-orange-800/40 bg-orange-950/30 text-orange-400' },
  github:      { label: 'GitHub',  pillCls: 'border-emerald-800/40 bg-emerald-950/30 text-emerald-400' },
  hackernews:  { label: 'HN',      pillCls: 'border-orange-800/40 bg-orange-950/30 text-orange-400' },
  rss:         { label: 'Article', pillCls: 'border-sky-800/40 bg-sky-950/30 text-sky-400' },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  items: HomepageItem[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrendingSection({ items }: Props) {
  // Memoised so its identity is stable — prevents cycleSource/effect from
  // re-running on every render due to a new array reference each time.
  const availableSources = useMemo<SourceFilter[]>(() => {
    const srcs: SourceFilter[] = ['all']
    if (items.some((i) => i.source === 'github'))     srcs.push('github')
    if (items.some((i) => i.source === 'hackernews')) srcs.push('hackernews')
    if (items.some((i) => i.source === 'rss'))        srcs.push('rss')
    return srcs
  }, [items])

  const [activeSource, setActiveSource] = useState<SourceFilter>('all')

  // If the active source disappears from available (edge case), reset to all
  useEffect(() => {
    if (!availableSources.includes(activeSource)) setActiveSource('all')
  }, [activeSource, availableSources])

  const filtered = activeSource === 'all'
    ? items
    : items.filter((i) => i.source === activeSource)

  // ── Source cycling via arrow keys ──────────────────────────────────────────

  const cycleSource = useCallback((dir: 1 | -1) => {
    setActiveSource((cur) => {
      const idx = availableSources.indexOf(cur)
      const next = (idx + dir + availableSources.length) % availableSources.length
      return availableSources[next]
    })
  }, [availableSources])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const active = document.activeElement
      const isInput = active instanceof HTMLInputElement
        || active instanceof HTMLTextAreaElement
        || active instanceof HTMLSelectElement
      if (isInput) return
      if (e.key === 'ArrowRight') { e.preventDefault(); cycleSource(1) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); cycleSource(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleSource])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <p className="font-mono text-xs text-zinc-600">
        <T k="home.no_trending" />
      </p>
    )
  }

  return (
    <div>
      {/* ── Source tabs + arrow controls ──────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        {/* Left arrow */}
        <button
          type="button"
          onClick={() => cycleSource(-1)}
          aria-label="Previous source"
          className="flex h-6 w-6 items-center justify-center rounded border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          ←
        </button>

        {/* Source pills */}
        <div className="flex items-center gap-1.5">
          {availableSources.map((src) => {
            const cfg = SOURCE_CONFIG[src]
            const count = src === 'all' ? items.length : items.filter((i) => i.source === src).length
            const isActive = activeSource === src
            return (
              <button
                key={src}
                type="button"
                onClick={() => setActiveSource(src)}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors focus:outline-none',
                  isActive
                    ? cfg.pillCls
                    : 'border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400',
                ].join(' ')}
              >
                {cfg.label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          onClick={() => cycleSource(1)}
          aria-label="Next source"
          className="flex h-6 w-6 items-center justify-center rounded border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          →
        </button>

        {/* Keyboard hint — hidden on mobile */}
        <span className="ml-1 hidden font-mono text-[10px] text-zinc-700 sm:inline">
          ← → keys
        </span>
      </div>

      {/* ── Item list ────────────────────────────────────────────────────── */}
      <div className="divide-y divide-zinc-800/60 rounded-xl border border-orange-900/30 bg-orange-950/10">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 font-mono text-xs text-zinc-600">
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

  return (
    <div className="group flex items-start gap-4 px-4 py-3.5">
      {/* Rank */}
      <span className="mt-0.5 w-5 shrink-0 font-mono text-xs tabular-nums text-orange-600/70">
        {String(rank).padStart(2, '0')}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <SourcePill source={item.source} />
          {item.ai_category && (
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              {item.ai_category}
            </span>
          )}
          {dateLabel && (
            <span className="ml-auto font-mono text-[10px] text-zinc-600">{dateLabel}</span>
          )}
        </div>

        <Link href={`/items/${item.id}`} className="group/t block">
          <p className="line-clamp-1 font-mono text-sm font-semibold leading-snug text-zinc-100 transition-colors group-hover/t:text-zinc-200 dark:group-hover/t:text-white">
            {item.title}
          </p>
        </Link>

        {summary && (
          <TranslatedText
            as="p"
            en={summary}
            zh={item.ai_summary_zh ?? null}
            className="mt-0.5 line-clamp-1 font-description text-xs leading-relaxed text-zinc-500"
          />
        )}

        {/* Signals + external link */}
        <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-zinc-700">
          {item.github_stars != null && (
            <span>★ {formatCount(item.github_stars)}</span>
          )}
          {item.hn_points != null && item.hn_points > 0 && (
            <span>▲ {item.hn_points} pts</span>
          )}
          {hasUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-zinc-700 transition-colors hover:text-zinc-300"
              aria-label="Open source"
            >
              ↗
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Source pill ───────────────────────────────────────────────────────────────

const PILL_STYLES: Record<string, { label: string; cls: string }> = {
  github:     { label: 'GitHub',  cls: 'border-emerald-800/50 bg-emerald-950/40 text-emerald-400' },
  hackernews: { label: 'HN',      cls: 'border-orange-800/50 bg-orange-950/40 text-orange-400' },
  rss:        { label: 'Article', cls: 'border-sky-800/50 bg-sky-950/40 text-sky-400' },
}

function SourcePill({ source }: { source: string }) {
  const s = PILL_STYLES[source] ?? { label: source, cls: 'border-zinc-700 text-zinc-500' }
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${s.cls}`}>
      {s.label}
    </span>
  )
}
