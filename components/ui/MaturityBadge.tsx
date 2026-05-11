import { cn } from '@/lib/utils'

const MATURITY_CONFIG: Record<string, { label: string; styles: string }> = {
  'production-ready': {
    label:  'stable',
    styles: 'bg-emerald-950 text-emerald-400 border-emerald-800',
  },
  'promising': {
    label:  'promising',
    styles: 'bg-amber-950 text-amber-400 border-amber-800',
  },
  'experimental': {
    label:  'experimental',
    styles: 'bg-zinc-900 text-zinc-500 border-zinc-700',
  },
  'unknown': {
    label:  '',
    styles: '',
  },
}

interface MaturityBadgeProps {
  maturity: string
  className?: string
}

export function MaturityBadge({ maturity, className }: MaturityBadgeProps) {
  const cfg = MATURITY_CONFIG[maturity]
  // Don't render anything for unknown maturity
  if (!cfg || !cfg.label) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs',
        cfg.styles,
        className,
      )}
    >
      {cfg.label}
    </span>
  )
}
