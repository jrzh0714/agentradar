// ISR: revalidate every 5 minutes. Item data changes only during daily
// enrichment runs, so a 5-min cache gives fast loads without staleness.
export const revalidate = 300

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
import { SiteHeader } from '@/components/SiteHeader'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import { CopyBriefLink } from '@/components/CopyBriefLink'
import { SITE_URL, SOCIAL_IMAGE } from '@/lib/site'
import type { Metadata } from 'next'

// ── Metadata ───────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await getItemById(id)
  if (!item) return { title: 'Not found — AgentRadar' }
  const title = getDisplayTitle(item)
  const description = item.ai_summary?.trim() || item.description?.trim() || undefined

  return {
    title: `${title} — AgentRadar`,
    description,
    alternates: { canonical: `/items/${id}` },
    openGraph: {
      type: 'article',
      url: `/items/${id}`,
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
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
      <SiteHeader active="explore" />

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <nav className="mb-8 flex items-center gap-2 font-mono text-xs text-zinc-600">
          <Link href="/" className="flex items-center gap-1 transition-colors hover:text-zinc-300">
            <span>←</span>
            <span><T k="nav.home" /></span>
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
          <h1 className={`mb-4 break-words text-2xl font-semibold leading-snug tracking-tight text-zinc-100 [overflow-wrap:anywhere] sm:text-3xl ${item.source === 'github' ? 'font-mono' : ''}`}>
            {displayTitle}
          </h1>

          {/* Source metadata row */}
          <div className="mb-5 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-500">
            {item.author && (
              <span><T k="common.by" /> <span className="text-zinc-400">{item.author}</span></span>
            )}
            {dateLabel && (
              <span>
                <TranslatedText
                  en={item.source === 'github' ? 'Repository activity' : 'Published'}
                  zh={item.source === 'github' ? '仓库活动' : '发布于'}
                /> <span className="text-zinc-400">{dateLabel}</span>
              </span>
            )}
            {item.source === 'github' && item.github_stars != null && (
              <span className="flex items-center gap-1">
                <span>⭐</span>
                <span className="tabular-nums text-zinc-400">{formatCount(item.github_stars)}</span>
                <T k="common.stars" />
                {item.github_forks != null && item.github_forks > 0 && (
                  <span className="text-zinc-600">
                    · {formatCount(item.github_forks)} <T k="common.forks" />
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
                <T k="common.points" />
                {item.hn_comments != null && item.hn_comments > 0 && (
                  <span className="text-zinc-600">· {item.hn_comments} <T k="common.comments" /></span>
                )}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {hasUrl && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 dark:hover:text-white"
              >
                <T k="common.view_source" />
                <span aria-hidden="true">↗</span>
              </a>
            )}
            <CopyBriefLink url={`${SITE_URL}/items/${item.id}`} />
          </div>
        </section>

        <hr className="mb-10 border-zinc-800" />

        {/* ── AI Briefing ────────────────────────────────────────────────────── */}
        <section className="mb-10 space-y-6">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            <T k="item.ai_briefing" />
          </h2>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-4">
            <TranslatedText
              as="p"
              en="AI-generated from indexed source material. This is not a hands-on review; capabilities and maturity estimates have not been independently verified here. Check the original source before adopting a tool."
              zh="本简报由 AI 根据已收录的来源生成，并非实测评测；此处的功能描述和成熟度评估未经独立验证。采用工具前，请核对原始来源。"
              className="text-sm leading-relaxed text-zinc-500"
            />
          </div>

          {/* Summary */}
          {item.ai_summary?.trim() ? (
            <div>
              <h3 className="mb-2 font-mono text-sm font-semibold text-zinc-300">
                <T k="item.summary" />
              </h3>
              <TranslatedText
                as="p"
                en={item.ai_summary}
                zh={item.ai_summary_zh ?? null}
                className="text-sm leading-relaxed text-zinc-400"
              />
            </div>
          ) : item.description?.trim() ? (
            <div>
              <h3 className="mb-2 font-mono text-sm font-semibold text-zinc-300">
                <T k="item.description" />
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">{item.description}</p>
            </div>
          ) : (
            <p className="text-sm italic text-zinc-600">
              <T k="item.no_summary" />
            </p>
          )}

          {/* Why it matters */}
          {item.ai_why_it_matters?.trim() && (
            <div className="rounded-lg border-l-2 border-zinc-600 bg-zinc-900 px-5 py-4">
              <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <T k="item.why_it_matters" />
              </h3>
              <TranslatedText
                as="p"
                en={item.ai_why_it_matters}
                zh={item.ai_why_it_matters_zh ?? null}
                className="text-sm leading-relaxed text-zinc-300"
              />
            </div>
          )}
        </section>

        <section className="mb-10 rounded-xl border border-zinc-800 p-6">
          <h2 className="mb-3 font-mono text-sm font-semibold text-zinc-200">
            <TranslatedText
              en={item.source === 'github' ? 'Before you try it' : 'Before you act on this finding'}
              zh={item.source === 'github' ? '试用前先检查' : '采纳本条信息前先核对'}
            />
          </h2>
          <TranslatedText
            as="p"
            en={item.source === 'github'
              ? 'Use the source documentation to check setup requirements, license or usage terms, and data access. Then evaluate a small workflow representative of your own task. A high relevance score does not establish reliability, security, or production readiness.'
              : 'Read the original source for its publication date, supporting evidence, evaluation scope, and limitations. Distinguish an announced capability from an independently measured result, and check whether it applies to your own task.'}
            zh={item.source === 'github'
              ? '请通过来源文档核对安装要求、许可或使用条款以及数据访问方式，再用一个符合自身需求的小型工作流进行评估。高相关度分数并不代表可靠性、安全性或生产可用性。'
              : '请阅读原始来源，核对发布日期、支持证据、评估范围及局限性。区分发布者宣称的能力与独立测量的结果，并判断其是否适用于您的实际需求。'}
            className="text-sm leading-relaxed text-zinc-400"
          />
        </section>

        {/* ── Classification ─────────────────────────────────────────────────── */}
        <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-zinc-600">
            <T k="item.classification" />
          </h2>

          <div className="space-y-4">
            {/* Tags */}
            {item.ai_tags && item.ai_tags.length > 0 && (
              <Row label={<T k="item.tags" />}>
                <TagList tags={item.ai_tags} max={10} />
              </Row>
            )}

            {/* Audience */}
            {item.ai_audience && item.ai_audience.length > 0 && (
              <Row label={<T k="item.audience" />}>
                <span className="text-sm text-zinc-300">{item.ai_audience.join(', ')}</span>
              </Row>
            )}

            {/* Scores */}
            {relScore != null && (
              <Row label={<T k="item.ai_relevance" />}>
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {relScore.toFixed(1)} / 10
                </span>
              </Row>
            )}
            {item.ranking_score != null && (
              <Row label={<T k="item.radar_score" />}>
                <span className="font-mono text-sm tabular-nums text-zinc-300">
                  {item.ranking_score.toFixed(2)}
                </span>
              </Row>
            )}

            {/* Dates */}
            {dateLabel && (
              <Row label={
                item.source === 'github'
                  ? <TranslatedText en="Repository activity" zh="仓库活动" />
                  : <T k="item.published" />
              }>{dateLabel}</Row>
            )}
            {createdLabel && (
              <Row label={<T k="item.indexed" />}>{createdLabel}</Row>
            )}

            {/* Source ID */}
            {item.source_id && item.source === 'github' && (
              <Row label={<T k="item.repository" />}>
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
              <T k="item.related_items" />
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
              <T k="footer.built_with" />
            </span>
            <Link
              href="/"
              className="font-mono text-xs text-zinc-700 transition-colors hover:text-zinc-400 dark:text-zinc-600"
            >
              <T k="nav.back_feed" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Small helper ──────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'

function Row({
  label,
  children,
}: {
  label: ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-28 shrink-0 font-mono text-xs text-zinc-600">{label}</span>
      <div className="text-sm text-zinc-500">{children}</div>
    </div>
  )
}
