'use client'

import { useT } from '@/components/T'
import { TranslatedText } from '@/components/TranslatedText'

interface Props {
  count: number
  shownCount: number
  q: string
  offset?: number
}

export function SearchResultsLabel({ count, shownCount, q, offset = 0 }: Props) {
  const t = useT()
  const range = shownCount > 0 && (offset > 0 || count > shownCount)
    ? <TranslatedText as="span" en={` · showing ${offset + 1}–${offset + shownCount}`} zh={` · 显示第 ${offset + 1}–${offset + shownCount} 条`} />
    : null
  if (q) {
    return (
      <>
        {count} {t('search.results_for')} &quot;{q}&quot;
        {range}
      </>
    )
  }
  return (
    <>
      {count} {count !== 1 ? t('search.high_signal_pl') : t('search.high_signal')}
      {range}
    </>
  )
}

interface SortLabelProps {
  sort: string
}

const SORT_LABEL_KEYS: Record<string, 'search.sort_label_radar' | 'search.sort_label_newest' | 'search.sort_label_relevance' | 'search.sort_label_stars' | 'search.sort_label_discussed'> = {
  ranking:   'search.sort_label_radar',
  newest:    'search.sort_label_newest',
  relevance: 'search.sort_label_relevance',
  stars:     'search.sort_label_stars',
  discussed: 'search.sort_label_discussed',
}

export function SortedByLabel({ sort }: SortLabelProps) {
  const t = useT()
  const key = SORT_LABEL_KEYS[sort]
  return (
    <>· {t('search.sorted_by')} {key ? t(key) : sort}</>
  )
}
