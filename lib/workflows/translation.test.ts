import assert from 'node:assert/strict'
import { it } from 'node:test'
import { PipelineLeaseLostError } from '@/lib/db/pipeline-lock'
import { runTranslation } from './translation'

for (const loseAt of [1, 2, null]) {
  it(`translation ${loseAt ? `stops on lease check ${loseAt}` : 'writes while ownership is confirmed'}`, async () => {
    const settings = {
      AI_PROVIDER: 'openai', OPENAI_API_KEY: `translation-test-credential-${loseAt ?? 'owned'}`,
      OPENAI_BASE_URL: 'https://example.test/v1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'translation-test-database-credential',
    }
    const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]))
    const originalFetch = globalThis.fetch
    let calls = 0
    let writes = 0
    let checks = 0
    Object.assign(process.env, settings)
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.startsWith('https://example.test/v1/')) {
        calls++
        return Response.json({ choices: [{ message: { content: JSON.stringify({ summary_zh: '工具摘要', why_it_matters_zh: '用途' }) } }] })
      }
      assert.ok(url.startsWith('https://example.supabase.co/rest/v1/items'))
      if (init?.method === 'PATCH') {
        writes++
        assert.equal(JSON.parse(String(init.body)).ai_summary_zh, '工具摘要')
        return new Response(null, { status: 204 })
      }
      return Response.json([{ id: 'item-1', ai_summary: 'A useful tool', ai_why_it_matters: 'Helps builders' }])
    }
    try {
      const result = runTranslation(1, async () => {
        checks++
        if (checks === loseAt) throw new PipelineLeaseLostError()
      })
      if (loseAt) await assert.rejects(result, PipelineLeaseLostError)
      else assert.deepEqual(await result, { translated: 1, failed: 0, skipped: 0 })
      assert.equal(calls, loseAt === 1 ? 0 : 1)
      assert.equal(writes, loseAt ? 0 : 1)
      assert.equal(checks, loseAt === 1 ? 1 : 2)
    } finally {
      globalThis.fetch = originalFetch
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })
}
