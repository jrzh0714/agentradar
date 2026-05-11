import { cn, formatRelativeDate, formatCount } from '@/lib/utils'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { MaturityBadge } from '@/components/ui/MaturityBadge'
import { ScorePill } from '@/components/ui/ScorePill'
import { TagList } from '@/components/ui/TagList'
import type { HomepageItem } from '@/lib/db/homepage'

interface ItemCardProps {
  item: HomepageItem
  /** Compact variant omits why_it_matters and truncates aggressively. */
  compact?: boolean
  className?: string
}

export function ItemCard({ item, compact = false, className }: ItemCardProps) {
  const relScore = item.ai_relevance_score != null ? item.ai_relevance_score * 10 : null
  const dateLabel = formatRelativeDate(item.published_at)

  return (
    <article
      className={cn(
        'group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5',
        'transition-colors duration-150 hover:border-zinc-700',
        className,
      )}
    >
      {/* ── Row 1: source + relevance score ─────────────────────────────── */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <SourceBadge source={item.source} />
        {relScore != null && (
          <ScorePill score={relScore} className="shrink-0" />
        )}
      </div>

      {/* ── Row 2: category + maturity ───────────────────────────────────── */}
      {(item.ai_category || item.ai_maturity) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {item.ai_category && <CategoryBadge category={item.ai_category} />}
          {item.ai_maturity && <MaturityBadge maturity={item.ai_maturity} />}
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────────────────── */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-2 block"
        aria-label={`Open ${item.title}`}
      >
        <h3
          className={cn(
            'font-mono font-semibold leading-snug text-zinc-100',
            'group-hover:text-white transition-colors',
            compact ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-sm',
          )}
        >
          {item.title}
          <span className="ml-1 inline-block text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
            ↗
          </span>
        </h3>
      </a>

      {/* ── AI summary ──────────────────────────────────────────────────── */}
      {item.ai_summary && (
        <p
          className={cn(
            'mb-2 text-sm leading-relaxed text-zinc-400',
            compact ? 'line-clamp-2' : 'line-clamp-3',
          )}
        >
          {item.ai_summary}
        </p>
      )}

      {/* ── Why it matters ──────────────────────────────────────────────── */}
      {!compact && item.ai_why_it_matters && (
        <p className="mb-3 line-clamp-2 border-l-2 border-zinc-700 pl-3 text-xs leading-relaxed text-zinc-500 italic">
          {item.ai_why_it_matters}
        </p>
      )}

      {/* ── Tags ────────────────────────────────────────────────────────── */}
      {item.ai_tags && item.ai_tags.length > 0 && (
        <TagList tags={item.ai_tags} max={compact ? 3 : 5} className="mb-3" />
      )}

      {/* ── Footer: signals + date + rank ───────────────────────────────── */}
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
