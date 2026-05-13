'use client'
import { useLanguage } from '@/components/LanguageProvider'
import { translations, type TranslationKey } from '@/lib/i18n'

/** Renders a translated UI string. SSR renders English; hydrates to Chinese if lang=zh. */
export function T({ k }: { k: TranslationKey }) {
  const { lang } = useLanguage()
  return <>{translations[lang][k] ?? translations.en[k]}</>
}

/** Hook for use in client components that need translated strings as values (e.g. placeholders). */
export function useT() {
  const { lang } = useLanguage()
  return (k: TranslationKey): string => translations[lang][k] ?? translations.en[k]
}
