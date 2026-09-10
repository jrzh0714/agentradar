import assert from 'node:assert/strict'
import test from 'node:test'
import { POST } from '@/app/api/subscribe/route'

test('subscribe endpoint fails closed when WAITLIST_ENABLED is missing', async () => {
  const previous = process.env.WAITLIST_ENABLED
  delete process.env.WAITLIST_ENABLED

  try {
    const response = await POST(
      new Request('http://localhost/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reader@example.com', source: 'digest' }),
      }),
    )

    assert.equal(response.status, 503)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'Waitlist signup is not available',
    })
  } finally {
    if (previous === undefined) delete process.env.WAITLIST_ENABLED
    else process.env.WAITLIST_ENABLED = previous
  }
})

test('subscribe endpoint treats non-true WAITLIST_ENABLED values as disabled', async () => {
  const previous = process.env.WAITLIST_ENABLED
  process.env.WAITLIST_ENABLED = '1'

  try {
    const response = await POST(new Request('http://localhost/api/subscribe', { method: 'POST' }))
    assert.equal(response.status, 503)
  } finally {
    if (previous === undefined) delete process.env.WAITLIST_ENABLED
    else process.env.WAITLIST_ENABLED = previous
  }
})

test('subscribe endpoint resumes normal validation when WAITLIST_ENABLED is true', async () => {
  const previous = process.env.WAITLIST_ENABLED
  process.env.WAITLIST_ENABLED = ' TRUE '

  try {
    const response = await POST(new Request('http://localhost/api/subscribe', { method: 'POST' }))
    assert.equal(response.status, 415)
  } finally {
    if (previous === undefined) delete process.env.WAITLIST_ENABLED
    else process.env.WAITLIST_ENABLED = previous
  }
})
