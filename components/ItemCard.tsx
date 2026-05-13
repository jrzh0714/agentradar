import Link from 'next/link'
import { cn, formatRelativeDate, formatCount } from '@/lib/utils'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MaturityBadge } from '@/components/ui/MaturityBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { TagList } from '@/components/ui/TagList'
import { HnPrefixBadge } from '@/components/ui/HnPrefixBadge'
import { TrendingBadge } from '@/components/ui/TrendingBadge'
import { getDisplayTitle, getTitlePrefix } from '@/lib/ingestion/title'
import { TranslatedText } from '@/components/TranslatedText'
import type { HomepageItem } from '@/lib/db/homepage'

// ── Defensive rendering helpers ───────────────────────────────────────────────

/**
 * Returns the best available summary text.
 * Priority: ai_summary → raw description → static fallback.
 */
function safeSummary(
  aiSummary: string | null | undefined,
  description: string | null | undefined,
): string {
  if (aiSummary?.trim()) return aiSummary.trim()
  if (description?.trim()) return description.trim()
  return 'No summary available yet.'
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: HomepageItem
  /** Compact variant omits why_it_matters and truncates aggressively. */
  compact?: boolean
  className?: string
}

export function ItemCard({ item, compact = false, className }: ItemCardProps) {
  const relScore  = item.ai_relevance_score != null ? item.ai_relevance_score * 10 : null
  const dateLabel = formatRelativeDate(item.published_at)
  const title     = getDisplayTitle(item)
  const prefix    = getTitlePrefix(item.title)
  const summary   = safeSummary(item.ai_summary, item.description)
  const hasUrl    = Boolean(item.url?.trim())

  return (
    <article
      className={cn(
        'group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5',
        'transition-colors duration-150 hover:border-zinc-700',
        item.trending && 'border-l-2 border-orange-500',
        className,
      )}
    >
      {/* ── Row 1: source + relevance score + external link ─────────────── */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <SourceBadge source={item.source} />
        <div className="flex shrink-0 items-center gap-1.5">
          {relScore != null && <ScorePill score={relScore} />}
          {hasUrl && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open source"
              className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
            >
              ↗
            </a>
          )}
        </div>
      </div>

      {/* ── Row 2: category + maturity + HN prefix badge ────────────────── */}
      {(item.ai_category || item.ai_maturity || prefix || item.trending) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {item.ai_category && <CategoryBadge category={item.ai_category} />}
          {item.ai_maturity && <MaturityBadge maturity={item.ai_maturity} />}
          {prefix && <HnPrefixBadge prefix={prefix} />}
          {item.trending && <TrendingBadge />}
        </div>
      )}

      {/* ── Title — links to internal detail page ───────────────────────── */}
      <Link href={`/items/${item.id}`} className="mb-2 block">
        <h3
          className={cn(
            'font-mono font-semibold leading-snug text-zinc-100',
            'transition-colors group-hover:text-white',
            'line-clamp-2 text-sm',
          )}
        >
          {title}
        </h3>
      </Link>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <TranslatedText
        as="p"
        en={summary}
        zh={item.ai_summary_zh ?? null}
        className={cn(
          'mb-2 font-description text-sm leading-relaxed',
          summary === 'No summary available yet.'
            ? 'text-zinc-600 italic'
            : 'text-zinc-400',
          compact ? 'line-clamp-2' : 'line-clamp-3',
        )}
      />

      {/* ── Why it matters ──────────────────────────────────────────────── */}
      {!compact && item.ai_why_it_matters?.trim() && (
        <TranslatedText
          as="p"
          en={item.ai_why_it_matters}
          zh={item.ai_why_it_matters_zh ?? null}
          className="mb-3 line-clamp-2 border-l-2 border-zinc-700 pl-3 font-description text-xs leading-relaxed text-zinc-500 italic"
        />
      )}

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {item.ai_tags && item.ai_tags.length > 0 && (
        <TagList tags={item.ai_tags} max={compact ? 3 : 5} className="mb-3" />
      )}

      {/* ── Footer: signals + date ──────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3 text-xs text-zinc-600">
        {/* GitHub stars */}
        {item.github_stars != null && (
          <span className="flex items-center gap-1">
            <span>⭐</span>
            <span className="tabular-nums">{formatCount(item.github_stars)}</span>
            {item.github_forks != null && item.github_forks > 0 && (
              <span className="text-zinc-700">· {formatCount(item.github_forks)} forks</span>
            )}
          </span>
        )}

        {/* HN points */}
        {item.hn_points != null && (
          <span className="flex items-center gap-1">
            <span className="text-orange-600">▲</span>
            <span className="tabular-nums">{item.hn_points}</span>
            {item.hn_comments != null && item.hn_comments > 0 && (
              <span className="text-zinc-700">· {item.hn_comments} comments</span>
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
        {dateLabel && <span>{dateLabel}</span>}
      </div>
    </article>
  )
}
