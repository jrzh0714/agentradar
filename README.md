# AgentRadar

**An AI-curated discovery hub for emerging GenAI tools, agent frameworks, and developer workflows.**

AgentRadar continuously ingests items from GitHub, Hacker News, and technical blogs, uses an LLM to classify and score each item, then ranks the full corpus with a weighted formula. The result is a ranked feed, a keyword search interface, per-item detail pages, and a weekly-style digest — all server-rendered from live data with no manual curation.

---

## Live demo

> _Coming soon — deploy your own instance using the instructions below._

## Screenshots

> _Add screenshots after first deployment._

---

## Key features

- **Multi-source ingestion** — GitHub Search API, Hacker News Algolia API, and RSS feeds from six curated technical blogs
- **AI enrichment** — each item is summarized, categorized, tagged, scored for relevance, and assessed for maturity by an LLM (OpenAI or Anthropic, configurable)
- **Composite ranking** — a five-signal weighted formula ranks all enriched items, with an aggressive low-relevance penalty
- **Homepage** — four curated sections (Top Picks, AI News, Latest High-Signal, Agent & MCP Tools) with cross-section deduplication
- **Search** — keyword search with source, category, maturity, relevance score, and sort filters
- **Item detail pages** — full AI briefing, classification panel, and contextually related items
- **Weekly digest** — six editorial sections surfacing the best items per category, with a table of contents
- **Data quality controls** — fork artifact cleanup, ingestion blocklist, Zod validation on all AI output, defensive UI fallbacks

---

## Architecture

```mermaid
graph TD
    subgraph Sources
        GH[GitHub Search API]
        HN[HN Algolia API]
        RSS[RSS Feeds]
    end

    subgraph Ingestion ["Ingestion Scripts (Node/tsx)"]
        IG[ingest-github.ts]
        IH[ingest-hn.ts]
        IR[ingest-rss.ts]
    end

    subgraph Pipeline ["Enrichment & Ranking"]
        EN[enrich-items.ts\nOpenAI / Anthropic]
        RK[rank-items.ts]
    end

    subgraph DB [Supabase Postgres]
        IT[(items table\nstatus: new → enriched)]
    end

    subgraph App ["Next.js App Router (Server Components)"]
        HP[/ Homepage]
        SP[/search]
        DP[/digest]
        IP[/items/id]
    end

    GH --> IG --> IT
    HN --> IH --> IT
    RSS --> IR --> IT
    IT --> EN --> IT
    IT --> RK --> IT
    IT --> HP
    IT --> SP
    IT --> DP
    IT --> IP
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database | Supabase (Postgres, service-role server-side) |
| AI enrichment | OpenAI API (`gpt-4o-mini`) or Anthropic API (`claude-3-5-haiku`) |
| Validation | Zod — all external API responses and AI output |
| Deployment | Vercel |
| Runtime scripts | `tsx` (Node.js, no build step) |

---

## Data pipeline

### 1. Ingestion

Three independent scripts pull from external sources and upsert rows into the `items` table with `status = 'new'`:

| Script | Source | Method |
|---|---|---|
| `ingest-github.ts` | GitHub Search API | 8 configurable queries with `fork:false`, quality filters |
| `ingest-hn.ts` | HN Algolia API | Keyword queries filtered by minimum points |
| `ingest-rss.ts` | RSS feeds | Six curated technical blogs (OpenAI, Hugging Face, GitHub, LangChain, Vercel, Simon Willison) |

Duplicate prevention uses `canonical_url` as a unique key — upserts are idempotent.

### 2. AI enrichment

`enrich-items.ts` processes items with `status = 'new'`. For each item, the LLM returns a structured JSON object, validated with Zod before any DB write:

```
{
  summary:         string     // 20–400 chars
  why_it_matters:  string     // 20–400 chars
  category:        enum       // 13 fixed values
  tags:            string[]   // 3–6 items
  audience:        string[]   // 1–3 items
  maturity:        enum       // experimental | promising | production-ready | unknown
  relevance_score: number     // 1–10 (divided by 10 before storing)
}
```

Categories: `AI Agents`, `Code Agents`, `RAG`, `LLM Frameworks`, `MCP / Tool Use`, `Developer Tools`, `AI Infrastructure`, `Open Source Models`, `Prompt Engineering`, `Workflow Automation`, `Research`, `Product Updates`, `Other`

Items that fail validation or AI calls are marked `status = 'failed'` and retried on the next run.

### 3. Ranking

`rank-items.ts` computes a composite `ranking_score` (0–100) for every enriched item:

```
ranking_score = weighted_sum × relevance_penalty

