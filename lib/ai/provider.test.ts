import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activeModel,
  callAi,
  ProviderBillingError,
  ProviderRequestError,
  sanitizeProviderErrorDetail,
} from './provider'

describe('provider failure handling', () => {
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
