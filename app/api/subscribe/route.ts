/**
 * /api/subscribe — digest email signup.
 *
 * Stores the email in the subscribers table. No email sending exists yet —
 * this endpoint measures demand for a digest email before delivery is built.
 *
 * Auth: none — public endpoint. Duplicate signups return success (idempotent
 * from the visitor's perspective; the unique constraint dedupes silently).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { isWaitlistEnabled } from '@/lib/waitlist'

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(['digest', 'homepage']).default('digest'),
})

const MAX_BODY_BYTES = 1_024
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000
const RATE_LIMIT_ATTEMPTS = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

class RequestTooLargeError extends Error {}

async function readLimitedJson(req: Request): Promise<unknown> {
  if (!req.body) throw new SyntaxError('Missing body')

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new RequestTooLargeError('Request too large')
    }
    chunks.push(value)
  }

  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(body))
}

function getClientKey(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

function isRateLimited(key: string): { limited: boolean; retryAfter: number } {
  const now = Date.now()
  if (attempts.size > 10_000) {
    for (const [storedKey, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(storedKey)
    }
  }
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { limited: false, retryAfter: 0 }
  }
  current.count += 1
  return {
    limited: current.count > RATE_LIMIT_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isWaitlistEnabled()) {
    return NextResponse.json(
      { ok: false, error: 'Waitlist signup is not available' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ ok: false, error: 'Expected JSON' }, { status: 415 })
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 })
  }

  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const rateLimit = isRateLimited(getClientKey(req))
  if (rateLimit.limited) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    )
  }

  let body: unknown
  try {
    body = await readLimitedJson(req)
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return NextResponse.json({ ok: false, error: 'Request too large' }, { status: 413 })
    }
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 })
  }

  const { email, source } = parsed.data

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('subscribers').insert({ email, source })

    // 23505 = unique_violation — already subscribed; treat as success
    if (error && error.code !== '23505') {
      console.error('[subscribe] insert error:', error.message)
      return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[subscribe] unexpected error:', err)
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 })
  }
}