weighted_sum =
  ai_relevance_score   × 0.40   (AI-assigned relevance, 0–1 → 0–100)
  + recency_score      × 0.25   (exponential decay, half-life 14 days)
  + source_quality     × 0.10   (GitHub: 90, HN: 80, RSS: 65)
  + github_momentum    × 0.15   (log-scaled stars + forks, normalised)
  + hn_discussion      × 0.10   (log-scaled points + comments)

relevance_penalty =
  ai_relevance < 0.4  → ×0.35
  ai_relevance < 0.5  → ×0.65
  ai_relevance ≥ 0.5  → ×1.0
```

The script paginates in batches of 500 to avoid Supabase's implicit 1,000-row cap, and uses the maximum star count in the current corpus to normalise the GitHub momentum component.

---

## AI enrichment design

The enrichment prompt passes the item's title, URL, and description to the configured LLM and requests the structured JSON output above. Key design decisions:

- **Fixed category enum** — the LLM chooses from 13 predefined categories, preventing category sprawl and enabling reliable filtering
- **Relevance score 1–10** — the LLM rates AI/developer relevance; scores below 5 receive a ranking penalty, below 4 a severe penalty
- **Zod validation before any DB write** — invalid AI responses are logged and the item is marked `failed`, never silently discarded
- **Provider-agnostic** — `AI_PROVIDER=anthropic` or `AI_PROVIDER=openai`; defaults to Anthropic with `claude-3-5-haiku-20241022`
- **Structured output** — both providers are called with JSON mode / structured output to reduce parsing errors

---

## Data quality controls

### GitHub fork artifacts

The GitHub Search API can return fork repos whose `stargazers_count` reflects the **upstream** repository's star count. Without mitigation, these dominate the top of the ranking.

**Controls applied:**

| Control | Where | Effect |
|---|---|---|
| `fork:false` in all search queries | `config/github-queries.ts` | Primary filter — excludes most forks |
| `repo.fork === true` guard | `lib/ingestion/github.ts` | Defence in depth for API edge cases |
| `GITHUB_INGESTION_BLOCKLIST` | `config/github-queries.ts` | Permanent exclusion of repos with untrustworthy star counts (e.g. repo transfers) |
| `archived` / `disabled` / no-description guards | `lib/ingestion/github.ts` | Removes unmaintained stub repos |
| `cleanup-github-artifacts.ts` | Scripts | Retroactive DB cleanup for items ingested before the fork filter was added |

### Low-relevance suppression

Items with `ai_relevance_score < 0.4` receive a `×0.35` ranking multiplier, ensuring they cannot surface via star count or recency alone. Items with `ai_relevance_score < 0.5` receive `×0.65`.

### Defensive UI fallbacks

- `safeTitle()` — returns "Untitled article" for null/empty titles
- `safeSummary()` — falls back to raw `description`, then to "No summary available yet."
- All optional fields guarded with `?.` and conditional rendering — no "undefined" text reaches the UI

### Zod validation

All external data is validated before touching the database:
- GitHub API responses → `GithubSearchResponseSchema`
- HN Algolia responses → `HnSearchResponseSchema`
- AI enrichment output → `EnrichmentSchema`

---

## Local setup

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- OpenAI or Anthropic API key
- GitHub personal access token (for Search API rate limits)

### Steps

```bash
git clone https://github.com/YOUR_USERNAME/agentradar
cd agentradar
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

Create `.env.local` with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI provider (choose one)
AI_PROVIDER=anthropic               # or: openai
ANTHROPIC_API_KEY=sk-ant-...        # if using anthropic
OPENAI_API_KEY=sk-...               # if using openai

