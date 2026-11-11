import Link from 'next/link'
import { cn, formatRelativeDate, formatCount } from '@/lib/utils'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MaturityBadge } from '@/components/ui/MaturityBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { TagList } from '@/components/ui/TagList'
import { HnPrefixBadge } from '@/components/ui/HnPrefixBadge'
import { NewBadge } from '@/components/ui/NewBadge'
import { getDisplayTitle, getTitlePrefix } from '@/lib/ingestion/title'
import { TranslatedText } from '@/components/TranslatedText'
import { T } from '@/components/T'
import { isNewToday } from '@/lib/db/homepage'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: HomepageItem
  /** Compact variant omits why_it_matters and truncates aggressively. */
  compact?: boolean
  className?: string
}

export function ItemCard({ item, compact = false, className }: ItemCardProps) {
  const relScore    = item.ai_relevance_score != null ? item.ai_relevance_score * 10 : null
  const dateLabel   = formatRelativeDate(item.published_at)
  const title       = getDisplayTitle(item)
  const prefix      = getTitlePrefix(item.title)
  const summaryEn   = item.ai_summary?.trim() || item.description?.trim() || null
  const hasUrl      = Boolean(item.url?.trim())

  return (
    <article
      className={cn(
        'discovery-card group flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5',
        'transition-colors duration-150 hover:border-zinc-700 focus-within:border-zinc-600',
        className,
      )}
    >
      {/* ── Row 1: source + relevance estimate ────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SourceBadge source={item.source} />
        <div className="flex shrink-0 items-center gap-1.5">
          {relScore != null && <ScorePill score={relScore} />}
        </div>
      </div>

      {/* ── Row 2: category + maturity + HN prefix badge ────────────────── */}
      {(item.ai_category || item.ai_maturity || prefix || item.trending || isNewToday(item)) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {isNewToday(item) && <NewBadge />}
          {item.ai_category && <CategoryBadge category={item.ai_category} />}
          {item.ai_maturity && <MaturityBadge maturity={item.ai_maturity} />}
          {prefix && <HnPrefixBadge prefix={prefix} />}
          {item.trending && (
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
              <TranslatedText en="Ranking signal" zh="排名信号" />
            </span>
          )}
        </div>
      )}

      {/* ── Title — links to internal detail page ───────────────────────── */}
      <Link href={`/items/${item.id}`} className="mb-2 block min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
        <h3
          className={cn(
            'font-semibold leading-snug tracking-tight text-zinc-100',
            'line-clamp-2 break-words [overflow-wrap:anywhere] text-base',
            item.source === 'github' && 'font-mono text-[15px]',
          )}
        >
          {title}
        </h3>
      </Link>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {summaryEn ? (
        <TranslatedText
          as="p"
          en={summaryEn}
          zh={item.ai_summary_zh ?? null}
          className={cn(
            'mb-3 break-words font-description text-sm leading-relaxed text-zinc-400',
            compact ? 'line-clamp-2' : 'line-clamp-3',
          )}
        />
      ) : (
        <p className={cn('mb-2 font-description text-sm leading-relaxed text-zinc-600 italic', compact ? 'line-clamp-2' : 'line-clamp-3')}>
          <T k="card.no_summary" />
        </p>
      )}

      {/* ── Why it matters ──────────────────────────────────────────────── */}
      {!compact && item.ai_why_it_matters?.trim() && (
        <TranslatedText
          as="p"
          en={item.ai_why_it_matters}
          zh={item.ai_why_it_matters_zh ?? null}
          className="mb-3 line-clamp-2 break-words border-l-2 border-zinc-700 pl-3 font-description text-sm leading-relaxed text-zinc-500"
        />
      )}

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {item.ai_tags && item.ai_tags.length > 0 && (
        <TagList tags={item.ai_tags} max={compact ? 3 : 5} className="mb-3 [&>span]:max-w-full [&>span]:[overflow-wrap:anywhere]" />
      )}

      {/* ── Footer: signals + date ──────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-800 pt-3 text-xs leading-relaxed text-zinc-500">
        {/* GitHub stars */}
        {item.github_stars != null && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true">★</span>
            <span className="tabular-nums">{formatCount(item.github_stars)}</span>
            {item.github_forks != null && item.github_forks > 0 && (
              <span className="text-zinc-700 dark:text-zinc-600">· {formatCount(item.github_forks)} forks</span>
            )}
          </span>
        )}

        {/* HN points */}
        {item.hn_points != null && (
          <span className="flex items-center gap-1">
            <span aria-hidden="true">▲</span>
            <span className="tabular-nums">{item.hn_points}</span>
            {item.hn_comments != null && item.hn_comments > 0 && (
              <span className="text-zinc-700 dark:text-zinc-600">· {item.hn_comments} comments</span>
            )}
          </span>
        )}

        {/* GitHub language */}
        {item.github_language && !item.github_stars && (
          <span className="text-zinc-600">{item.github_language}</span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Date */}
        {dateLabel && (
          <span>
            <TranslatedText
              en={item.source === 'github' ? 'Repository activity' : 'Published'}
              zh={item.source === 'github' ? '仓库活动' : '发布于'}
            /> {dateLabel}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
    </article>
  )
}
