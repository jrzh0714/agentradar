import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { CATEGORIES, MATURITY_VALUES } from '@/lib/ai/schemas'

// Extend this union when adding a new provider.
export type Provider = 'anthropic' | 'openai' | 'mock'

/**
 * Thrown when the provider cannot process requests due to billing,
 * quota exhaustion, or account-level issues.
 * Callers should stop the batch rather than mark individual items as failed.
 */
export class ProviderBillingError extends Error {
  constructor(provider: string, detail: string) {
    super(`[${provider}] Billing/quota error — ${detail}`)
    this.name = 'ProviderBillingError'
  }
}

export interface AiCallOptions {
  systemPrompt: string
  userMessage: string
  maxTokens?: number
}

// ── Mock provider ─────────────────────────────────────────────────────────────

/** djb2-style hash — deterministic, no dependencies. */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    h = h >>> 0 // keep unsigned 32-bit
  }
  return h
}

/**
 * Deterministic mock provider — no network calls, always schema-valid.
 * Output is derived from the item title so results are stable across runs.
 */
function callMock(options: AiCallOptions): string {
  const titleMatch = options.userMessage.match(/^Title:\s*(.+)$/m)
  const title = titleMatch?.[1]?.trim() ?? 'Unknown Project'
  const h = hashString(title)

  // Use unsigned right-shift (>>>) so indices and score are always non-negative.
  const category = CATEGORIES[h % CATEGORIES.length]
  const maturity = MATURITY_VALUES[(h >>> 4) % MATURITY_VALUES.length]
  const score = 4 + ((h >>> 8) % 5) // 4–8

  // Build 3–5 tags from sanitised title words
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const tagSet = [...new Set(words)].slice(0, 4)
  const fallbacks = ['open-source', 'developer-tool', 'ai-tooling', 'automation', 'genai']
  while (tagSet.length < 3) tagSet.push(fallbacks[tagSet.length])

  return JSON.stringify({
    summary: `${title} is a project in the GenAI and developer-tooling ecosystem.`,
    why_it_matters:
      'It offers capabilities relevant to engineers building AI-powered applications.',
    category,
    tags: tagSet.slice(0, 5),
    audience: ['ml-engineer', 'backend-dev'],
    maturity,
    relevance_score: score,
  })
}

// ── Anthropic provider ────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

const ANTHROPIC_BILLING_PATTERNS = [
  'credit balance is too low',
  'insufficient_funds',
  'payment required',
]

async function callAnthropic(options: AiCallOptions): Promise<string> {
  const client = getAnthropicClient()
  const model = process.env.ANTHROPIC_MODEL ?? process.env.AI_MODEL ?? 'claude-3-5-haiku-20241022'

  try {
    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: options.userMessage }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected non-text response from Anthropic')
    return block.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (ANTHROPIC_BILLING_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()))) {
      throw new ProviderBillingError('anthropic', msg)
    }
    throw err
  }
}

// ── OpenAI provider ───────────────────────────────────────────────────────────

let _openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _openai = new OpenAI({ apiKey })
  }
  return _openai
}

const OPENAI_BILLING_PATTERNS = [
  'insufficient_quota',
  'exceeded your current quota',
  'billing',
  'payment required',
  'rate_limit_exceeded',
]

async function callOpenAI(options: AiCallOptions): Promise<string> {
  const client = getOpenAIClient()
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens ?? 600,
      // json_object mode guarantees valid JSON — no markdown fences in output.
      // Requires the word "json" to appear in the prompt (it does).
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userMessage },
      ],
    })
    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')
    return content
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (OPENAI_BILLING_PATTERNS.some((p) => msg.toLowerCase().includes(p.toLowerCase()))) {
      throw new ProviderBillingError('openai', msg)
    }
    throw err
  }
}

/** Returns the model name that will be used for the current provider. */
export function activeModel(): string {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic') as Provider
  if (provider === 'openai') return process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
  if (provider === 'anthropic')
    return process.env.ANTHROPIC_MODEL ?? process.env.AI_MODEL ?? 'claude-3-5-haiku-20241022'
  return 'mock'
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function callAi(options: AiCallOptions): Promise<string> {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic') as Provider

  switch (provider) {
    case 'mock':
      return callMock(options)
    case 'anthropic':
      return callAnthropic(options)
    case 'openai':
      return callOpenAI(options)
    default:
      throw new Error(
        `Unsupported AI provider: "${provider}". Set AI_PROVIDER to anthropic, openai, or mock.`,
      )
  }
}
