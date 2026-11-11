import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { PipelineLeaseLostError, renewPipelineLease } from './pipeline-lock'

function leaseDatabase(ownerToken: string, expiresAt: string, unavailable = false) {
  const row = { name: 'daily-refresh', owner_token: ownerToken, expires_at: expiresAt }
  let requests = 0
  const client = createClient('https://example.supabase.co', 'test-server-key', {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        requests++
        assert.equal(init?.method, 'PATCH')
        if (unavailable) return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 400 })
        const url = new URL(String(input))
        const matches = url.searchParams.get('name') === `eq.${row.name}` &&
          url.searchParams.get('owner_token') === `eq.${row.owner_token}` &&
          Date.parse(row.expires_at) > Date.parse(url.searchParams.get('expires_at')!.slice(3))
        if (matches) row.expires_at = JSON.parse(String(init?.body)).expires_at
        return new Response(JSON.stringify(matches ? [{ name: row.name }] : []), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  })
  return { client, row, requests: () => requests }
}

describe('pipeline lease renewal', () => {
  it('extends an active owned lease', async () => {
    const db = leaseDatabase('worker-a', new Date(Date.now() + 60_000).toISOString())
    const before = db.row.expires_at
    await renewPipelineLease({ name: 'daily-refresh', ownerToken: 'worker-a' }, 600_000, db.client)
    assert.ok(db.row.expires_at > before)
    assert.equal(db.requests(), 1)
  })

  it('cannot take over another worker lease or extend its expiry', async () => {
    const expiry = new Date(Date.now() + 60_000).toISOString()
    const db = leaseDatabase('worker-b', expiry)
    await assert.rejects(
      renewPipelineLease({ name: 'daily-refresh', ownerToken: 'worker-a' }, 600_000, db.client),
      PipelineLeaseLostError,
    )
    assert.equal(db.row.expires_at, expiry)
  })

  it('cannot resurrect an expired lease', async () => {
    const expiry = new Date(Date.now() - 60_000).toISOString()
    const db = leaseDatabase('worker-a', expiry)
    await assert.rejects(
      renewPipelineLease({ name: 'daily-refresh', ownerToken: 'worker-a' }, 600_000, db.client),
      PipelineLeaseLostError,
    )
    assert.equal(db.row.expires_at, expiry)
  })

  it('fails closed when the database cannot confirm ownership', async () => {
    const db = leaseDatabase('worker-a', new Date().toISOString(), true)
    await assert.rejects(
      renewPipelineLease({ name: 'daily-refresh', ownerToken: 'worker-a' }, 600_000, db.client),
      /Pipeline lease renewal failed/,
    )
  })
})
