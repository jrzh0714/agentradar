// ISR: revalidate every 5 minutes. Items update once daily via cron so
// 5-min cache gives near-instant loads without serving stale content.
export const revalidate = 300

import Link from 'next/link'
import { formatCount, formatRelativeDate } from '@/lib/utils'
import { ItemSection } from '@/components/ItemSection'
import { ScrollToTop } from '@/components/ScrollToTop'
import { SiteHeader } from '@/components/SiteHeader'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import { TrendingSection } from '@/components/TrendingSection'
import { RefreshNotice } from '@/components/RefreshNotice'
import { DiscoverySearch } from '@/components/DiscoverySearch'
import {
  getTopPicks,
  getLatestHighSignal,
  getAiNews,
  getAgentTools,
  getWeeklyHighlights,
  getTrendingItems,
  getHomepageStats,
} from '@/lib/db/homepage'

export default async function HomePage() {
  // Fetch all sections in parallel — single round-trip latency.
  const [topPicks, aiNewsRaw, latestRaw, agentToolsRaw, weeklyHighlights, trendingRaw, stats] =
    await Promise.all([
      getTopPicks(),
      getAiNews(),
      getLatestHighSignal(),
      getAgentTools(28),
      getWeeklyHighlights(),
      getTrendingItems(8),
      getHomepageStats(),
    ])

  // ── In-memory deduplication ───────────────────────────────────────────────
  const seenIds = new Set(topPicks.slice(0, 3).map((i) => i.id))

  const aiNews = aiNewsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  aiNews.forEach((i) => seenIds.add(i.id))

  const latestSignal = latestRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  latestSignal.forEach((i) => seenIds.add(i.id))

  const agentTools = agentToolsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)

  // Trending: standalone fetch, no dedup needed (they can overlap — that's fine)
  const trending = trendingRaw.filter((i) => !seenIds.has(i.id)).slice(0, 5)

  // Never substitute evergreen picks under a time-bound heading.
  const highlights = weeklyHighlights

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SiteHeader active="today" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="grid gap-8 border-b border-zinc-800 py-8 sm:py-12 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:gap-14">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="hero-kicker"><TranslatedText en="A field guide for AI builders" zh="AI 开发者的工具指南" /></span>
              {stats.newToday > 0 && (
                <span className="rounded-full border border-indigo-300 bg-indigo-100 px-2 py-0.5 font-mono text-[10px] tabular-nums text-indigo-700 dark:border-indigo-800/40 dark:bg-indigo-950/30 dark:text-indigo-400">
                  +{stats.newToday} <T k="home.new_today" />
                </span>
              )}
            </div>

            <h1 className="mb-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-zinc-100 sm:text-5xl lg:text-6xl">
              <T k="home.headline" />
            </h1>

            <p className="mb-4 max-w-2xl font-description text-base leading-relaxed text-zinc-300 sm:text-lg">
              <T k="home.tagline" />
            </p>

            <DiscoverySearch />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
              <Link href="#briefing" className="inline-flex min-h-8 items-center gap-2 underline-offset-4 hover:underline"><T k="home.read_picks" /><span aria-hidden="true">↓</span></Link>
              <Link href="/search?collection=agents&q=mcp" className="topic-link">MCP</Link>
              <Link href="/search?collection=agents&category=Code+Agents" className="topic-link"><TranslatedText en="Coding agents" zh="代码 Agent" /></Link>
              <Link href="/search?q=rag" className="topic-link">RAG</Link>
            </div>
          </div>
          <aside className="hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 lg:block">
            <p className="hero-kicker mb-4"><TranslatedText en="Less noise. More context." zh="减少噪音，增加上下文。" /></p>
            {[
              ['01', 'Discover a useful tool', '发现实用工具', 'Find projects by the task you need to solve.', '按实际需求寻找项目。'],
              ['02', 'Understand the tradeoffs', '理解取舍', 'Read a concise brief, then check the source.', '先读简报，再核对原始来源。'],
              ['03', 'Decide what to try', '决定试用方向', 'Evaluate fit before adding another dependency.', '引入依赖前先评估适用性。'],
            ].map(([n, title, zhTitle, desc, zhDesc]) => <div key={n} className="flex gap-4 border-t border-zinc-800 py-4 last:pb-0"><span className="pt-0.5 font-mono text-xs text-zinc-500">{n}</span><div><p className="text-sm font-medium text-zinc-200"><TranslatedText en={title} zh={zhTitle} /></p><p className="mt-1 text-sm leading-relaxed text-zinc-500"><TranslatedText en={desc} zh={zhDesc} /></p></div></div>)}
          </aside>
        </section>

        <div className="py-4"><RefreshNotice /></div>
        <div id="briefing" className="scroll-mt-28 pb-10">
          <ItemSection title={<T k="section.top_picks" />} description={<T k="section.top_picks_desc" />}
            items={topPicks.slice(0, 3)} columns={3} viewAllHref="/search"
            emptyMessage={<T k="section.empty_top_picks" />} />
        </div>

        {/* ── Trending Now ───────────────────────────────────────────────────── */}
        <section className="border-t border-zinc-800 py-8">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
              <T k="home.trending_now" />
            </h2>
            {trending.length > 0 && (
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs tabular-nums text-zinc-500">
                {trending.length}
              </span>
            )}
          </div>
          <p className="mb-3 text-sm text-zinc-500"><T k="home.trending_desc" /></p>
          <TrendingSection items={trending} />
        </section>

        {/* ── At a Glance ────────────────────────────────────────────────────── */}
        <section className="border-t border-zinc-800 py-8">
          {/* Section header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                <T k="home.this_week" />
              </h2>
              <p className="mt-1 font-mono text-xs text-zinc-600">
                <T k="home.this_week_desc" />
              </p>
            </div>
          </div>

          {/* Highlight cards — 2-col on md+, 1-col on mobile */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {highlights.length === 0 && <p className="text-sm text-zinc-500"><T k="home.no_weekly" /></p>}
            {highlights.slice(0, 6).map((item, idx) => {
              const isLead = idx === 0
              const summary = item.ai_summary?.trim() || item.description?.trim()
              const dateLabel = item.published_at ? formatRelativeDate(item.published_at) : null

              return (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className={[
                    'group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900',
                    isLead ? 'md:col-span-2' : '',
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
                    {dateLabel && (
                      <span className="ml-auto font-mono text-[10px] text-zinc-600">
                        {dateLabel}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className={[
                    'font-semibold text-zinc-100 transition-colors group-hover:text-zinc-200 dark:group-hover:text-white',
                    item.source === 'github' ? 'font-mono' : '',
                    isLead ? 'text-base leading-snug' : 'line-clamp-2 text-sm leading-snug',
                  ].join(' ')}>
                    {item.title}
                  </h3>

                  {/* Summary */}
                  {summary && (
                    <TranslatedText
                      as="p"
                      en={summary}
                      zh={item.ai_summary_zh ?? null}
                      className={[
                        'mt-2 font-description text-sm leading-relaxed text-zinc-400',
                        isLead ? 'line-clamp-3' : 'line-clamp-2',
                      ].join(' ')}
                    />
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
                </Link>
              )
            })}
          </div>

          {/* Link to digest */}
          <div className="mt-6 flex items-center justify-end">
            <Link
              href="/digest"
              className="group flex items-center gap-1.5 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-200"
            >
              <T k="home.view_digest" />
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </section>

        {/* ── Divider ────────────────────────────────────────────────────────── */}
        <hr className="border-zinc-800" />

        {/* ── Sections ───────────────────────────────────────────────────────── */}
        <div className="space-y-16 py-14">

          {/* 2. AI News & Research */}
          <ItemSection
            title={<T k="section.ai_news" />}
            description={<T k="section.ai_news_desc" />}
            items={aiNews}
            columns={2}
            viewAllHref="/search?collection=news"
            emptyMessage={<T k="section.empty_news" />}
          />

          {/* 3. Latest High-Signal */}
          <ItemSection
            title={<T k="section.latest" />}
            description={<T k="section.latest_desc" />}
            items={latestSignal}
            columns={2}
            viewAllHref="/search?sort=newest"
            emptyMessage={<T k="section.empty_latest" />}
          />

          {/* 4. Agent & MCP Tools */}
          <ItemSection
            title={<T k="section.agent_tools" />}
            description={<T k="section.agent_tools_desc" />}
            items={agentTools}
            columns={2}
            viewAllHref="/search?collection=agents"
            emptyMessage={<T k="section.empty_agents" />}
          />

        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs text-zinc-600">
              <T k="footer.built_with" />
            </span>
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-700 dark:text-zinc-600">
              <Link href="/status" className="underline"><T k="nav.status" /></Link>
              <span>{formatCount(stats.total)} <T k="home.items_indexed" /></span>
              <span>·</span>
              <span><T k="home.ai_enriched_ranked" /></span>
              <span>·</span>
              <span className="text-zinc-500">
                <T k="footer.built_by" />{' '}
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

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  github:      { label: 'GitHub',    className: 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400' },
  hackernews:  { label: 'HN',        className: 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-400' },
  rss:         { label: 'Article',   className: 'border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-400' },
}

function SourcePill({ source }: { source: string }) {
  const s = SOURCE_STYLES[source] ?? { label: source, className: 'border-zinc-700 text-zinc-500' }
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${s.className}`}>
      {s.label}
    </span>
  )
}
