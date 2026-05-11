import { createServerClient } from '@/lib/supabase/server'
import type { ItemInsert } from '@/lib/db/types'

/**
 * Upsert a batch of items by canonical_url.
 * Existing rows are updated (e.g. refreshed star counts); new rows are inserted.
 * Items without a canonical_url are skipped to avoid uncontrolled duplicates.
 *
 * Returns { inserted, updated, skipped } counts.
 */
export async function upsertItems(items: ItemInsert[]): Promise<{
  inserted: number
  skipped: number
  error: string | null
}> {
  const valid = items.filter((i) => !!i.canonical_url)
  const skipped = items.length - valid.length

  if (skipped > 0) {
    console.warn(`  ⚠ Skipped ${skipped} items with no canonical_url`)
  }

  if (valid.length === 0) {
    return { inserted: 0, skipped, error: null }
  }

  const supabase = createServerClient()

  const { error, count } = await supabase
    .from('items')
    .upsert(valid, {
      onConflict: 'canonical_url',
      ignoreDuplicates: false,   // update existing rows (refresh star counts etc.)
      count: 'exact',
    })

  if (error) {
    return { inserted: 0, skipped, error: error.message }
  }

  return { inserted: count ?? valid.length, skipped, error: null }
}
