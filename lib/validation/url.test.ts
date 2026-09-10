import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HttpUrlSchema } from './url'

describe('HttpUrlSchema', () => {
  it('accepts HTTP and HTTPS URLs', () => {
    assert.equal(HttpUrlSchema.safeParse('https://example.com/path?q=1').success, true)
    assert.equal(HttpUrlSchema.safeParse('http://localhost:3000/path').success, true)
  })

  for (const [label, value] of [
    ['JavaScript schemes', 'javascript:alert(1)'],
    ['data schemes', 'data:text/html,hello'],
    ['file schemes', 'file:///etc/passwd'],
    ['embedded credentials', 'https://user:password@example.com/private'],
  ]) {
    it(`rejects ${label}`, () => {
      assert.equal(HttpUrlSchema.safeParse(value).success, false)
    })
  }
})
