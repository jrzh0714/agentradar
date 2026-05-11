import { cn } from '@/lib/utils'

interface TagListProps {
  tags: string[]
  /** Maximum tags to display before truncating */
  max?: number
  className?: string
}

export function TagList({ tags, max = 5, className }: TagListProps) {
  const visible = tags.slice(0, max)
  const overflow = tags.length - visible.length

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {visible.map((tag) => (
        <span
          key={tag}
          className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-400"
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
          +{overflow}
        </span>
      )}
    </div>
  )
}
