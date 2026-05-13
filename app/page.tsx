// Force dynamic rendering — data changes as new items are ingested and ranked.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { formatCount, formatRelativeDate } from '@/lib/utils'
import { ItemSection } from '@/components/ItemSection'
import { RadarAnimation } from '@/components/RadarAnimation'
import { ScrollToTop } from '@/components/ScrollToTop'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'
import {
  getTopPicks,
  getLatestHighSignal,
  getAiNews,
  getAgentTools,
  getWeeklyHighlights,
  getHomepageStats,
} from '@/lib/db/homepage'

export default async function HomePage() {
  // Fetch all sections in parallel — single round-trip latency.
  const [topPicks, aiNewsRaw, latestRaw, agentToolsRaw, weeklyHighlights, stats] =
    await Promise.all([
      getTopPicks(),
      getAiNews(),
      getLatestHighSignal(),
      getAgentTools(28),
      getWeeklyHighlights(),
      getHomepageStats(),
    ])

  // ── In-memory deduplication ───────────────────────────────────────────────
  const seenIds = new Set(topPicks.map((i) => i.id))

  const aiNews = aiNewsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  aiNews.forEach((i) => seenIds.add(i.id))

  const latestSignal = latestRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  latestSignal.forEach((i) => seenIds.add(i.id))

  const agentTools = agentToolsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)

  const trendingItems = topPicks.filter((i) => i.trending)

  // Fall back to top picks if the weekly query returns nothing yet
  const highlights = weeklyHighlights.length >= 3 ? weeklyHighlights : topPicks.slice(0, 6)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/60 bg-zinc-950/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold tracking-tight text-zinc-100">
              AgentRadar
            </span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-500">
              beta
            </span>
          </div>
          <nav className="flex items-center gap-6 font-mono text-xs text-zinc-500">
            <Link href="/search" className="transition-colors hover:text-zinc-200">
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="relative py-16">
          <RadarAnimation />

          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.4)]" />
              <span className="font-mono text-xs text-emerald-500">updated daily</span>
              {stats.lastUpdatedAt && (
                <span className="font-mono text-xs text-zinc-600">
                  · last updated {formatRelativeDate(stats.lastUpdatedAt)}
                </span>
              )}
            </div>

            <h1 className="mb-5 font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
              Agent<span className="text-zinc-400">Radar</span>
            </h1>

            <p className="mb-3 max-w-2xl font-description text-lg leading-relaxed text-zinc-300">
              Track emerging AI agents, developer tools, open-source projects, and model
              updates in one curated feed.
            </p>

            <p className="mb-10 max-w-2xl font-description text-sm leading-relaxed text-zinc-500">
              Items are continuously ingested from GitHub, Hacker News, and technical blogs,
              enriched by AI to extract category, maturity, and relevance, then ranked by a
              composite score that weighs signal quality, recency, and community adoption.
            </p>

            {/* Stats strip */}
            <div className="flex flex-wrap gap-6">
              <Stat value={formatCount(stats.total)} label="enriched items" />
              <Stat value={formatCount(stats.github)} label="GitHub repos" indicator="bg-emerald-500" />
              <Stat value={formatCount(stats.rss)} label="RSS articles" indicator="bg-sky-500" />
              <Stat value={String(stats.hackernews)} label="HN stories" indicator="bg-orange-500" />
            </div>
          </div>
        </section>

        {/* ── At a Glance ────────────────────────────────────────────────────── */}
        <section className="pb-14">
          {/* Section header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-zinc-300">
                This week
              </h2>
              <p className="mt-1 font-mono text-xs text-zinc-600">
                Emerging frameworks &amp; articles — up-and-coming, not already famous
              </p>
            </div>
            <div className="flex items-center gap-3">
              {trendingItems.length > 0 && (
                <span className="rounded-full border border-orange-800/40 bg-orange-950/30 px-2.5 py-1 font-mono text-[10px] text-orange-400">
                  {trendingItems.length} trending ↑
                </span>
              )}
            </div>
          </div>

          {/* Highlight cards — 2-col on md+, 1-col on mobile */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {highlights.slice(0, 6).map((item, idx) => {
              const isLead = idx === 0
              const summary = item.ai_summary?.trim() || item.description?.trim()
              const dateLabel = item.published_at ? formatRelativeDate(item.published_at) : null

              return (
                <a
                  key={item.id}
                  href={item.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={[
                    'group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900',
                    isLead ? 'md:col-span-2' : '',
                    item.trending ? 'border-l-2 border-l-orange-500' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {/* Row 1: source pill + category + trending */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <SourcePill source={item.source} />
                    {item.ai_category && (
                      <span className="rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                        {item.ai_category}
                      </span>
                    )}
                    {item.trending && (
                      <span className="rounded border border-orange-800/50 bg-orange-950/40 px-1.5 py-0.5 font-mono text-[10px] text-orange-400">
                        ↑ trending
                      </span>
                    )}
                    {dateLabel && (
                      <span className="ml-auto font-mono text-[10px] text-zinc-600">
                        {dateLabel}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={[
                    'font-mono font-semibold text-zinc-100 transition-colors group-hover:text-zinc-50 dark:group-hover:text-white',
                    isLead ? 'text-base leading-snug' : 'line-clamp-2 text-sm leading-snug',
                  ].join(' ')}>
                    {item.title}
                  </h3>

                  {/* Summary */}
                  {summary && (
                    <p className={[
                      'mt-2 font-description text-sm leading-relaxed text-zinc-400',
                      isLead ? 'line-clamp-3' : 'line-clamp-2',
                    ].join(' ')}>
                      {summary}
                    </p>
                  )}

                  {/* Footer: stars or HN points */}
                  {(item.github_stars != null || item.hn_points != null) && (
                    <div className="mt-3 flex items-center gap-3 font-mono text-[10px] text-zinc-600">
                      {item.github_stars != null && (
                        <span>★ {formatCount(item.github_stars)}</span>
                      )}
                      {item.hn_points != null && item.hn_points > 0 && (
                        <span>▲ {item.hn_points} pts</span>
                      )}
                    </div>
                  )}
                </a>
              )
            })}
          </div>

          {/* Link to digest */}
          <div className="mt-6 flex items-center justify-end">
            <Link
              href="/digest"
              className="group flex items-center gap-1.5 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-200"
            >
              View full weekly digest
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────────────── */}
        <hr className="border-zinc-800" />

        {/* ── Sections ───────────────────────────────────────────────────────── */}
        <div className="space-y-16 py-14">

          {/* 1. Top Picks */}
          <ItemSection
            title="Top Picks"
            description="Highest-signal tools and updates across all sources."
            items={topPicks}
            columns={3}
            compact
            emptyMessage="No top picks yet — run enrichment and ranking first."
          />

          {/* 2. AI News & Research */}
          <ItemSection
            title="AI News & Research"
            description="Model launches, research papers, and platform updates from blogs and HN."
            items={aiNews}
            columns={2}
            emptyMessage="No news or research items found."
          />

          {/* 3. Latest High-Signal */}
          <ItemSection
            title="Latest High-Signal Updates"
            description="Recently published items with strong AI/engineering relevance."
            items={latestSignal}
            columns={2}
            emptyMessage="No recent items found."
          />

          {/* 4. Agent & MCP Tools */}
          <ItemSection
            title="Agent & MCP Tools"
            description="Frameworks, tool-use libraries, and automation platforms for AI builders."
            items={agentTools}
            columns={2}
            emptyMessage="No agent or MCP tools found."
          />

        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs text-zinc-600">
              AgentRadar — built with Next.js, Supabase, and Claude
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-700">
              <span>{formatCount(stats.total)} items indexed</span>
              <span>·</span>
              <span>AI-enriched &amp; ranked</span>
              <span>·</span>
              <span className="text-zinc-500">
                Built by{' '}
                <a
                  href="https://www.linkedin.com/in/jzheng44/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Jerry Zheng
                </a>
              </span>
              <a
                href="https://github.com/jrzh0714"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-zinc-300"
              >
                GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/jzheng44/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-zinc-300"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  indicator,
}: {
  value: string
  label: string
  indicator?: string
}) {
  return (
    <div className="flex items-center gap-2">
      {indicator && <span className={`h-2 w-2 rounded-full ${indicator}`} />}
      <span className="font-mono text-sm font-semibold text-zinc-100">{value}</span>
      <span className="font-mono text-sm text-zinc-500">{label}</span>
    </div>
  )
}

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  github:      { label: 'GitHub',    className: 'border-emerald-800/50 bg-emerald-950/40 text-emerald-400' },
  hackernews:  { label: 'HN',        className: 'border-orange-800/50 bg-orange-950/40 text-orange-400' },
  rss:         { label: 'Article',   className: 'border-sky-800/50 bg-sky-950/40 text-sky-400' },
}

function SourcePill({ source }: { source: string }) {
  const s = SOURCE_STYLES[source] ?? { label: source, className: 'border-zinc-700 text-zinc-500' }
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${s.className}`}>
      {s.label}
    </span>
  )
}
