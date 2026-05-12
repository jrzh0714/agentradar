// Force dynamic rendering — data changes as new items are ingested and ranked.
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { formatCount } from '@/lib/utils'
import { ItemSection } from '@/components/ItemSection'
import {
  getTopPicks,
  getLatestHighSignal,
  getAiNews,
  getAgentTools,
  getHomepageStats,
} from '@/lib/db/homepage'

export default async function HomePage() {
  // Fetch all sections in parallel — single round-trip latency.
  const [topPicks, aiNewsRaw, latestRaw, agentToolsRaw, stats] =
    await Promise.all([
      getTopPicks(),
      getAiNews(),
      getLatestHighSignal(),
      getAgentTools(28),
      getHomepageStats(),
    ])

  // ── In-memory deduplication ───────────────────────────────────────────────
  // Top Picks have first priority. Each subsequent section filters against all
  // IDs already claimed, then slices to its display limit.
  const seenIds = new Set(topPicks.map((i) => i.id))

  const aiNews = aiNewsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  aiNews.forEach((i) => seenIds.add(i.id))

  const latestSignal = latestRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)
  latestSignal.forEach((i) => seenIds.add(i.id))

  const agentTools = agentToolsRaw.filter((i) => !seenIds.has(i.id)).slice(0, 8)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-sm">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="py-16">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.4)]" />
            <span className="font-mono text-xs text-emerald-500">live feed</span>
          </div>

          <h1 className="mb-5 font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
            Agent<span className="text-zinc-400">Radar</span>
          </h1>

          <p className="mb-3 max-w-2xl text-lg leading-relaxed text-zinc-300">
            Track emerging AI agents, developer tools, open-source projects, and model
            updates in one curated feed.
          </p>

          <p className="mb-10 max-w-2xl text-sm leading-relaxed text-zinc-500">
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
            <div className="flex items-center gap-4 font-mono text-xs text-zinc-700">
              <span>{formatCount(stats.total)} items indexed</span>
              <span>·</span>
              <span>AI-enriched & ranked</span>
            </div>
          </div>
        </div>
      </footer>
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
      {indicator && (
        <span className={`h-2 w-2 rounded-full ${indicator}`} />
      )}
      <span className="font-mono text-sm font-semibold text-zinc-100">{value}</span>
      <span className="font-mono text-sm text-zinc-500">{label}</span>
    </div>
  )
}
