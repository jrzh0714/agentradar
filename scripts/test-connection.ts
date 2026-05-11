/**
 * Quick connection test — run with:
 *   npx tsx scripts/test-connection.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

// Node.js < 22 has no native WebSocket — polyfill for scripts only
import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws WebSocket is compatible enough for Supabase realtime
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '../lib/supabase/server'

async function main() {
  console.log('Testing Supabase connection...')
  const supabase = createServerClient()

  // Simple query — will succeed even with no tables yet
  const { error } = await supabase.from('_test_nonexistent').select('*').limit(1)

  // Any response from PostgREST (even "table not found") confirms connectivity
  const isConnected =
    !error ||
    error.code === 'PGRST116' ||
    error.message.includes('does not exist') ||
    error.message.includes('schema cache') ||
    error.message.includes('not find the table')

  if (isConnected) {
    console.log('✅ Supabase connected successfully')
    console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)
  } else {
    console.error('❌ Supabase connection failed:', error.message)
    process.exit(1)
  }
}

main()
