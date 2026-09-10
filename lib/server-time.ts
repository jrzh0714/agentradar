import 'server-only'

/** Request-time clock for dynamic server routes and components. */
export function currentTimeMs(): number {
  return Date.now()
}
