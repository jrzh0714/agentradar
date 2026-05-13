/**
 * /api/refresh/stars — weekly GitHub star/fork count refresh.
 *
 * Re-fetches live star counts for all GitHub repos so the discovery filter
 * (MAX_EMERGING_STARS) stays accurate as repos grow over time.
 *
 * Runs every Sunday at 06:00 UTC (see vercel.json). Can also be triggered
 * manually for testing.
 *
 * Auth: Bearer <CRON_SECRET> required.
 */
import { type NextRequest, NextResponse } from 'next/server'

// Allow up to 5 minutes — 2,000 repos × 150ms delay = ~5 min.
export const maxDuration = 300

const GITHUB_API = 'https://api.github.com/repos'
const BATCH_SIZE = 10
const REQUEST_DELAY_MS = 150

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[refresh/stars] CRON_SECRET is not set — all requests denied.')
    return false
  }
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${cronSecret}`
}

function extractOwnerRepo(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2 || !parts[0] || !parts[1]) return null
    return `${parts[0]}/${parts[1]}`
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 })
  }

  const { createServerClient } = await import('@/lib/supabase/server')
  const supabase = createServerClient()
  const start = Date.now()

  // Fetch limit from query param (default: no cap)
  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 0

  // Fetch all GitHub items
  let query = supabase
    .from('items')
    .select('id, url, github_stars, github_forks')
    .eq('source', 'github')
    .not('url', 'is', null)
    .order('created_at', { ascending: true })

  if (limit > 0) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: `DB fetch failed: ${error.message}` }, { status: 500 })
  }

  type Row = { id: string; url: string; github_stars: number | null; github_forks: number | null }
  const items = (data ?? []) as Row[]

  let checked = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const ownerRepo = extractOwnerRepo(item.url)
    if (!ownerRepo) { skipped++; continue }

    try {
      const res = await fetch(`${GITHUB_API}/${ownerRepo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (res.status === 404) { skipped++; continue }
      if (!res.ok) { skipped++; continue }

      const repo = await res.json() as { stargazers_count?: number; forks_count?: number }
      const newStars = repo.stargazers_count ?? 0
      const newForks = repo.forks_count ?? 0
      checked++

      if (newStars !== (item.github_stars ?? 0) || newForks !== (item.github_forks ?? 0)) {
        const { error: updateErr } = await supabase
          .from('items')
          .update({ github_stars: newStars, github_forks: newForks })
          .eq('id', item.id)

        if (updateErr) {
          console.error(`[refresh/stars] Update failed for ${ownerRepo}:`, updateErr.message)
          failed++
        } else {
          updated++
        }
      }
    } catch (err) {
      console.error(`[refresh/stars] Error for ${ownerRepo}:`, err instanceof Error ? err.message : err)
      failed++
    }

    if (i < items.length - 1 && (i + 1) % BATCH_SIZE === 0) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  return NextResponse.json({
    success: true,
    total: items.length,
    checked,
    updated,
    skipped,
    failed,
    durationMs: Date.now() - start,
  })
}

export const GET = handler
