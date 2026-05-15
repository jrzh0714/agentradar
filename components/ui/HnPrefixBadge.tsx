import type { HnPrefix } from '@/lib/ingestion/title'

interface HnPrefixBadgeProps {
  prefix: HnPrefix
}

/**
 * Small contextual badge displayed when an HN item carries a recognised prefix
 * ("Show HN", "Ask HN", "Tell HN").  Rendered separately from the cleaned title
 * so the stored DB title is never mutated.
 */
export function HnPrefixBadge({ prefix }: HnPrefixBadgeProps) {
  return (
    <span className="inline-flex items-center rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-400">
      {prefix}
    </span>
  )
}
