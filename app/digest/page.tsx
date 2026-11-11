// ISR: revalidate every 5 minutes. Digest content only changes on daily ingestion.
export const revalidate = 300

import Link from 'next/link'
import type { Metadata } from 'next'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { HnPrefixBadge } from '@/components/ui/HnPrefixBadge'
import { formatRelativeDate } from '@/lib/utils'
import { SiteHeader } from '@/components/SiteHeader'
import { SubscribeForm } from '@/components/SubscribeForm'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import { getDisplayTitle, getTitlePrefix } from '@/lib/ingestion/title'
import { getDigestSections, ITEMS_PER_SECTION } from '@/lib/db/digest'
import { recentWindow } from '@/lib/product/content-policy'
import { RefreshNotice } from '@/components/RefreshNotice'
import { isWaitlistEnabled } from '@/lib/waitlist'
import type { DigestSection } from '@/lib/db/digest'
import type { HomepageItem } from '@/lib/db/homepage'
import { SOCIAL_IMAGE } from '@/lib/site'

// ── Metadata ───────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Past Seven Days — AgentRadar',
  description:
    'A rolling seven-day selection by source publication or repository activity, with AI-assisted summaries and original sources.',
  alternates: { canonical: '/digest' },
  openGraph: {
    type: 'website',
    url: '/digest',
    title: 'Past Seven Days — AgentRadar',
    description:
      'Tools and articles with source publication or repository activity in the past seven days.',
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Past Seven Days — AgentRadar',
    description:
      'Tools and articles with source publication or repository activity in the past seven days.',
    images: [SOCIAL_IMAGE],
  },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DigestPage() {
  const waitlistEnabled = isWaitlistEnabled()
  const now = new Date()
  const window = recentWindow(now)
  const sections = await getDigestSections(now)
  const visibleSections = sections.filter((s) => s.items.length > 0)
  const totalItems = visibleSections.reduce((n, s) => n + s.items.length, 0)

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SiteHeader active="weekly" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6">

        {/* ── Digest masthead ─────────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-12">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-600">
            <T k="digest.week_of" /> {window.since.slice(0, 10)} – {window.until.slice(0, 10)} UTC
          </p>
          <h1 className="mb-4 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl" style={{ whiteSpace: 'pre-line' }}>
            <T k="digest.title" />
          </h1>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-zinc-400">
            <T k="digest.subtitle" />
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-600">
            <span>
              <span className="text-zinc-300">{totalItems}</span> <T k="digest.items_curated" />
            </span>
            <span>·</span>
            <span>
              <span className="text-zinc-300">{visibleSections.length}</span> <T k="digest.sections" />
            </span>
            <span>·</span>
            <span><T k="digest.ranked_by" /></span>
          </div>
        </section>

        <div className="pt-5"><RefreshNotice /></div>
        {totalItems === 0 && (
          <section className="rounded-xl border border-zinc-800 p-6">
            <p className="text-zinc-300"><T k="digest.no_recent" /></p>
            <Link href="/search" className="mt-3 inline-block text-sm underline"><T k="home.find_tool" /></Link>
          </section>
        )}

        {/* ── Selection disclosure ────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-8">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-6 py-5">
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-600">
              <T k="digest.editors_note" />
            </p>
            <p className="text-sm leading-relaxed text-zinc-300">
              <T k="digest.editors_text" />
            </p>
          </div>
        </section>

        {/* ── Email signup ────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-8">
          <div className="rounded-lg border-l-2 border-indigo-600 bg-zinc-900/60 px-6 py-5">
            <p className="mb-1 font-mono text-sm font-semibold text-zinc-200">
              <T k={waitlistEnabled ? 'digest.subscribe_title' : 'digest.waitlist_closed_title'} />
            </p>
            <p className="mb-4 text-xs leading-relaxed text-zinc-500">
              <T k={waitlistEnabled ? 'digest.subscribe_desc' : 'digest.waitlist_closed_desc'} />
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {waitlistEnabled && <SubscribeForm />}
              <a
                href="/feed.xml"
                className="font-mono text-xs text-zinc-600 underline underline-offset-2 transition-colors hover:text-zinc-300"
              >
                RSS
              </a>
              <a
                href="/privacy"
                className="font-mono text-xs text-zinc-600 underline underline-offset-2 transition-colors hover:text-zinc-300"
              >
                Privacy
              </a>
            </div>
          </div>
        </section>

        {/* ── Table of contents ───────────────────────────────────────────── */}
        <section className="border-b border-zinc-800 py-6">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-600">
            <T k="digest.in_this_digest" />
          </p>
          <ol className="space-y-1.5">
            {visibleSections.map((s, i) => (
              <li key={s.slug} className="flex items-baseline gap-3">
                <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <a
                  href={`#${s.slug}`}
                  className="font-mono text-sm text-zinc-400 transition-colors hover:text-zinc-100"
                >
                  {s.title}
                </a>
                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-600">
                  {s.items.length} <T k={s.items.length !== 1 ? 'digest.items' : 'digest.item'} />
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
              summary={null}
            />
          ))}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-4xl px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-xs text-zinc-600">
              <T k="footer.built_with" />
            </span>
            <div className="flex items-center gap-4 font-mono text-xs text-zinc-700 dark:text-zinc-600">
              <Link href="/" className="transition-colors hover:text-zinc-400">
                <T k="nav.back_feed" />
              </Link>
              <Link href="/search" className="transition-colors hover:text-zinc-400">
                <T k="nav.search" />
              </Link>
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
          <span className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-600">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="font-mono text-lg font-bold text-zinc-100">{section.title}</h2>
          <span className="font-mono text-xs text-zinc-700 dark:text-zinc-600">
            <T k="digest.top" /> {Math.min(section.items.length, ITEMS_PER_SECTION)}
          </span>
        </div>
        <p className="pl-8 text-sm text-zinc-500">{section.description}</p>
      </div>

      {/* AI editorial summary — only rendered when present */}
      {summary && (
        <div className="mb-6 rounded-lg border-l-2 border-indigo-600 bg-zinc-900 px-5 py-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            <T k="digest.this_week_label" />
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
        <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-600">{rank}.</span>
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
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center font-mono text-xs text-zinc-600 transition-colors hover:text-zinc-300"
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
          <h3 className="mb-1 font-mono text-sm font-semibold leading-snug text-zinc-100 transition-colors group-hover/title:text-zinc-200 dark:group-hover/title:text-white">
            {title}
          </h3>
        </Link>

        {/* Summary */}
        {summary && (
          <TranslatedText
            as="p"
            en={summary}
            zh={item.ai_summary_zh ?? null}
            className="line-clamp-2 font-description text-xs leading-relaxed text-zinc-500"
          />
        )}

        {/* GitHub signals inline */}
        {item.github_stars != null && (
          <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-600">
            ⭐ {item.github_stars.toLocaleString()} <T k="common.stars" />
            {item.github_forks != null && item.github_forks > 0 && (
              <span className="ml-2">· {item.github_forks.toLocaleString()} <T k="common.forks" /></span>
            )}
            {item.github_language && (
              <span className="ml-2">· {item.github_language}</span>
            )}
          </p>
        )}

        {/* HN signals inline */}
        {item.hn_points != null && (
          <p className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-600">
            ▲ {item.hn_points} <T k="common.points" />
            {item.hn_comments != null && item.hn_comments > 0 && (
              <span className="ml-2">· {item.hn_comments} <T k="common.comments" /></span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
