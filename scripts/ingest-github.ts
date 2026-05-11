import { config } from 'dotenv'
config({ path: '.env.local' })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws is compatible enough for Supabase on Node < 22
  globalThis.WebSocket = WebSocket
}

import { fetchGithubItems } from '@/lib/ingestion/github'
import { upsertItems } from '@/lib/db/items'

async function main() {
  console.log('=== GitHub ingestion ===')

  const items = await fetchGithubItems()
  console.log(`\nFetched ${items.length} unique items`)

  if (items.length === 0) {
    console.log('Nothing to upsert.')
    return
  }

  console.log('Upserting to Supabase...')
  const result = await upsertItems(items)

  if (result.error) {
    console.error('✗ Upsert failed:', result.error)
    process.exit(1)
  }

  console.log(`✓ Done — ${result.inserted} rows upserted, ${result.skipped} skipped`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
