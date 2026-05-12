/**
 * Title normalization utilities for AgentRadar.
 *
 * Pure functions — no I/O, no side effects. Safe to import in any context:
 * ingestion scripts, server components, API routes, and tests.
 */

// ── Placeholder patterns ───────────────────────────────────────────────────────

/** Lower-cased strings that should be treated as "no title". */
const NULL_TITLE_PATTERNS = new Set([
  '',
  'unknown',
  'unknown article',
  'untitled',
  'untitled article',
  'no title',
  'undefined',
  'null',
  'n/a',
  '-',
])

// ── HN prefix types ────────────────────────────────────────────────────────────

export type HnPrefix = 'Show HN' | 'Ask HN' | 'Tell HN'

const HN_PREFIX_PATTERNS: { prefix: HnPrefix; pattern: RegExp }[] = [
  { prefix: 'Show HN', pattern: /^Show HN:\s*/i },
  { prefix: 'Ask HN',  pattern: /^Ask HN:\s*/i },
  { prefix: 'Tell HN', pattern: /^Tell HN:\s*/i },
]

// ── Core normalisation ─────────────────────────────────────────────────────────

/**
 * Normalize a raw title string:
 * - Trims leading/trailing whitespace.
 * - Collapses internal runs of whitespace / newlines / tabs to a single space.
 * - Returns `null` if the result is empty or matches a known placeholder value.
 */
export function normalizeTitle(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const cleaned = raw
    .replace(/[\r\n\t]+/g, ' ') // newlines / tabs → space
    .replace(/\s{2,}/g, ' ')    // repeated spaces → single space
    .trim()
  if (!cleaned || NULL_TITLE_PATTERNS.has(cleaned.toLowerCase())) return null
  return cleaned
}

// ── HN prefix helpers ──────────────────────────────────────────────────────────

/**
 * Return the HN prefix embedded in a title, or `null` if there is none.
 *
 * Examples:
 *   "Show HN: My Project" → 'Show HN'
 *   "Ask HN: Is X worth it?" → 'Ask HN'
 *   "Normal title" → null
 */
export function getTitlePrefix(title: string | null | undefined): HnPrefix | null {
  if (!title) return null
  for (const { prefix, pattern } of HN_PREFIX_PATTERNS) {
    if (pattern.test(title)) return prefix
  }
  return null
}

/**
 * Remove the leading "Show HN:", "Ask HN:", or "Tell HN:" prefix (and any
 * trailing whitespace) from a title, returning the remainder.
 * If no recognized prefix is found, returns the title unchanged.
 */
export function cleanHnTitle(title: string): string {
  for (const { pattern } of HN_PREFIX_PATTERNS) {
    if (pattern.test(title)) return title.replace(pattern, '').trim()
  }
  return title
}

// ── Derivation helpers ─────────────────────────────────────────────────────────

/**
 * Derive a readable title from the last meaningful path segment of a URL.
 * Hyphens and underscores are replaced with spaces and the result is
 * title-cased.
 *
 * Returns `null` if no usable segment is found.
 *
 * @example
 *   "/blog/agent-observability-needs-feedback" → "Agent Observability Needs Feedback"
 *   "/p/12345"                                 → null   (short numeric id)
 *   "https://example.com/"                     → null
 */
export function deriveTitleFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url)
    const segments = pathname.split('/').filter(Boolean)
    // Walk backwards; skip pure numbers, short tokens, and UUID-like segments.
    const segment = [...segments].reverse().find((s) => {
      if (/^\d+$/.test(s)) return false          // pure number
      if (s.length < 4) return false             // too short to be meaningful
      if (/^[0-9a-f]{8}-/.test(s)) return false  // UUID prefix
      return true
    })
    if (!segment) return null
    return segment
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    return null
  }
}

/**
 * Derive a short title from the first sentence of a description.
 * Returns `null` if the description is absent or too short to be informative.
 */
export function deriveTitleFromDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) return null
  const sentence = description.trim().split(/[.\n]/)[0]?.trim() ?? ''
  if (sentence.length < 10) return null
  return sentence.length <= 100 ? sentence : sentence.slice(0, 97) + '…'
}

// ── Main display helper ────────────────────────────────────────────────────────

/**
 * Return the best display title for an item.
 *
 * Resolution order:
 * 1. HN sources: strip the Show/Ask/Tell HN prefix, then normalise.
 * 2. Normalise the stored title.
 * 3. Derive from URL path segment.
 * 4. Derive from description first sentence.
 * 5. Hard fallback: "Untitled article".
 *
 * The stored `title` in the DB is never mutated by this function.
 */
export function getDisplayTitle(item: {
  title: string | null
  source: string
  url: string
  description?: string | null
}): string {
  // 1. HN: strip prefix, then normalise
  if (item.source === 'hackernews' && item.title) {
    const stripped = cleanHnTitle(item.title)
    const normalized = normalizeTitle(stripped)
    if (normalized) return normalized
  }

  // 2. Normalise stored title
  const stored = normalizeTitle(item.title)
  if (stored) return stored

  // 3. Derive from URL
  const fromUrl = deriveTitleFromUrl(item.url)
  if (fromUrl) return fromUrl

  // 4. Derive from description
  const fromDesc = deriveTitleFromDescription(item.description)
  if (fromDesc) return fromDesc

  // 5. Hard fallback
  return 'Untitled article'
}
