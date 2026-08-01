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

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  source: z.enum(['digest', 'homepage']).default('digest'),
})

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
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
