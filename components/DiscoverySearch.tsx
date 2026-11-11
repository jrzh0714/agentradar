'use client'

import { useLanguage } from '@/components/LanguageProvider'

/** Native GET search keeps discovery usable before client hydration. */
export function DiscoverySearch() {
  const { lang } = useLanguage()
  const zh = lang === 'zh'
  return (
    <form action="/search" method="get" role="search" className="discovery-search">
      <label htmlFor="discover-query" className="sr-only">{zh ? '查找工具或技术主题' : 'Find a tool or technical topic'}</label>
      <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <input id="discover-query" name="q" type="search" maxLength={120} placeholder={zh ? '搜索 MCP、代码 Agent、RAG…' : 'Search MCP, coding agents, RAG…'} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500" />
      <button type="submit" className="button-primary shrink-0">{zh ? '探索' : 'Explore'} <span aria-hidden="true">→</span></button>
    </form>
  )
}
