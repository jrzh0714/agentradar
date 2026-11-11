import { cn } from '@/lib/utils'
import { TranslatedText } from '@/components/TranslatedText'

const MATURITY_CONFIG: Record<string, { label: string; zh: string; styles: string }> = {
  'production-ready': {
    label:  'AI estimate: production-ready',
    zh: 'AI 评估：可用于生产',
    styles: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  },
  'promising': {
    label:  'AI estimate: promising',
    zh: 'AI 评估：有潜力',
    styles: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  },
  'experimental': {
    label:  'AI estimate: experimental',
    zh: 'AI 评估：实验阶段',
    styles: 'bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-700',
  },
  'unknown': {
    label:  '',
    zh: '',
    styles: '',
  },
}

interface MaturityBadgeProps {
  maturity: string
  className?: string
}

export function MaturityBadge({ maturity, className }: MaturityBadgeProps) {
  const cfg = MATURITY_CONFIG[maturity]
  if (!cfg || !cfg.label) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs',
        cfg.styles,
        className,
      )}
    >
      <TranslatedText en={cfg.label} zh={cfg.zh} />
    </span>
  )
}
