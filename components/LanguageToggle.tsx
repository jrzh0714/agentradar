'use client'

import { useLanguage } from '@/components/LanguageProvider'

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="flex min-h-10 items-center gap-1 rounded-lg border border-zinc-700 px-2.5 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      aria-label={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
    >
      {lang === 'en' ? (
        <>
          <span>EN</span>
          <span className="text-zinc-600">/</span>
          <span className="opacity-50">中</span>
        </>
      ) : (
        <>
          <span className="opacity-50">EN</span>
          <span className="text-zinc-600">/</span>
          <span>中</span>
        </>
      )}
    </button>
  )
}
