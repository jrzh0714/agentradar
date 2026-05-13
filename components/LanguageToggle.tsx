'use client'

import { useLanguage } from '@/components/LanguageProvider'
import { useEffect, useState } from 'react'

export function LanguageToggle() {
  const { lang, setLang } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-7 w-14" />

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
      className="flex h-7 items-center gap-1 rounded-md border border-zinc-700 px-2 font-mono text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
      aria-label={lang === 'en' ? 'Switch to Chinese' : '切换到英文'}
    >
      {lang === 'en' ? (
        <>
          <span className="opacity-50">EN</span>
          <span className="text-zinc-600">/</span>
          <span>中文</span>
        </>
      ) : (
        <>
          <span>EN</span>
          <span className="text-zinc-600">/</span>
          <span className="opacity-50">中文</span>
        </>
      )}
    </button>
  )
}
