// Force dynamic — digest reflects live ranked data.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { Metadata } from 'next'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { HnPrefixBadge } from '@/components/ui/HnPrefixBadge'
import { formatRelativeDate } from '@/lib/utils'
import { getDisplayTitle, getTitlePrefix } from '@/lib/ingestion/title'
import { getDigestSections, ITEMS_PER_SECTION } from '@/lib/db/digest'
import { getDigestSummariesForWeek, getCurrentMonday } from '@/lib/db/digest-summaries'
import type { DigestSection } from '@/lib/db/digest'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Metadata ───────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Weekly Digest — AgentRadar',
  description:
    'A ranked briefing of emerging agent frameworks, model updates, research, MCP tools, and developer workflows.',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns a human-readable "Week of May 12, 2026" label. */
function weekLabel(): string {
  const now = new Date()
  // Roll back to the most recent Monday
  const day = now.getDay() // 0 = Sun
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DigestPage() {
  const sections = await getDigestSections()
  const summaries = await getDigestSummariesForWeek(getCurrentMonday())
  const visibleSections = sections.filter((s) => s.items.length > 0)
  const totalItems = visibleSections.reduce((n, s) => n + s.items.length, 0)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight text-zinc-100 transition-colors hover:text-white">
              AgentRadar
            </Link>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-500">
              beta
            </span>
          </div>
          <nav className="flex items-center gap-6 font-mono text-xs text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-200">home</Link>
            <Link href="/search" className="transition-colors hover:text-zinc-200">search</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6">

        {/* ── Digest masthead ─────────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-12">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-600">
            Week of {weekLabel()}
          </p>
          <h1 className="mb-4 font-mono text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            This Week in AI&nbsp;Agents<br className="hidden sm:block" />
            {' '}&amp; Developer&nbsp;Tools
          </h1>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-zinc-400">
            A ranked briefing of emerging agent frameworks, model updates, research,
            MCP tools, and developer workflows.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-600">
            <span>
              <span className="text-zinc-300">{totalItems}</span> items curated
            </span>
            <span>·</span>
            <span>
              <span className="text-zinc-300">{visibleSections.length}</span> sections
            </span>
            <span>·</span>
            <span>ranked by AI relevance &amp; community signal</span>
          </div>
        </section>

        {/* ── Static summary ──────────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-6 py-5">
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-600">
              Editor&apos;s note
            </p>
            <p className="text-sm leading-relaxed text-zinc-300">
              AgentRadar is tracking high-signal activity across AI agents, model APIs, MCP
              tooling, code agents, research, and developer infrastructure.
            </p>
          </div>
        </section>

        {/* ── Table of contents ───────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-6">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-600">
            In this digest
          </p>
          <ol className="space-y-1.5">
            {visibleSections.map((s, i) => (
              <li key={s.slug} className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-700">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <a
                  href={`#${s.slug}`}
                  className="font-mono text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  {s.title}
                </a>
                <span className="font-mono text-xs text-zinc-700">
                  {s.items.length} item{s.items.length !== 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Sections ────────────────────────────────────────────────────── */}
        <div className="divide-y divide-zinc-800/60 pb-16">
          {visibleSections.map((section, sectionIndex) => (
            <DigestSectionBlock
              key={section.slug}
              section={section}
              index={sectionIndex}
              summary={summaries.get(section.title) ?? null}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs text-zinc-600">
              AgentRadar — built with Next.js, Supabase, and Claude
            </span>
            <div className="flex items-center gap-4 font-mono text-xs text-zinc-700">
              <Link href="/" className="transition-colors hover:text-zinc-400">← feed</Link>
              <Link href="/search" className="transition-colors hover:text-zinc-400">search</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── DigestSectionBlock ─────────────────────────────────────────────────────────

function DigestSectionBlock({
  section,
  index,
  summary,
}: {
  section: DigestSection
  index: number
  summary: string | null
}) {
  return (
    <section id={section.slug} className="py-10 scroll-mt-20">
      {/* Section header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-zinc-700">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="font-mono text-lg font-bold text-zinc-100">{section.title}</h2>
          <span className="font-mono text-xs text-zinc-700">
            top {Math.min(section.items.length, ITEMS_PER_SECTION)}
          </span>
        </div>
        <p className="pl-8 text-sm text-zinc-500">{section.description}</p>
      </div>

      {/* AI editorial summary — only rendered when present */}
      {summary && (
        <div className="mb-6 rounded-lg border-l-2 border-indigo-600 bg-zinc-900 px-5 py-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            This week
          </p>
          <p className="text-sm leading-relaxed text-zinc-300">{summary}</p>
        </div>
      )}

      {/* Item rows */}
      <div className="space-y-0 divide-y divide-zinc-800/50">
        {section.items.map((item, i) => (
          <DigestRow key={item.id} item={item} rank={i + 1} />
        ))}
      </div>
    </section>
  )
}

// ── DigestRow ─────────────────────────────────────────────────────────────────

function DigestRow({ item, rank }: { item: HomepageItem; rank: number }) {
  const relScore  = item.ai_relevance_score != null ? item.ai_relevance_score * 10 : null
  const dateLabel = formatRelativeDate(item.published_at)
  const summary   = item.ai_summary?.trim() || item.description?.trim() || ''
  const title     = getDisplayTitle(item)
  const prefix    = getTitlePrefix(item.title)
  const hasUrl    = Boolean(item.url?.trim())

  return (
    <div className="group py-4">
      {/* Top row: rank · source · category · score · date · external */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-700">{rank}.</span>
        <SourceBadge source={item.source} />
        {item.ai_category && <CategoryBadge category={item.ai_category} />}
        {prefix && <HnPrefixBadge prefix={prefix} />}
        {relScore != null && <ScorePill score={relScore} />}
        <span className="flex-1" />
        {dateLabel && (
          <span className="font-mono text-xs text-zinc-600">{dateLabel}</span>
        )}
        {hasUrl && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open source"
            className="font-mono text-xs text-zinc-700 transition-colors hover:text-zinc-300"
          >
            ↗
          </a>
        )}
      </div>

      {/* Title */}
      <div className="pl-7">
        <Link
          href={`/items/${item.id}`}
          className="group/title block"
        >
          <h3 className="mb-1 font-mono text-sm font-semibold leading-snug text-zinc-100 transition-colors group-hover/title:text-white">
            {title}
          </h3>
        </Link>

        {/* Summary */}
        {summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {summary}
          </p>
        )}

        {/* GitHub signals inline */}
        {item.github_stars != null && (
          <p className="mt-1 font-mono text-xs text-zinc-700">
            ⭐ {item.github_stars.toLocaleString()} stars
            {item.github_forks != null && item.github_forks > 0 && (
              <span className="ml-2">· {item.github_forks.toLocaleString()} forks</span>
            )}
            {item.github_language && (
              <span className="ml-2">· {item.github_language}</span>
            )}
          </p>
        )}

        {/* HN signals inline */}
        {item.hn_points != null && (
          <p className="mt-1 font-mono text-xs text-zinc-700">
            ▲ {item.hn_points} points
            {item.hn_comments != null && item.hn_comments > 0 && (
              <span className="ml-2">· {item.hn_comments} comments</span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
