'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Language = 'en' | 'zh'

const LanguageContext = createContext<{
  lang: Language
  setLang: (l: Language) => void
}>({ lang: 'en', setLang: () => {} })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('ar-lang') as Language | null
    if (stored === 'zh') setLangState('zh')
  }, [])

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('ar-lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
