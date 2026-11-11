/**
 * Read-only database, GitHub, and OpenAI checks. No completion/token requests.
 *   npm run check:connections
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })

// Node.js < 22 has no native WebSocket — polyfill for scripts only
import { WebSocket } from 'ws'
if (!('WebSocket' in globalThis)) {
  // @ts-expect-error ws WebSocket is compatible enough for Supabase realtime
  globalThis.WebSocket = WebSocket
}

import { createServerClient } from '../lib/supabase/server'

async function main() {
  const supabase = createServerClient()
  const { error } = await supabase.from('items').select('id', { head: true }).limit(1)
  console.log(`Database item access: ${error ? 'FAILED' : 'OK'}`)
  if (error) process.exitCode = 1

  const githubToken = process.env.GITHUB_TOKEN?.trim()
  if (!githubToken || /\s/.test(githubToken)) {
    console.log('GitHub search access: FAILED — missing or malformed ingestion token')
    process.exitCode = 1
  } else {
    const github = await fetch('https://api.github.com/search/repositories?q=mcp+server+stars%3A%3E20+fork%3Afalse&per_page=1', {
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15_000),
    })
    console.log(`GitHub search access: ${github.ok ? 'OK' : `FAILED (HTTP ${github.status})`}`)
    if (!github.ok) process.exitCode = 1
  }

  const provider = process.env.AI_PROVIDER ?? 'openai'
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY?.trim()
    if (!key || /\s/.test(key)) {
      console.log('OpenAI access: FAILED — missing or malformed API key')
      process.exitCode = 1
      return
    }
    const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
    const model = process.env.OPENAI_MODEL ?? 'gpt-5.4-nano-2026-03-17'
    const response = await fetch(`${base}/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    })
    console.log(`OpenAI model access: ${response.ok ? 'OK' : `FAILED (HTTP ${response.status})`}`)
    if (response.status === 401) console.log('Replace OPENAI_API_KEY in the affected environment; production requires a redeploy.')
    if (!response.ok) process.exitCode = 1
    console.log('No completion requested. This check does not establish billing or complimentary-token eligibility.')
  } else {
    console.log('OpenAI access: not checked — a different provider is configured')
  }
}

main().catch(() => {
  // Do not echo upstream messages or request objects containing credentials.
  console.error('Connection check failed. Verify network access and server configuration.')
  process.exitCode = 1
})
