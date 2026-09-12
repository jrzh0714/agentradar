'use client'

import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { setTheme } = useTheme()

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
      aria-label="Toggle color theme"
    >
      <span className="hidden dark:block" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </span>
      <span className="block dark:hidden" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </button>
  )
}
