import { createServerClient } from '@/lib/supabase/server'

/** Returns the Monday of the current week as a Date at midnight UTC. */
export function getCurrentMonday(): Date {
  const now = new Date()
  const day = now.getDay() // 0 = Sun, 1 = Mon
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Fetches all digest summaries for the given week.
 * Returns a Map<category, summary> for O(1) lookups in the digest page.
 * Returns empty Map on error (graceful degradation — digest renders without summaries).
 */
export async function getDigestSummariesForWeek(weekOf: Date): Promise<Map<string, string>> {
  const supabase = createServerClient()
  const weekStr = weekOf.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('digest_summaries')
    .select('category, summary')
    .eq('week_of', weekStr)

  if (error) {
    console.error('[digest-summaries] Fetch failed:', error.message)
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set((row as { category: string; summary: string }).category, (row as { category: string; summary: string }).summary)
  }
  return map
}
