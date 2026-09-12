import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { enrichItem } from './enrich'
import type { Item } from '@/lib/db/types'

describe('enrichItem', () => {
  it('clears a stale error after a successful retry', async () => {
    const previousProvider = process.env.AI_PROVIDER
    process.env.AI_PROVIDER = 'mock'

    const item = {
      title: 'AgentRadar test item',
      url: 'https://example.com/agentradar',
      source: 'rss',
      description: 'A deterministic test item for the enrichment pipeline.',
      raw_content: null,
      github_stars: null,
      github_language: null,
      hn_points: null,
      hn_comments: null,
      status: 'failed',
      error_message: 'AI response failed validation',
    } as Item

    try {
      const result = await enrichItem(item)

      assert.equal(result.success, true)
      if (result.success) assert.equal(result.update.error_message, null)
    } finally {
      if (previousProvider === undefined) delete process.env.AI_PROVIDER
      else process.env.AI_PROVIDER = previousProvider
    }
  })
})
