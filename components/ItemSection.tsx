import Link from 'next/link'
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
  /** If set, renders a "See all →" link pointing here. */
  viewAllHref?: string
  className?: string
}

export function ItemSection({
  title,
  description,
  items,
  emptyMessage = 'No items available yet.',
  columns = 2,
  compact = false,
  viewAllHref,
  className,
}: ItemSectionProps) {
  return (
    <section className={cn('', className)}>
      {/* Section header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-base font-semibold text-zinc-100">{title}</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] tabular-nums text-zinc-500">
                {items.length}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          )}
        </div>
        {viewAllHref && items.length > 0 && (
          <Link
            href={viewAllHref}
            className="group mt-0.5 shrink-0 flex items-center gap-1 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-200"
          >
            See all
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
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
