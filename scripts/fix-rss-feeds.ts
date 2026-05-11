/**
 * One-time script to fix RSS feed URLs that were invalid at initial seed.
 * Run with: npm run fix:rss-feeds
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws polyfill for Node < 22
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '@/lib/supabase/server'

const FIXES = [
  {
    match: 'https://www.anthropic.com/rss.xml',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    category_hint: 'ai-research',
  },
  {
    match: 'https://blog.langchain.dev/rss/',
    name: 'LangChain Blog',
    url: 'https://www.langchain.com/blog/rss.xml',
    category_hint: 'agent-frameworks',
  },
]

async function main() {
  const supabase = createServerClient()

  for (const fix of FIXES) {
    console.log(`Updating: ${fix.match} → ${fix.url}`)
    const { error } = await supabase
      .from('rss_feeds')
      .update({ name: fix.name, url: fix.url, category_hint: fix.category_hint })
      .eq('url', fix.match)

    if (error) {
      console.error(`  ✗ Failed: ${error.message}`)
    } else {
      console.log(`  ✓ Updated`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
