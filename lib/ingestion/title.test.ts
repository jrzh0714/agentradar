/**
 * Unit tests for lib/ingestion/title.ts
 * Run: npm test
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTitle,
  getTitlePrefix,
  cleanHnTitle,
  deriveTitleFromUrl,
  deriveTitleFromDescription,
  getDisplayTitle,
} from './title'

// ── normalizeTitle ─────────────────────────────────────────────────────────────

describe('normalizeTitle', () => {
  it('returns null for null input', () => {
    assert.equal(normalizeTitle(null), null)
  })

  it('returns null for undefined input', () => {
    assert.equal(normalizeTitle(undefined), null)
  })

  it('returns null for empty string', () => {
    assert.equal(normalizeTitle(''), null)
  })

  it('returns null for whitespace-only string', () => {
    assert.equal(normalizeTitle('   '), null)
  })

  it('returns null for "Unknown article" (case-insensitive)', () => {
    assert.equal(normalizeTitle('Unknown article'), null)
    assert.equal(normalizeTitle('UNKNOWN ARTICLE'), null)
    assert.equal(normalizeTitle('unknown article'), null)
  })

  it('returns null for "Untitled article"', () => {
    assert.equal(normalizeTitle('Untitled article'), null)
    assert.equal(normalizeTitle('untitled article'), null)
  })

  it('returns null for "unknown"', () => {
    assert.equal(normalizeTitle('unknown'), null)
  })

  it('returns null for "untitled"', () => {
    assert.equal(normalizeTitle('untitled'), null)
  })

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeTitle('  Hello World  '), 'Hello World')
  })

  it('collapses repeated spaces', () => {
    assert.equal(normalizeTitle('Hello   World'), 'Hello World')
  })

  it('collapses newlines to single space', () => {
    assert.equal(normalizeTitle('Hello\nWorld'), 'Hello World')
    assert.equal(normalizeTitle('Hello\r\nWorld'), 'Hello World')
    assert.equal(normalizeTitle('Hello\n\nWorld'), 'Hello World')
  })

  it('collapses tabs to single space', () => {
    assert.equal(normalizeTitle('Hello\t\tWorld'), 'Hello World')
  })

  it('preserves a normal title unchanged', () => {
    assert.equal(normalizeTitle('Building Better Agents'), 'Building Better Agents')
  })
})

// ── getTitlePrefix ─────────────────────────────────────────────────────────────

describe('getTitlePrefix', () => {
  it('returns null for null input', () => {
    assert.equal(getTitlePrefix(null), null)
  })

  it('returns null for undefined input', () => {
    assert.equal(getTitlePrefix(undefined), null)
  })

  it('returns null for a plain title', () => {
    assert.equal(getTitlePrefix('My cool project'), null)
  })

  it('detects Show HN prefix', () => {
    assert.equal(getTitlePrefix('Show HN: My Project'), 'Show HN')
  })

  it('detects Ask HN prefix', () => {
    assert.equal(getTitlePrefix('Ask HN: Is this a good idea?'), 'Ask HN')
  })

  it('detects Tell HN prefix', () => {
    assert.equal(getTitlePrefix('Tell HN: I launched something'), 'Tell HN')
  })

  it('is case-insensitive for HN prefix detection', () => {
    assert.equal(getTitlePrefix('show hn: my project'), 'Show HN')
    assert.equal(getTitlePrefix('SHOW HN: my project'), 'Show HN')
  })
})

// ── cleanHnTitle ───────────────────────────────────────────────────────────────

describe('cleanHnTitle', () => {
  it('removes "Show HN:" prefix', () => {
    assert.equal(cleanHnTitle('Show HN: My Project'), 'My Project')
  })

  it('removes "Ask HN:" prefix', () => {
    assert.equal(cleanHnTitle('Ask HN: What is the best way?'), 'What is the best way?')
  })

  it('removes "Tell HN:" prefix', () => {
    assert.equal(cleanHnTitle('Tell HN: We launched today'), 'We launched today')
  })

  it('strips extra whitespace after removing prefix', () => {
    assert.equal(cleanHnTitle('Show HN:  Lots of spaces'), 'Lots of spaces')
  })

  it('leaves a normal title unchanged', () => {
    assert.equal(cleanHnTitle('Normal article title'), 'Normal article title')
  })

  it('is case-insensitive', () => {
    assert.equal(cleanHnTitle('show hn: my project'), 'my project')
  })
})

// ── deriveTitleFromUrl ─────────────────────────────────────────────────────────

describe('deriveTitleFromUrl', () => {
  it('derives a title from a slug-style blog path', () => {
    const result = deriveTitleFromUrl(
      'https://www.langchain.com/blog/agent-observability-needs-feedback-to-power-learning',
    )
    assert.equal(result, 'Agent Observability Needs Feedback To Power Learning')
  })

  it('skips short numeric segments and uses the previous one', () => {
    const result = deriveTitleFromUrl('https://example.com/posts/12345/my-great-article')
    assert.equal(result, 'My Great Article')
  })

  it('returns null for a bare hostname with no path', () => {
    assert.equal(deriveTitleFromUrl('https://example.com/'), null)
  })

  it('returns null for a pure-numeric last segment with no fallback', () => {
    assert.equal(deriveTitleFromUrl('https://example.com/p/12345'), null)
  })

  it('handles underscore separators', () => {
    const result = deriveTitleFromUrl('https://example.com/blog/my_great_article')
    assert.equal(result, 'My Great Article')
  })

  it('returns null for invalid URL', () => {
    assert.equal(deriveTitleFromUrl('not-a-url'), null)
  })
})

// ── deriveTitleFromDescription ─────────────────────────────────────────────────

describe('deriveTitleFromDescription', () => {
  it('returns null for null input', () => {
    assert.equal(deriveTitleFromDescription(null), null)
  })

  it('returns null for empty string', () => {
    assert.equal(deriveTitleFromDescription(''), null)
  })

  it('returns null for a too-short string', () => {
    assert.equal(deriveTitleFromDescription('Hi.'), null)
  })

  it('extracts the first sentence', () => {
    const result = deriveTitleFromDescription(
      'This is a great new tool for building agents. It supports many frameworks.',
    )
    assert.equal(result, 'This is a great new tool for building agents')
  })

  it('truncates long first sentences', () => {
    const long = 'A'.repeat(200)
    const result = deriveTitleFromDescription(long + '.')
    assert.ok(result !== null)
    assert.ok(result!.length <= 100)
    assert.ok(result!.endsWith('…'))
  })
})

// ── getDisplayTitle ────────────────────────────────────────────────────────────

describe('getDisplayTitle', () => {
  const base = { source: 'rss', url: 'https://example.com/blog/great-article' }

  it('returns normalized stored title for a normal item', () => {
    assert.equal(
      getDisplayTitle({ ...base, title: '  Building Better Agents  ' }),
      'Building Better Agents',
    )
  })

  it('derives from URL when title is empty', () => {
    assert.equal(
      getDisplayTitle({ ...base, title: '' }),
      'Great Article',
    )
  })

  it('derives from description when title is empty and URL has no useful segment', () => {
    assert.equal(
      getDisplayTitle({
        source: 'rss',
        url: 'https://example.com/12345',
        title: '',
        description: 'This is a really great project for building things.',
      }),
      'This is a really great project for building things',
    )
  })

  it('returns "Untitled article" when no title can be derived', () => {
    assert.equal(
      getDisplayTitle({ source: 'rss', url: 'https://example.com/12345', title: '' }),
      'Untitled article',
    )
  })

  it('strips Show HN prefix for HN items', () => {
    assert.equal(
      getDisplayTitle({
        source: 'hackernews',
        url: 'https://news.ycombinator.com/item?id=12345',
        title: 'Show HN: My Cool Project',
      }),
      'My Cool Project',
    )
  })

  it('strips Ask HN prefix for HN items', () => {
    assert.equal(
      getDisplayTitle({
        source: 'hackernews',
        url: 'https://news.ycombinator.com/item?id=12345',
        title: 'Ask HN: What do you think about X?',
      }),
      'What do you think about X?',
    )
  })

  it('preserves a plain HN title with no prefix', () => {
    assert.equal(
      getDisplayTitle({
        source: 'hackernews',
        url: 'https://news.ycombinator.com/item?id=12345',
        title: 'Announcing the new LLM framework',
      }),
      'Announcing the new LLM framework',
    )
  })
})
