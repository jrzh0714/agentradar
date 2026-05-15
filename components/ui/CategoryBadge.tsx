import { cn } from '@/lib/utils'

// Each entry: "light-mode classes  dark:dark-mode-classes"
const CATEGORY_STYLES: Record<string, string> = {
  'AI Agents':          'bg-indigo-100  text-indigo-700  border-indigo-300  dark:bg-indigo-950  dark:text-indigo-300  dark:border-indigo-800',
  'Code Agents':        'bg-violet-100  text-violet-700  border-violet-300  dark:bg-violet-950  dark:text-violet-300  dark:border-violet-800',
  'RAG':                'bg-cyan-100    text-cyan-700    border-cyan-300    dark:bg-cyan-950    dark:text-cyan-300    dark:border-cyan-800',
  'LLM Frameworks':     'bg-blue-100    text-blue-700    border-blue-300    dark:bg-blue-950    dark:text-blue-300    dark:border-blue-800',
  'MCP / Tool Use':     'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  'Developer Tools':    'bg-amber-100   text-amber-700   border-amber-300   dark:bg-amber-950   dark:text-amber-300   dark:border-amber-800',
  'AI Infrastructure':  'bg-orange-100  text-orange-700  border-orange-300  dark:bg-orange-950  dark:text-orange-300  dark:border-orange-800',
  'Open Source Models': 'bg-sky-100     text-sky-700     border-sky-300     dark:bg-sky-950     dark:text-sky-300     dark:border-sky-800',
  'Prompt Engineering': 'bg-purple-100  text-purple-700  border-purple-300  dark:bg-purple-950  dark:text-purple-300  dark:border-purple-800',
  'Workflow Automation':'bg-teal-100    text-teal-700    border-teal-300    dark:bg-teal-950    dark:text-teal-300    dark:border-teal-800',
  'Research':           'bg-rose-100    text-rose-700    border-rose-300    dark:bg-rose-950    dark:text-rose-300    dark:border-rose-800',
  'Product Updates':    'bg-slate-100   text-slate-600   border-slate-300   dark:bg-slate-900   dark:text-slate-300   dark:border-slate-700',
  'Other':              'bg-zinc-100    text-zinc-600    border-zinc-300    dark:bg-zinc-900    dark:text-zinc-400    dark:border-zinc-700',
}

const FALLBACK = 'bg-zinc-100 text-zinc-600 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700'

interface CategoryBadgeProps {
  category: string
  className?: string
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const styles = CATEGORY_STYLES[category] ?? FALLBACK
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs font-medium',
        styles,
        className,
      )}
    >
      {category}
    </span>
  )
}
