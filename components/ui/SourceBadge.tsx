import { cn } from '@/lib/utils'
import type { ItemSource } from '@/lib/db/types'

const SOURCE_CONFIG: Record<ItemSource, { label: string; dot: string; pill: string }> = {
  github: {
    label: 'GitHub',
    dot:   'bg-emerald-400',
    pill:  'bg-emerald-950 text-emerald-300 border-emerald-800',
  },
  hackernews: {
    label: 'HN',
    dot:   'bg-orange-400',
    pill:  'bg-orange-950 text-orange-300 border-orange-800',
  },
  rss: {
    label: 'RSS',
    dot:   'bg-sky-400',
    pill:  'bg-sky-950 text-sky-300 border-sky-800',
  },
}

interface SourceBadgeProps {
  source: ItemSource
  className?: string
}

export function SourceBadge({ source, className }: SourceBadgeProps) {
  const cfg = SOURCE_CONFIG[source]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs font-medium',
        cfg.pill,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
