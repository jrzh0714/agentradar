// Re-export all database types from the canonical source.
// Import from here or directly from 'lib/db/types' — both work.
export type {
  ItemSource,
  ItemStatus,
  Item,
  ItemInsert,
  ItemEnrichmentUpdate,
  ItemFailureUpdate,
  ItemCard,
  Digest,
  DigestInsert,
  DigestItem,
  DigestItemInsert,
  DigestWithItems,
  RssFeed,
  RssFeedInsert,
} from '@/lib/db/types'
