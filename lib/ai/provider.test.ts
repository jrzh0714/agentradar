import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeModel,
  callAi,
  ProviderBillingError,
  ProviderAuthenticationError,
  ProviderRequestError,
  sanitizeProviderErrorDetail,
} from './provider'

describe('provider failure handling', () => {
  it('redacts masked and malformed-prefix keys from diagnostics', () => {
    const token = ['sk', 'proj', 'aB3_'.repeat(8)].join('-')
    const masked = ['sk', 'proj', '*'.repeat(60) + 'abcd'].join('-')
    for (const secret of [token, masked]) {
      const result = sanitizeProviderErrorDetail(`Rejected xx${secret}`)
      assert.ok(!result.includes(secret))
      assert.ok(!result.includes('abcd'))
    }
  })

  it('uses a rotated key and stops authentication failures without leaking the response', async () => {
    const old = { provider: process.env.AI_PROVIDER, key: process.env.OPENAI_API_KEY, base: process.env.OPENAI_BASE_URL, fetch: globalThis.fetch }
    const firstKey = 'test-first-credential'
    const nextKey = 'test-rotated-credential'
    const seen: Array<string | null> = []
    process.env.AI_PROVIDER = 'openai'
    process.env.OPENAI_BASE_URL = 'https://example.test/v1'
    globalThis.fetch = async (_input, init) => {
      const authorization = new Headers(init?.headers).get('authorization')
      seen.push(authorization)
      return authorization === `Bearer ${firstKey}`
        ? new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), { headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ error: { message: 'upstream-sensitive-detail', code: 'invalid_api_key', type: 'invalid_request_error' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    }
    try {
      process.env.OPENAI_API_KEY = firstKey
      assert.equal(await callAi({ systemPrompt: 'Return JSON.', userMessage: 'Return JSON.' }), '{"ok":true}')
      process.env.OPENAI_API_KEY = nextKey
      await assert.rejects(callAi({ systemPrompt: 'Return JSON.', userMessage: 'Return JSON.' }), (error: unknown) => {
        assert.ok(error instanceof ProviderAuthenticationError)
        assert.ok(error instanceof ProviderRequestError)
        assert.ok(!error.message.includes('upstream-sensitive-detail'))
        assert.match(error.message, /Replace the API key/)
        return true
      })
      assert.deepEqual(seen, [`Bearer ${firstKey}`, `Bearer ${nextKey}`])
    } finally {
      globalThis.fetch = old.fetch
      for (const [key, value] of Object.entries({ AI_PROVIDER: old.provider, OPENAI_API_KEY: old.key, OPENAI_BASE_URL: old.base })) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  it('redacts credentials and control characters from provider errors', () => {
    const secret = 'sk-proj-exampleSecretValue123456789'
    const sanitized = sanitizeProviderErrorDetail(
      `Headers.append: "Bearer ${secret}\n\n# GitHub" is invalid`,
    )
    assert.equal(sanitized.includes(secret), false)
    assert.equal(sanitized.includes('\n'), false)
    assert.match(sanitized, /Bearer \[REDACTED\]/)
  })

  it('treats billing failures as provider request failures', () => {
    const error = new ProviderBillingError('openai', 'insufficient_quota')
    assert.ok(error instanceof ProviderRequestError)
    assert.match(error.message, /billing\/quota error/)
  })

  it('wraps missing OpenAI credentials before any network request', async () => {
    const previousProvider = process.env.AI_PROVIDER
    const previousKey = process.env.OPENAI_API_KEY
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_API_KEY

    try {
      await assert.rejects(
        () => callAi({ systemPrompt: 'Return JSON.', userMessage: 'Return JSON.' }),
        ProviderRequestError,
      )
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER
      else process.env.AI_PROVIDER = previousProvider
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousKey
    }
  })

  it('rejects malformed OpenAI credentials without leaking them', async () => {
    const previousProvider = process.env.AI_PROVIDER
    const previousKey = process.env.OPENAI_API_KEY
    const secret = 'sk-proj-exampleSecretValue123456789'
    process.env.AI_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = `${secret}\n# accidental suffix`

    try {
      await assert.rejects(
        () => callAi({ systemPrompt: 'Return JSON.', userMessage: 'Return JSON.' }),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError)
          assert.match(error.message, /contains whitespace/)
          assert.equal(error.message.includes(secret), false)
          return true
        },
      )
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER
      else process.env.AI_PROVIDER = previousProvider
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = previousKey
    }
  })

  it('uses the pinned GPT-5.4 nano snapshot by default', () => {
    const previousProvider = process.env.AI_PROVIDER
    const previousModel = process.env.OPENAI_MODEL
    process.env.AI_PROVIDER = 'openai'
    delete process.env.OPENAI_MODEL

    try {
      assert.equal(activeModel(), 'gpt-5.4-nano-2026-03-17')
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER
      else process.env.AI_PROVIDER = previousProvider
      if (previousModel === undefined) delete process.env.OPENAI_MODEL
      else process.env.OPENAI_MODEL = previousModel
    }
  })

  it('fails closed instead of pricing an unknown provider as mock', () => {
    const previousProvider = process.env.AI_PROVIDER
    process.env.AI_PROVIDER = 'typo'

    try {
      assert.throws(() => activeModel(), /Unsupported AI provider/)
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER
      else process.env.AI_PROVIDER = previousProvider
    }
  })
})
