import { T } from '@/components/T'

/**
 * Badge for items ingested within the last 24 hours — makes the daily
 * content delta visible so returning visitors can see what changed.
 */
export function NewBadge() {
  return (
    <span className="inline-flex items-center rounded border border-indigo-300 bg-indigo-100 px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-400">
      <T k="common.new" />
    </span>
  )
}
