import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ItemCard } from '@/components/ItemCard'
import { T } from '@/components/T'
import type { HomepageItem } from '@/lib/db/homepage'

interface ItemSectionProps {
  title: ReactNode
  description?: ReactNode
  items: HomepageItem[]
  emptyMessage?: ReactNode
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
  emptyMessage,
  columns = 2,
  compact = false,
  viewAllHref,
  className,
}: ItemSectionProps) {
  const empty = emptyMessage ?? <T k="section.empty_default" />

  return (
    <section className={cn('min-w-0', className)}>
      {/* Section header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
            {items.length > 0 && (
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs tabular-nums text-zinc-500">
                {items.length}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-500">{description}</p>
          )}
        </div>
        {viewAllHref && items.length > 0 && (
          <Link
            href={viewAllHref}
            className="group flex min-h-10 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            <T k="common.see_all" />
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        )}
      </div>

      {/* Grid or empty state */}
      {items.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50">
          <p className="p-5 text-center text-sm leading-relaxed text-zinc-500">{empty}</p>
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
