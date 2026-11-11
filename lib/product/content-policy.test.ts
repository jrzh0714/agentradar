import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { getDigestSections } from '@/lib/db/digest'
import { recentWindow, refreshState } from './content-policy'

const now = new Date('2026-11-11T12:00:00Z')

describe('honest freshness and coverage', () => {
  it('uses an exact seven-day window independent of host timezone', () => {
    assert.deepEqual(recentWindow(now), { since: '2026-11-04T12:00:00.000Z', until: '2026-11-11T12:00:00.000Z' })
  })

  it('does not imply freshness from a failed, stale, or unknown refresh', () => {
    assert.equal(refreshState('2026-11-11T08:00:00Z', true, now), 'current')
    assert.equal(refreshState('2026-11-11T08:00:00Z', false, now), 'delayed')
    assert.equal(refreshState('2026-11-08T08:00:00Z', true, now), 'delayed')
    assert.equal(refreshState(null, false, now), 'unknown')
    assert.equal(refreshState('invalid', true, now), 'unknown')
    assert.equal(refreshState('2026-11-12T08:00:00Z', true, now), 'unknown')
  })

  it('bounds every digest section and leaves empty periods empty', async () => {
    const requests: URL[] = []
    const client = createClient('https://example.supabase.co', 'test-server-key', {
      auth: { persistSession: false },
      global: { fetch: async (input) => {
        requests.push(new URL(String(input)))
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
      } },
    })
    const sections = await getDigestSections(now, client)
    assert.equal(requests.length, 6)
    for (const request of requests) {
      assert.deepEqual(request.searchParams.getAll('published_at'), [
        'gte.2026-11-04T12:00:00.000Z', 'lte.2026-11-11T12:00:00.000Z',
      ])
    }
    assert.ok(sections.every((section) => section.items.length === 0))
  })
})
