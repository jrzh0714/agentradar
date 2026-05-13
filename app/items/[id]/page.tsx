// Force dynamic — detail pages depend on live DB data.
export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ItemCard } from '@/components/ItemCard'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MaturityBadge } from '@/components/ui/MaturityBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { TagList } from '@/components/ui/TagList'
import { formatRelativeDate, formatCount } from '@/lib/utils'
import { getItemById, getRelatedItems } from '@/lib/db/items-detail'
import { HnPrefixBadge } from '@/components/ui/HnPrefixBadge'
import { getDisplayTitle, getTitlePrefix } from '@/lib/ingestion/title'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LanguageToggle } from '@/components/LanguageToggle'

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = await getItemById(id)
  if (!item) return { title: 'Not found — AgentRadar' }
  return {
    title: `${getDisplayTitle(item)} — AgentRadar`,
    description: item.ai_summary?.trim() || item.description?.trim() || undefined,
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const item = await getItemById(id)
  if (!item) notFound()

  const related = await getRelatedItems(item)

  const relScore     = item.ai_relevance_score != null ? item.ai_relevance_score * 10 : null
  const dateLabel    = formatRelativeDate(item.published_at)
  const createdLabel = formatRelativeDate(item.created_at)
  const hasUrl       = Boolean(item.url?.trim())
  const displayTitle = getDisplayTitle(item)
  const hnPrefix     = getTitlePrefix(item.title)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight text-zinc-100 transition-colors hover:text-zinc-200 dark:hover:text-white">
              AgentRadar
            </Link>
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <nav className="mb-8 flex items-center gap-2 font-mono text-xs text-zinc-600">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-zinc-300">
            <span>←</span>
            <span>home</span>
          </Link>
          {item.ai_category && (
            <>
              <span>/</span>
              <CategoryBadge category={item.ai_category} />
            </>
          )}
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="mb-10">

          {/* Badge row */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SourceBadge source={item.source} />
            {item.ai_maturity && <MaturityBadge maturity={item.ai_maturity} />}
            {hnPrefix && <HnPrefixBadge prefix={hnPrefix} />}
            {relScore != null && <ScorePill score={relScore} />}
          </div>

          {/* Title */}
          <h1 className="mb-4 font-mono text-2xl font-bold leading-snug tracking-tight text-zinc-100 sm:text-3xl">
            {displayTitle}
          </h1>

          {/* Source metadata row */}
          <div className="mb-5 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-500">
            {item.author && (
              <span>by <span className="text-zinc-400">{item.author}</span></span>
            )}
            {dateLabel && (
              <span>published <span className="text-zinc-400">{dateLabel}</span></span>
            )}
            {item.source === 'github' && item.github_stars != null && (
              <span className="flex items-center gap-1">
                <span>⭐</span>
                <span className="tabular-nums text-zinc-400">{formatCount(item.github_stars)}</span>
                <span>stars</span>
                {item.github_forks != null && item.github_forks > 0 && (
                  <span className="text-zinc-600">
                    · {formatCount(item.github_forks)} forks
                  </span>
                )}
                {item.github_language && (
                  <span className="text-zinc-600">· {item.github_language}</span>
                )}
              </span>
            )}
            {item.source === 'hackernews' && item.hn_points != null && (
              <span className="flex items-center gap-1">
                <span className="text-orange-600">▲</span>
                <span className="tabular-nums text-zinc-400">{item.hn_points}</span>
                <span>points</span>
                {item.hn_comments != null && item.hn_comments > 0 && (
                  <span className="text-zinc-600">· {item.hn_comments} comments</span>
                )}
              </span>
            )}
          </div>

          {/* External link button */}
          {hasUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 dark:hover:text-white"
            >
              View source
              <span>↗</span>
            </a>
          )}
        </section>

        <hr className="mb-10 border-zinc-800" />

        {/* ── AI Briefing ────────────────────────────────────────────────────── */}
        <section className="mb-10 space-y-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            AI Briefing
          </h2>

          {/* Summary */}
          {item.ai_summary?.trim() ? (
            <div>
              <h3 className="mb-2 font-mono text-sm font-semibold text-zinc-300">Summary</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{item.ai_summary}</p>
            </div>
          ) : item.description?.trim() ? (
            <div>
              <h3 className="mb-2 font-mono text-sm font-semibold text-zinc-300">Description</h3>
              <p className="text-sm leading-relaxed text-zinc-400">{item.description}</p>
            </div>
          ) : (
            <p className="text-sm italic text-zinc-600">
              No AI summary yet — this item may still be processing.
            </p>
          )}

          {/* Why it matters */}
          {item.ai_why_it_matters?.trim() && (
            <div className="rounded-lg border-l-2 border-zinc-600 bg-zinc-900 px-5 py-4">
              <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Why it matters
              </h3>
              <p className="text-sm leading-relaxed text-zinc-300">{item.ai_why_it_matters}</p>
            </div>
          )}
        </section>

        {/* ── Classification ─────────────────────────────────────────────────── */}
        <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Classification
          </h2>

          <div className="space-y-4">
            {/* Tags */}
            {item.ai_tags && item.ai_tags.length > 0 && (
              <Row label="Tags">
                <TagList tags={item.ai_tags} max={10} />
              </Row>
            )}

            {/* Audience */}
            {item.ai_audience && item.ai_audience.length > 0 && (
              <Row label="Audience">
                <span className="text-sm text-zinc-300">{item.ai_audience.join(', ')}</span>
              </Row>
            )}

            {/* Scores */}
            {relScore != null && (
              <Row label="AI Relevance">
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {relScore.toFixed(1)} / 10
                </span>
              </Row>
            )}
            {item.ranking_score != null && (
              <Row label="Radar Score">
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {item.ranking_score.toFixed(2)}
                </span>
              </Row>
            )}

            {/* Dates */}
            {dateLabel && (
              <Row label="Published">{dateLabel}</Row>
            )}
            {createdLabel && (
              <Row label="Indexed">{createdLabel}</Row>
            )}

            {/* Source ID */}
            {item.source_id && item.source === 'github' && (
              <Row label="Repository">
                <a
                  href={`https://github.com/${item.source_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200"
                >
                  {item.source_id}
                </a>
              </Row>
            )}
          </div>
        </section>

        {/* ── Related Items ───────────────────────────────────────────────────── */}
        {related.length > 0 && (
          <section>
            <h2 className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
              Related Items
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {related.map((r) => (
                <ItemCard key={r.id} item={r} compact />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs text-zinc-600">
              AgentRadar — built with Next.js, Supabase, and Claude
            </span>
            <Link
              href="/"
              className="font-mono text-xs text-zinc-700 transition-colors hover:text-zinc-400"
            >
              ← back to feed
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Small helper ──────────────────────────────────────────────────────────────

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-zinc-600">{label}</span>
      <div className="text-sm text-zinc-500">{children}</div>
    </div>
  )
}
