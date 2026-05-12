/**
 * Temporary audit script — query DB for title quality issues.
 * Run: npx tsx scripts/audit-titles.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'

const BAD_TITLE_PATTERNS = [
  '', 'unknown', 'unknown article', 'untitled', 'untitled article',
  'no title', 'undefined', 'null', 'n/a',
]

function isBadTitle(t: string | null | undefined): boolean {
  if (!t || !t.trim()) return true
  return BAD_TITLE_PATTERNS.includes(t.trim().toLowerCase())
}

async function main() {
  const supabase = createServerClient()

  // 1. Fetch all items — just id, source, source_id, title, url, description, raw_data, published_at
  console.log('\n📊 Fetching all items for audit…\n')

  let allItems: Array<{
    id: string
    source: string
    source_id: string | null
    title: string | null
    url: string
    description: string | null
    raw_data: Record<string, unknown> | null
    published_at: string | null
    status: string
  }> = []

  let from = 0
  const batchSize = 500
  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, source, source_id, title, url, description, raw_data, published_at, status')
      .range(from, from + batchSize - 1)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    const rows = data ?? []
    allItems = [...allItems, ...(rows as typeof allItems)]
    if (rows.length < batchSize) break
    from += rows.length
  }

  console.log(`Total items in DB: ${allItems.length}`)

  // 2. Find bad titles
  const bad = allItems.filter((i) => isBadTitle(i.title))

  console.log(`\n❌ Items with bad/missing titles: ${bad.length} of ${allItems.length}`)

  // 3. Breakdown by source
  const bySource: Record<string, number> = {}
  for (const item of bad) {
    bySource[item.source] = (bySource[item.source] ?? 0) + 1
  }
  console.log('\nBreakdown by source:')
  for (const [src, count] of Object.entries(bySource)) {
    console.log(`  ${src}: ${count}`)
  }

  // 4. Top 30 problematic rows
  console.log('\n── Top 30 problematic rows ───────────────────────────────')
  const top30 = bad.slice(0, 30)
  for (const item of top30) {
    const rawTitle =
      (item.raw_data as Record<string, unknown> | null)?.title ??
      (item.raw_data as Record<string, unknown> | null)?.feedTitle ??
      null
    console.log(`\n  ID:         ${item.id}`)
    console.log(`  Source:     ${item.source}`)
    console.log(`  Source ID:  ${item.source_id ?? '—'}`)
    console.log(`  Title:      ${JSON.stringify(item.title)}`)
    console.log(`  URL:        ${item.url}`)
    console.log(`  Desc:       ${item.description?.slice(0, 80) ?? '—'}`)
    console.log(`  raw_data.title: ${JSON.stringify(rawTitle)}`)
    console.log(`  Published:  ${item.published_at ?? '—'}`)
    console.log(`  Status:     ${item.status}`)
  }

  // 5. HN prefix counts
  console.log('\n── HN title prefix counts ─────────────────────────────────')
  const hnItems = allItems.filter((i) => i.source === 'hackernews' && i.title)
  const prefixes = ['Show HN:', 'Ask HN:', 'Tell HN:']
  for (const prefix of prefixes) {
    const count = hnItems.filter((i) => i.title?.startsWith(prefix)).length
    console.log(`  "${prefix}" → ${count} items`)
  }
  console.log(`  Total HN items: ${hnItems.length}`)

  // 6. Sample HN Show/Ask/Tell titles
  console.log('\n── Sample HN prefixed titles (first 10) ────────────────────')
  const prefixed = hnItems
    .filter((i) => prefixes.some((p) => i.title?.startsWith(p)))
    .slice(0, 10)
  for (const item of prefixed) {
    console.log(`  "${item.title}"`)
  }

  // 7. RSS items where raw_data has a title but DB title is bad
  console.log('\n── RSS items: bad title but raw_data has title ─────────────')
  const rssBadWithRaw = bad.filter((i) => {
    if (i.source !== 'rss') return false
    const rd = i.raw_data as Record<string, unknown> | null
    return rd && (rd.title || rd.feedTitle)
  })
  console.log(`  Count: ${rssBadWithRaw.length}`)
  for (const item of rssBadWithRaw.slice(0, 10)) {
    const rd = item.raw_data as Record<string, unknown>
    console.log(`  DB title: ${JSON.stringify(item.title)}  raw.title: ${JSON.stringify(rd?.title)}`)
    console.log(`    URL: ${item.url}`)
  }

  // 8. Items with null title (not just empty string)
  const nullTitle = allItems.filter((i) => i.title === null)
  console.log(`\n── Null title items: ${nullTitle.length} ─────────────────────────────`)
  for (const item of nullTitle.slice(0, 5)) {
    const rd = item.raw_data as Record<string, unknown> | null
    console.log(`  [${item.source}] raw.title=${JSON.stringify(rd?.title)} url=${item.url.slice(0, 80)}`)
  }
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
