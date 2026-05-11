import Anthropic from '@anthropic-ai/sdk'

// Extend this union when adding a new provider.
type Provider = 'anthropic' // | 'openai'

const PROVIDER = (process.env.AI_PROVIDER ?? 'anthropic') as Provider
const MODEL = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

export interface AiCallOptions {
  systemPrompt: string
  userMessage: string
  maxTokens?: number
}

export async function callAi(options: AiCallOptions): Promise<string> {
  const { systemPrompt, userMessage, maxTokens = 1024 } = options

  if (PROVIDER === 'anthropic') {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected non-text response from Anthropic')
    return block.text
  }

  throw new Error(`Unsupported AI provider: ${PROVIDER}. Add support in lib/ai/provider.ts`)
}
