'use client'

import { useT } from '@/components/T'

interface Props {
  count: number
  q: string
}

export function SearchResultsLabel({ count, q }: Props) {
  const t = useT()
  if (q) {
    return (
      <>
        {count} {t('search.results_for')} &quot;{q}&quot;
      </>
    )
  }
  return (
    <>
      {count} {count !== 1 ? t('search.high_signal_pl') : t('search.high_signal')}
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
