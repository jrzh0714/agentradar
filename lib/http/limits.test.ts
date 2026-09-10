import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBoundedPositiveInt } from './limits'

describe('parseBoundedPositiveInt', () => {
  const options = { fallback: 25, max: 100 }

  it('accepts a positive integer', () => {
    assert.equal(parseBoundedPositiveInt('50', options), 50)
  })

  it('clamps values to the maximum', () => {
    assert.equal(parseBoundedPositiveInt('1000', options), 100)
  })

  for (const value of [undefined, null, '', '0', '-1', '1.5', 'nope']) {
    it(`uses the fallback for ${String(value)}`, () => {
      assert.equal(parseBoundedPositiveInt(value, options), options.fallback)
    })
  }
})
