'use client'

import { useLanguage } from '@/components/LanguageProvider'

interface TranslatedTextProps {
  en: string | null | undefined
  zh: string | null | undefined
  className?: string
  as?: 'p' | 'span'
}

/**
 * Renders the zh variant when the user has switched to Chinese and zh is
 * available; otherwise renders the English text (default / SSR safe).
 */
export function TranslatedText({ en, zh, className, as: Tag = 'span' }: TranslatedTextProps) {
  const { lang } = useLanguage()
  const text = lang === 'zh' && zh?.trim() ? zh : en
  if (!text) return null
  return <Tag className={className}>{text}</Tag>
}