# GitHub ingestion
GITHUB_TOKEN=ghp_...
```

Optional:
```env
OPENAI_MODEL=gpt-4o-mini            # default: gpt-4o-mini
AI_MODEL=claude-3-5-haiku-20241022  # default for anthropic
```

---

## Commands

### Development

```bash
npm run dev         # start dev server at localhost:3000
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # ranking unit tests (10 cases)
```

### Data pipeline

```bash
# Ingestion — fetch new items from external sources
npm run ingest:github        # GitHub Search API (8 queries)
npm run ingest:rss           # RSS feeds (6 sources)
npm run ingest:hn            # HN Algolia API
npm run ingest:all           # all three in sequence

# Enrichment — call LLM on new/failed items
npm run enrich               # process up to 10 items
npm run enrich -- --limit 50 # process up to 50 items
npm run enrich -- --dry-run  # preview without writing
npm run enrich -- --mock     # mock LLM (no API key required)

# Ranking — recompute ranking_score for all enriched items
npm run rank                 # full corpus
npm run rank -- --dry-run    # preview top 20, no writes

# Data quality
npm run cleanup:github               # remove fork artifacts from DB
npm run cleanup:github -- --dry-run  # preview deletions
```

### Recommended pipeline order

```bash
npm run ingest:all
npm run enrich -- --limit 200
npm run rank
```

---

## Deployment (Vercel + Supabase)

See [docs/deployment.md](docs/deployment.md) for full instructions.

Quick summary:

1. Push to GitHub
2. Import into Vercel — framework preset: Next.js
3. Add all env vars from the table above in Vercel project settings
4. Deploy
5. Run ingestion and enrichment scripts locally pointing at the production Supabase URL

Ingestion is currently manual (or run locally via cron). A Vercel Cron job can be added to automate this.

---

## Known limitations

- **HN corpus is thin** — HN ingestion pulls recent AI-relevant stories; the current corpus has ~6 enriched HN items. Requires regular re-runs to build up.
- **Enrichment cost** — each item costs ~1–2 API calls. At `gpt-4o-mini` rates this is roughly $0.001 per item. A corpus of 2,000 items costs ~$2 to enrich from scratch.
- **No real-time updates** — ingestion and enrichment are manual scripts. Items do not update automatically in production without scheduled jobs.
- **Star count lag** — GitHub `github_stars` is captured at ingestion time and not refreshed unless the item is re-ingested.
- **Category quality** — the AI categorizes items from a fixed 13-value enum. Some items are miscategorized (e.g., a repo with an MCP server but primarily an AR framework landing in `AI Infrastructure`).
- **No authentication** — all data is public read-only. No user accounts, saved searches, or personalization.

---

## Future improvements

- [ ] Vercel Cron for automated daily ingestion + enrichment
- [ ] Re-enrichment job for items where `github_stars` has changed significantly
- [ ] Embedding-based semantic search (pgvector) as an alternative to keyword `ilike`
- [ ] RSS feed management UI — add/remove feeds without code changes
- [ ] User-facing "subscribe to digest" email delivery
- [ ] Trend detection — flag items whose ranking score increased significantly week-over-week
- [ ] AI-generated digest summaries (one paragraph per section, not per item)
- [ ] Source credibility scoring beyond the fixed `source_quality` constants

---

## Project structure

```
agentradar/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage
│   ├── search/             # Search page + SearchControls client component
│   ├── digest/             # Weekly digest
│   └── items/[id]/         # Item detail + not-found
├── components/
│   ├── ItemCard.tsx        # Card used on homepage, search, detail related
│   ├── ItemSection.tsx     # Section wrapper with heading + grid
│   └── ui/                 # SourceBadge, CategoryBadge, ScorePill, TagList, MaturityBadge
├── config/
│   ├── github-queries.ts   # Search queries + ingestion blocklist
│   └── rss-feeds.ts        # RSS feed list (reference; live list is in DB)
├── lib/
│   ├── ai/                 # LLM provider abstraction + Zod schemas
│   ├── db/                 # Data-fetching helpers (homepage, search, digest, detail)
│   ├── ingestion/          # Per-source fetch + normalize logic
│   ├── ranking/            # computeRankingScore + unit tests
│   ├── supabase/           # server.ts (service role) + client.ts (publishable key)
│   └── validation/         # Zod schemas for external APIs
├── scripts/                # CLI pipeline scripts (ingest, enrich, rank, cleanup)
├── docs/                   # Architecture, case study, deployment guides
└── supabase/               # DB migrations
```

---

## License

MIT
