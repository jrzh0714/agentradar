# AI Enrichment

AgentRadar enriches ingested items (GitHub repos, HN stories, RSS articles) with AI-generated metadata: category, tags, summary, maturity, and a relevance score.

## Provider options

Set `AI_PROVIDER` in `.env.local`:

| Value | Description | Key required |
|---|---|---|
| `openai` | OpenAI chat completions (default) | `OPENAI_API_KEY` |
| `anthropic` | Anthropic Claude | `ANTHROPIC_API_KEY` |
| `mock` | Deterministic, no network call | none |

### OpenAI (recommended)

```env
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini   # optional — this is the default
OPENAI_API_KEY=sk-proj-...
```

The OpenAI call uses `response_format: { type: "json_object" }` so the model always returns valid JSON without markdown fences. Default model is `gpt-4o-mini` — cheap, fast, sufficient for structured enrichment.

### Anthropic

```env
AI_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-3-5-haiku-20241022   # optional — this is the default
ANTHROPIC_API_KEY=sk-ant-...
```

### Mock (local dev / CI)

```env
AI_PROVIDER=mock
```

Or pass `--mock` on the CLI — it overrides whatever is in `.env.local`:

```bash
npm run enrich -- --mock --limit 10
```

Mock output is **deterministic**: the same item title always produces the same category, tags, and score. No API key required, no network call.

## Running enrichment

```bash
# Enrich up to 10 pending items (uses AI_PROVIDER from .env.local)
npm run enrich

# Enrich up to 50 items
npm run enrich -- --limit 50

# Dry-run with a real provider: list items, skip AI calls, no DB writes
npm run enrich -- --dry-run

# Dry-run with mock: calls mock and previews output, no DB writes
npm run enrich -- --dry-run --mock

# Override provider from shell without editing .env.local
AI_PROVIDER=openai npm run enrich -- --limit 5
```

## Output schema

The AI must return this JSON shape:

```json
{
  "summary": "One factual sentence about what this is.",
  "why_it_matters": "One sentence on why a GenAI developer should care.",
  "category": "AI Agents",
  "tags": ["multi-agent", "typescript", "open-source"],
  "audience": ["ml-engineer", "backend-dev"],
  "maturity": "promising",
  "relevance_score": 7
}
```

**Allowed categories:** AI Agents, Code Agents, RAG, LLM Frameworks, MCP / Tool Use, Developer Tools, AI Infrastructure, Open Source Models, Prompt Engineering, Workflow Automation, Research, Product Updates, Other

**Allowed maturity values:** experimental, promising, production-ready, unknown

**relevance_score:** integer 1–10. Divided by 10 before writing to the DB (`ai_relevance_score` column is `numeric(4,3)` with a 0–1 constraint).

## Cost controls

- Default batch: 10 items per run (`--limit N` to change).
- Input per item is capped: description at 500 chars, raw content at 4 000 chars.
- 500 ms delay between real-provider calls to stay within rate limits.
- No delay between mock calls.
- `max_tokens` per response: 600 (the structured output is short).

## Provider-level vs item-level failures

| Failure type | Cause | Behaviour |
|---|---|---|
| **Provider-level** | Billing, quota, auth errors | Batch stops immediately. Items are **not** marked `failed`. Re-run after fixing the account. |
| **Item-level** | Bad JSON, Zod validation failure | Retried once. If still invalid, item is marked `failed`. Other items continue. |

Provider errors surface as `ProviderBillingError` in `lib/ai/provider.ts`. They propagate through `enrichItem()` and are caught in the script's main loop.

## Retry policy

Each item attempt:
1. Call the AI provider.
2. Strip any markdown fences from the response.
3. Parse JSON.
4. Validate against `EnrichmentSchema` (Zod).

If step 2, 3, or 4 fails → retry once. If still invalid → mark item `failed`.

## Re-enriching items

Items are fetched where `status = 'new' OR ai_summary IS NULL`. To re-enrich already-enriched items (e.g., to replace mock output with real AI output), reset them in Supabase:

```sql
UPDATE items SET status = 'new', ai_summary = NULL WHERE status = 'enriched';
```

Then run `npm run enrich -- --limit 500`.
