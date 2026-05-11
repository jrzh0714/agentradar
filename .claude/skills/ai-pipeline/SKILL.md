---
name: ai-pipeline
description: Use for LLM enrichment, prompt design, structured JSON output, Zod validation of AI responses, digest generation, and embeddings. Validates all AI output and requires fallback behavior.
---

# AI Pipeline

Use this skill when writing any code that calls OpenAI or Anthropic APIs, validates AI output, generates digests, or produces embeddings.

## Core rules

1. **Never trust raw AI output.** Every LLM response must be parsed and validated with a Zod schema before it touches the database or the client.
2. **Every AI call must have a fallback.** If the AI call fails, times out, or returns invalid output, the system must degrade gracefully — log the error, skip enrichment, and leave the item unenriched rather than crashing.
3. **Never persist hallucinated data.** If Zod validation fails, do not save the AI response. Log the raw output for debugging.

## Prompt design

- Use structured output (JSON mode or tool/function calling) whenever the output will be persisted or displayed.
- Define the expected JSON shape as a Zod schema first, then write the prompt around it.
- Keep prompts short and deterministic: one clear task per call.
- Pin model names as constants (e.g. `const MODEL = 'gpt-4o-mini'`) so they are easy to update.

## Zod validation pattern

```ts
import { z } from 'zod'

const SummarySchema = z.object({
  tldr: z.string().max(280),
  tags: z.array(z.string()).max(5),
  relevanceScore: z.number().min(0).max(1),
})

type Summary = z.infer<typeof SummarySchema>

// Always wrap parse in try/catch
function parseSummary(raw: unknown): Summary | null {
  const result = SummarySchema.safeParse(raw)
  if (!result.success) {
    console.error('AI output validation failed', result.error, raw)
    return null
  }
  return result.data
}
```

## Fallback pattern

```ts
async function enrichItem(item: RawItem): Promise<EnrichedItem> {
  try {
    const raw = await callLLM(item)
    const summary = parseSummary(raw)
    if (!summary) return { ...item, enriched: false }
    return { ...item, ...summary, enriched: true }
  } catch (err) {
    console.error('Enrichment failed for item', item.id, err)
    return { ...item, enriched: false }
  }
}
```

## Cost and rate-limit hygiene

- Batch items where the API supports it.
- Add per-item guards: skip enrichment if an item was already enriched recently.
- Log token usage when available; surface it in dev so over-spending is visible.
- Never call the LLM from a client component or in a hot render path.

## Checklist before marking done

- [ ] Zod schema defined before the prompt is written
- [ ] `safeParse` used — never `parse` (which throws)
- [ ] Fallback path returns a usable (unenriched) value, not an error
- [ ] Model name is a named constant
- [ ] No LLM calls from client components
- [ ] Token usage logged where available
