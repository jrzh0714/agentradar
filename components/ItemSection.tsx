import { cn } from '@/lib/utils'
import { ItemCard } from '@/components/ItemCard'
import type { HomepageItem } from '@/lib/db/homepage'

interface ItemSectionProps {
  title: string
  description?: string
  items: HomepageItem[]
  emptyMessage?: string
  /** Number of grid columns on larger viewports. Defaults to 2. */
  columns?: 2 | 3
  /** Show compact cards (no why_it_matters, fewer tags). */
  compact?: boolean
  className?: string
}

export function ItemSection({
  title,
  description,
  items,
  emptyMessage = 'No items available yet.',
  columns = 2,
  compact = false,
  className,
}: ItemSectionProps) {
  return (
    <section className={cn('', className)}>
      {/* Section header */}
      <div className="mb-5">
        <h2 className="font-mono text-base font-semibold text-zinc-100">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>

      {/* Grid or empty state */}
      {items.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50">
          <p className="font-mono text-xs text-zinc-600">{emptyMessage}</p>
        </div>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 gap-4',
            columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
            columns === 2 && 'sm:grid-cols-2',
          )}
        >
          {items.map((item) => (
            <ItemCard key={item.id} item={item} compact={compact} />
          ))}
        </div>
      )}
    </section>
  )
}
