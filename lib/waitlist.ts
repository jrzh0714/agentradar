import 'server-only'

/**
 * Waitlist collection is opt-in. Any missing, empty, or unrecognized value
 * keeps both the UI and API closed.
 */
export function isWaitlistEnabled(): boolean {
  return process.env.WAITLIST_ENABLED?.trim().toLowerCase() === 'true'
}
