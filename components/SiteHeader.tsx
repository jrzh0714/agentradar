import Link from 'next/link'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TranslatedText } from '@/components/TranslatedText'

type Section = 'today' | 'explore' | 'weekly'

const sections = [
  { id: 'today', href: '/', en: 'Today', zh: '今日精选' },
  { id: 'explore', href: '/search', en: 'Explore', zh: '探索' },
  { id: 'weekly', href: '/digest', en: 'Past 7 days', zh: '过去七天' },
] as const

export function SiteHeader({ active }: { active?: Section }) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-6 px-6 pt-3 md:grid-cols-[1fr_auto_1fr] md:py-3">
        <Link
          href="/"
          className="group flex w-fit items-center gap-2.5 rounded-md py-1.5 font-mono text-sm font-bold tracking-tight text-zinc-100 transition-colors hover:text-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
        >
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className="h-8 w-8 shrink-0 text-indigo-400">
            <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
            <circle cx="16" cy="16" r="8" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
            <path d="M16 3v13l9-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.5" fill="currentColor" />
            <circle cx="24" cy="21" r="2" fill="currentColor" />
          </svg>
          AgentRadar
        </Link>

        <nav aria-label="Main navigation" className="col-span-2 row-start-2 -mb-px flex justify-between gap-1 pt-2 md:col-span-1 md:col-start-2 md:row-start-1 md:gap-2 md:pt-0">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              aria-current={active === section.id ? 'page' : undefined}
              className={[
                'flex min-h-11 flex-1 items-center justify-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-indigo-400 md:min-h-10 md:flex-none md:rounded-lg md:border-b-0 md:px-4',
                active === section.id
                  ? 'border-indigo-400 text-zinc-100 md:bg-zinc-800/70'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100',
              ].join(' ')}
            >
              <TranslatedText en={section.en} zh={section.zh} />
            </Link>
          ))}
        </nav>

        <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:col-start-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
