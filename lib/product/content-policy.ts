/** A rolling publication/activity window, not a claim of editorial verification. */
export function recentWindow(now = new Date()) {
  return { since: new Date(now.getTime() - 7 * 86_400_000).toISOString(), until: now.toISOString() }
}

export type RefreshState = 'current' | 'delayed' | 'unknown'

export function refreshState(
  lastCompletedAt: string | null,
  latestSucceeded: boolean | null,
  now = new Date(),
): RefreshState {
  if (!lastCompletedAt || latestSucceeded === null) return 'unknown'
  const age = now.getTime() - Date.parse(lastCompletedAt)
  if (!Number.isFinite(age) || age < 0) return 'unknown'
  return latestSucceeded && age <= 36 * 3_600_000 ? 'current' : 'delayed'
}
