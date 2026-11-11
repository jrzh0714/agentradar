import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { parseSearchPage, searchItems } from './search'

function mockDatabase(options: { empty?: boolean; fail?: boolean } = {}) {
  const requests: URL[] = []
  const client = createClient('https://example.supabase.co', 'test-server-key', {
    auth: { persistSession: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input))
        requests.push(url)
        if (options.fail) {
          return new Response(JSON.stringify({ message: 'Database unavailable' }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          })
        }
        const offset = Number(url.searchParams.get('offset') ?? 0)
        return new Response(JSON.stringify(options.empty ? [] : [{ id: `result-${offset + 1}` }]), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Range': options.empty ? '*/0' : `${offset}-${offset}/125`,
          },
        })
      },
    },
  })
  return { client, requests }
}

describe('search pagination and collections', () => {
  it('requests the second page with all filters and a unique sort tie-break', async () => {
    const db = mockDatabase()
    const result = await searchItems({
      q: 'mcp', page: 2, collection: 'agents', category: 'Code Agents',
      source: 'github', maturity: 'experimental', minScore: 0.8, dateRange: '7d', sort: 'stars',
    }, db.client)
    assert.equal(result.unavailable, false)
    assert.equal(result.total, 125)
    assert.equal(result.items[0].id, 'result-61')
    const params = db.requests[0].searchParams
    assert.equal(params.get('offset'), '60')
    assert.equal(params.get('limit'), '60')
    assert.equal(params.get('order'), 'github_stars.desc.nullslast,id.asc')
    assert.equal(params.get('source'), 'eq.github')
    assert.equal(params.get('ai_maturity'), 'eq.experimental')
    assert.ok(params.get('or')?.includes('title.ilike.%mcp%'))
    assert.ok(params.getAll('ai_category').includes('eq.Code Agents'))
    assert.ok(params.get('published_at')?.startsWith('gte.'))
    assert.ok(params.getAll('ai_relevance_score').includes('gte.0.8'))
  })

  it('news collection includes the complete homepage source and category scope', async () => {
    const db = mockDatabase()
    await searchItems({ collection: 'news' }, db.client)
    const params = db.requests[0].searchParams
    assert.equal(params.get('source'), 'in.(rss,hackernews)')
    const categories = params.get('ai_category') ?? ''
    for (const category of ['Research', 'Product Updates', 'AI Infrastructure', 'LLM Frameworks', 'Open Source Models']) {
      assert.ok(categories.includes(category), category)
    }
    assert.ok(params.getAll('ai_relevance_score').includes('gte.0.6'))
  })

  it('agents collection retains MCP, coding agents, and automation candidates', async () => {
    const db = mockDatabase()
    await searchItems({ collection: 'agents' }, db.client)
    const categories = db.requests[0].searchParams.get('ai_category') ?? ''
    for (const category of ['AI Agents', 'MCP / Tool Use', 'Code Agents', 'Workflow Automation']) {
      assert.ok(categories.includes(category), category)
    }
  })

  it('distinguishes database failure from a successful empty result', async () => {
    const emptyDb = mockDatabase({ empty: true })
    const failedDb = mockDatabase({ fail: true })
    assert.deepEqual(await searchItems({}, emptyDb.client), { items: [], total: 0, unavailable: false })
    assert.deepEqual(await searchItems({}, failedDb.client), { items: [], total: 0, unavailable: true })
  })

  it('normalizes invalid page values and bounds custom page sizes', async () => {
    for (const value of [undefined, [], '0', '-1', '1.5', '100001', 'NaN']) {
      assert.equal(parseSearchPage(value), 1)
    }
    assert.equal(parseSearchPage('2'), 2)
    const db = mockDatabase()
    await searchItems({ page: -5, limit: 1000 }, db.client)
    assert.equal(db.requests[0].searchParams.get('offset'), '0')
    assert.equal(db.requests[0].searchParams.get('limit'), '60')
  })
})
