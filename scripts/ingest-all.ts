import { config } from 'dotenv'
config({ path: '.env.local' })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws is compatible enough for Supabase on Node < 22
  globalThis.WebSocket = WebSocket
}

import { fetchGithubItems } from '@/lib/ingestion/github'
import { fetchHnItems } from '@/lib/ingestion/hn'
import { fetchRssItems } from '@/lib/ingestion/rss'
import { upsertItems } from '@/lib/db/items'

async function runSource(
  name: string,
  fetcher: () => Promise<import('@/lib/db/types').ItemInsert[]>,
): Promise<void> {
  console.log(`\n=== ${name} ===`)
  try {
    const items = await fetcher()
    console.log(`Fetched ${items.length} unique items`)

    if (items.length === 0) {
      console.log('Nothing to upsert.')
      return
    }

    const result = await upsertItems(items)
    if (result.error) {
      console.error(`✗ Upsert failed: ${result.error}`)
    } else {
      console.log(`✓ ${result.inserted} rows upserted, ${result.skipped} skipped`)
    }
  } catch (err) {
    console.error(`✗ ${name} failed:`, err instanceof Error ? err.message : err)
  }
}

async function main() {
  const start = Date.now()
  console.log('=== AgentRadar — ingest all sources ===')

  await runSource('GitHub', fetchGithubItems)
  await runSource('Hacker News', fetchHnItems)
  await runSource('RSS', fetchRssItems)

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n=== Done in ${elapsed}s ===`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
