'use client'

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'

export type Language = 'en' | 'zh'

const STORAGE_KEY = 'ar-lang'
const listeners = new Set<() => void>()

function getLanguageSnapshot(): Language {
  return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en'
}

function getServerLanguageSnapshot(): Language {
  return 'en'
}

function subscribeToLanguage(onStoreChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) onStoreChange()
  }

  listeners.add(onStoreChange)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStorage)
  }
}

const LanguageContext = createContext<{
  lang: Language
  setLang: (l: Language) => void
}>({ lang: 'en', setLang: () => {} })

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  )

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  function setLang(l: Language) {
    localStorage.setItem(STORAGE_KEY, l)
    listeners.forEach((listener) => listener())
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
