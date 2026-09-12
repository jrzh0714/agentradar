interface OrderableQuery {
  order(column: string, options: { ascending: boolean }): OrderableQuery
}

/** Apply a total order so offset-based pages cannot reshuffle timestamp ties. */
export function orderItemsForStablePagination<T extends OrderableQuery>(query: T): T {
  return query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }) as T
}
