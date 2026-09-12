import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { orderItemsForStablePagination } from './pagination'

describe('orderItemsForStablePagination', () => {
  it('uses the unique id as a deterministic tie-break for equal timestamps', () => {
    const orders: Array<{ column: string; ascending: boolean }> = []
    const query = {
      order(column: string, options: { ascending: boolean }) {
        orders.push({ column, ascending: options.ascending })
        return this
      },
    }

    assert.equal(orderItemsForStablePagination(query), query)
    assert.deepEqual(orders, [
      { column: 'created_at', ascending: true },
      { column: 'id', ascending: true },
    ])
  })
})
