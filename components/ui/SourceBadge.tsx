import { cn } from '@/lib/utils'
import type { ItemSource } from '@/lib/db/types'

const SOURCE_CONFIG: Record<ItemSource, { label: string; dot: string; pill: string }> = {
  github: {
    label: 'GitHub',
    dot:   'bg-emerald-500 dark:bg-emerald-400',
    pill:  'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  hackernews: {
    label: 'HN',
    dot:   'bg-orange-500 dark:bg-orange-400',
    pill:  'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  },
  rss: {
    label: 'RSS',
    dot:   'bg-sky-500 dark:bg-sky-400',
    pill:  'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
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
