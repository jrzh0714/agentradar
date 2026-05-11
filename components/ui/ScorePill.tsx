import { cn } from '@/lib/utils'

/**
 * Displays an AI relevance score (0–10 scale) as a coloured pill.
 * The score passed in should already be on the 0–10 scale
 * (i.e. ai_relevance_score × 10).
 */

function scoreColor(score: number): string {
  if (score >= 9) return 'text-emerald-400'
  if (score >= 7) return 'text-blue-400'
  if (score >= 5) return 'text-amber-400'
  return 'text-zinc-500'
}

interface ScorePillProps {
  /** Relevance score on a 0–10 scale */
  score: number
  className?: string
}

export function ScorePill({ score, className }: ScorePillProps) {
  const display = score.toFixed(1)
  const color = scoreColor(score)

  return (
    <span
      className={cn('inline-flex items-baseline gap-0.5 font-mono text-xs', className)}
      title={`AI relevance: ${display}/10`}
    >
      <span className={cn('font-semibold tabular-nums', color)}>{display}</span>
      <span className="text-zinc-600">/10</span>
    </span>
  )
}

/**
 * Compact ranking score badge shown in card footers.
 * ranking_score is on a 0–100 scale.
 */
interface RankScoreBadgeProps {
  score: number
  className?: string
}

export function RankScoreBadge({ score, className }: RankScoreBadgeProps) {
  return (
    <span
      className={cn('font-mono text-xs tabular-nums text-zinc-600', className)}
      title={`Ranking score: ${score.toFixed(2)}`}
    >
      #{score.toFixed(1)}
    </span>
  )
}
