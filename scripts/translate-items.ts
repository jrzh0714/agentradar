/**
 * Translate enriched items into Simplified Chinese.
 *
 * Usage:
 *   npm run translate                   # translate top 30 untranslated items
 *   npm run translate -- --limit 100    # translate up to 100
 *   npm run translate -- --dry-run      # preview items, no API calls
 */
import { config } from 'dotenv'

config({ path: '.env.local', override: true })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'
import { runTranslation } from '@/lib/workflows/translation'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : 30

async function main() {
  console.log('\n🌐 AgentRadar — Simplified Chinese Translation')
  console.log(`   Limit   : ${limit}`)
  console.log(`   Dry-run : ${dryRun}\n`)

  if (dryRun) {
    const supabase = createServerClient()
    const { data, count } = await supabase
      .from('items')
      .select('id, title, ai_summary', { count: 'exact' })
      .eq('status', 'enriched')
      .not('ai_summary', 'is', null)
      .is('ai_summary_zh', null)
      .order('ranking_score', { ascending: false })
      .limit(limit)

    console.log(`  ${count ?? 0} items pending translation (total)`)
    console.log(`  Preview (first ${Math.min(limit, (data ?? []).length)}):\n`)
    for (const item of (data ?? []) as Array<{ title: string; ai_summary: string }>) {
      console.log(`  • ${item.title.slice(0, 70)}`)
      console.log(`    ${item.ai_summary?.slice(0, 100) ?? '—'}\n`)
    }
    return
  }

  const result = await runTranslation(limit)

  console.log(`  Translated : ${result.translated}`)
  console.log(`  Failed     : ${result.failed}`)
  console.log(`  Skipped    : ${result.skipped}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
