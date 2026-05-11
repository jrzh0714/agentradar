import { cn } from '@/lib/utils'

// Maps category names to Tailwind dark-mode-friendly pill classes.
const CATEGORY_STYLES: Record<string, string> = {
  'AI Agents':          'bg-indigo-950  text-indigo-300  border-indigo-800',
  'Code Agents':        'bg-violet-950  text-violet-300  border-violet-800',
  'RAG':                'bg-cyan-950    text-cyan-300    border-cyan-800',
  'LLM Frameworks':     'bg-blue-950    text-blue-300    border-blue-800',
  'MCP / Tool Use':     'bg-emerald-950 text-emerald-300 border-emerald-800',
  'Developer Tools':    'bg-amber-950   text-amber-300   border-amber-800',
  'AI Infrastructure':  'bg-orange-950  text-orange-300  border-orange-800',
  'Open Source Models': 'bg-sky-950     text-sky-300     border-sky-800',
  'Prompt Engineering': 'bg-purple-950  text-purple-300  border-purple-800',
  'Workflow Automation':'bg-teal-950    text-teal-300    border-teal-800',
  'Research':           'bg-rose-950    text-rose-300    border-rose-800',
  'Product Updates':    'bg-slate-900   text-slate-300   border-slate-700',
  'Other':              'bg-zinc-900    text-zinc-400    border-zinc-700',
}

const FALLBACK = 'bg-zinc-900 text-zinc-400 border-zinc-700'

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
