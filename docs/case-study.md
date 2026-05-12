# AgentRadar — Technical Case Study

## Why I built it

The AI tooling space moves faster than any aggregator can keep up with manually. New agent frameworks appear on GitHub weekly, model releases drop from multiple providers simultaneously, and the relevant HN threads and blog posts are spread across dozens of sources. I wanted a single place that ingests all of this, filters out the noise using an LLM, and surfaces the highest-signal items — ranked by a formula I could reason about and tune.

The secondary goal was to build something with non-trivial backend complexity: a real data pipeline with external APIs, AI-in-the-loop processing, a computed ranking layer, and a multi-page UI — all implemented to production standards rather than as a demo.

---

## Product problem

**The problem:** Staying current on AI tooling requires monitoring GitHub trending, HN, and a dozen blogs simultaneously. Signal-to-noise ratio is low. Forks and tutorials dominate GitHub results. Blog posts are scattered. HN threads disappear quickly.

**The solution:** An automated aggregator that:
1. Pulls from multiple sources on a schedule
2. Uses an LLM to assess each item's relevance, category, and maturity
3. Ranks everything with a weighted formula that balances AI judgment against community signal and recency
4. Presents results through a clean, fast read-only UI

**What it is not:** AgentRadar is not a social platform, not a newsletter service, and not a search engine. It is a personal-scale discovery tool that demonstrates a complete AI-in-the-loop data pipeline.

---

## Architecture

The system has three clearly separated layers:

**Ingestion layer** — Three independent CLI scripts (`tsx`, no build step) pull from external sources and upsert rows into Supabase with `status = 'new'`. Scripts are idempotent: `canonical_url` is the unique key, so re-running never duplicates items.

**Pipeline layer** — Two more scripts process items in the DB. `enrich-items.ts` calls the LLM and writes structured metadata. `rank-items.ts` computes a composite `ranking_score` for every enriched item. Both scripts paginate through the DB in batches to avoid Supabase's implicit 1,000-row cap.

**Application layer** — A Next.js 16 App Router application with four server-rendered pages, all reading from Supabase using the service-role key via server-only data-fetching helpers. No client-side Supabase calls. No API routes for reads — Server Components query the DB directly.

The client boundary is narrow: only `SearchControls` is a client component, handling URL-param driven filter state without `useSearchParams` (uses `useRouter` + `useTransition` to avoid a Suspense wrapper requirement).

---

## Ingestion design

### GitHub

GitHub's Search API is useful but has a well-known distortion: fork repos inherit their parent's `stargazers_count`. A fork of a 150k-star repo appears to have 150k stars and dominates ranking.

**Primary defence:** All queries include `fork:false`. This eliminates the majority of forks.

**Secondary defence:** The ingestion code applies per-repo checks after the API response is parsed:
- `repo.fork === true` — defence in depth
- `repo.archived === true` — unmaintained repos excluded
- `repo.disabled === true` — 404s on GitHub
- Empty description + fewer than 100 stars — removes stub/placeholder repos

**The blocklist problem:** During a data quality audit I discovered two repos returning 158k–179k stars that were not classified as forks by the API. Root cause: GitHub repo transfers carry the original star count, but `fork` stays `false`. The `fork:false` qualifier had no effect. Fix: a permanent `GITHUB_INGESTION_BLOCKLIST` in `config/github-queries.ts`, enforced in the ingestion filter and in a retroactive DB cleanup script. The blocklist is the single source of truth — both the ingestion code and the cleanup script read from it.

**`published_at` uses `pushed_at`** (the last commit date) rather than the ingestion timestamp. This reflects real content activity. `created_at` is preserved in `raw_data` for auditability.

### Hacker News

The HN Algolia API is queried with AI-relevant keywords filtered by minimum points. HN corpus depth grows incrementally as the daily cron accumulates runs — early in a deployment the HN section will be smaller than the GitHub and RSS sections.

### RSS

Six feeds are configured (OpenAI Blog, Hugging Face, GitHub Blog, LangChain, Vercel, Simon Willison). The live feed list is stored in a `rss_feeds` table so it can be updated without code changes. The `config/rss-feeds.ts` file is a reference copy for re-seeding.

---

## OpenAI enrichment design

### Why LLM enrichment matters for this use case

Raw ingested data has titles and descriptions only. Without enrichment, ranking is limited to star counts and recency — both easily gamed. The LLM adds:
- A structured category (from a fixed 13-value enum)
- A relevance score (1–10) that rating how well the item fits the AI/developer audience
- A summary and "why it matters" explanation
- Tags and audience labels

The category enum was a deliberate constraint. Open-ended categorization leads to drift — 50 slightly different labels with 3 items each. Fixing it to 13 values makes filtering practical and keeps the digest sections stable.

### Validation

Every AI response passes through `EnrichmentSchema` (Zod) before any DB write. The schema enforces:
- Summary and why-it-matters: 20–400 characters
- Category: one of 13 exact strings
- Tags: 3–6 items, each ≤ 50 characters
- Relevance score: integer 1–10

If validation fails, the item is marked `status = 'failed'` and retried on the next run. This means a bad LLM response never silently corrupts the DB.

### Provider abstraction

The AI layer (`lib/ai/provider.ts`) supports Anthropic and OpenAI interchangeably. `AI_PROVIDER=anthropic` (default) uses `claude-3-5-haiku-20241022`. `AI_PROVIDER=openai` uses `gpt-4o-mini`. A `mock` provider is available for local development without API keys.

---

## Ranking design

### Why a formula rather than just relevance score

The LLM relevance score is the strongest signal but has blind spots. A highly relevant item published two years ago should not outrank a moderately relevant item published yesterday. A small niche tool with a high relevance score might still be less worth surfacing than a broadly adopted framework with medium relevance.

The ranking formula combines five signals:

| Signal | Weight | Rationale |
|---|---|---|
| AI relevance | 40% | Strongest predictor of whether the item belongs in the feed |
| Recency | 25% | Half-life of 14 days; prevents corpus from being dominated by old items |
| Source quality | 10% | GitHub (90) > HN (80) > RSS (65) — reflects typical signal density |
| GitHub momentum | 15% | Log-scaled stars + forks; log prevents mega-repos from dominating |
| HN discussion | 10% | Log-scaled points + comments |

### The relevance penalty

A critical addition: items with `ai_relevance_score < 0.4` receive a `×0.35` multiplier on their entire weighted score. Items with score 0.4–0.49 receive `×0.65`. This means a low-relevance item with 100k stars cannot surface above a high-relevance item with fewer stars. Without this penalty, popular-but-off-topic repos dominate the top of the feed.

### Normalisation

The GitHub momentum component uses log-scaling normalised against the maximum star count in the current corpus (`maxStars`). This prevents a single outlier (e.g., a 200k-star repo) from compressing all other momentum scores toward zero.

### Pagination

The ranking script paginates in batches of 500. Supabase PostgREST has an implicit 1,000-row cap on queries without explicit limits. Without pagination, a corpus of 2,500 items would silently process only the first 1,000, leaving 1,500 items with stale scores.

---

## Data quality problems discovered and fixed

### Problem 1: Fork repos with inflated star counts

**Discovery:** During a data quality audit of the top-ranked GitHub items, two repos appeared with 158k–179k stars that seemed inconsistent with their age and account size.

**Investigation:** GitHub API returned `fork: false` for both. Root cause: these repos had been transferred on GitHub. Transferred repos carry the original repo's star count but lose their `fork` flag. The `fork:false` search query had no effect.

**Fix:** Added `GITHUB_INGESTION_BLOCKLIST` in `config/github-queries.ts`. Both the ingestion filter and the cleanup script read from this single list. Added a cleanup script to retroactively remove these rows from the DB.

### Problem 2: GitHub `published_at` all showing today

**Discovery:** The "Latest High-Signal Updates" homepage section was sorting all GitHub repos to the top because their `published_at` dates were all the day of ingestion.

**Cause:** `published_at` was initially set to the ingestion timestamp, not the repo's activity date.

**Fix:** GitHub ingestion now sets `published_at = pushed_at` (last commit push date). This is a meaningful proxy for content activity. The `getLatestHighSignal()` query also filters to `source IN ('rss', 'hackernews')` so that GitHub items (which have their own section) do not flood the recency feed.

### Problem 3: Supabase 1,000-row cap silently truncating ranking

**Discovery:** After ingesting ~1,800 items, the ranking script appeared to complete successfully but only updated a fraction of the corpus. Items ingested after the 1,000th row had stale `ranking_score = 0`.

**Cause:** Supabase PostgREST silently caps queries at 1,000 rows without an explicit limit. The original ranking script fetched all items in a single query.

**Fix:** Rewrote `rank-items.ts` to paginate in batches of 500, tracking `offset` explicitly.

### Problem 4: Broken cards from null titles

**Discovery:** Two items in the "Latest High-Signal" section rendered with no title text.

**Fix:** Added `safeTitle()` and `safeSummary()` helpers to `ItemCard.tsx`. `safeTitle` returns "Untitled article" for null/empty titles. `safeSummary` tries `ai_summary`, then `description`, then a static fallback.

### Problem 5: RSS items ingested with empty titles

**Discovery:** During a title audit, three RSS items from a blog feed were found with `title = ""` and `raw_data.title = ""` — the parser had returned an empty string rather than null. These items rendered as "Untitled article" permanently because the original fix only handled `null`.

**Root cause:** The RSS parser (rss-parser) stores an empty string when the feed item's `<title>` tag is present but empty, while some feeds omit the tag entirely (which produces `null`). Both forms needed to be treated as "bad title."

**Fix:** Built a dedicated title quality module (`lib/ingestion/title.ts`) with a `normalizeTitle()` function that rejects both null and empty strings, plus a configurable set of known placeholder strings (`"unknown"`, `"untitled"`, `"n/a"`, `"undefined"`, etc.). The `getDisplayTitle()` function applies a resolution chain — stored title → URL slug derivation → description extraction → `"Untitled article"` fallback — at render time across all UI surfaces (homepage, search, digest, detail page).

HN prefix handling (discovered as a related issue): "Show HN: / Ask HN: / Tell HN:" prefixes stored in titles are a HN convention that doesn't belong in the display title. Stripping them at write time would lose information; instead, `getTitlePrefix()` extracts the prefix for display as a badge, and `cleanHnTitle()` removes it from the display string — both non-destructively.

A `scripts/cleanup-titles.ts` script applies the same resolution chain retroactively to all existing DB rows, with `--dry-run` support. It is also wired into the daily refresh pipeline (`runTitleCleanup()` runs after ingestion, before enrichment) so that newly ingested items are cleaned before the LLM sees them as context.

---

## UI and product decisions

### Server Components only for data fetching

All four pages are Server Components. Data-fetching helpers in `lib/db/` create a Supabase service-role client server-side and return typed results. No API routes for reads. This eliminates a round-trip and keeps the client bundle small.

The only client component is `SearchControls`, which needs `useRouter` for URL-param navigation. It uses `useTransition` to mark the navigation as non-urgent, keeping the UI responsive during filter changes.

### ItemCard: internal link + external icon

Early versions linked the card title directly to the external URL. This meant clicking any card took the user off-site. The correct product behavior is: the title goes to the detail page (`/items/[id]`), and a small `↗` icon in the card header opens the source URL in a new tab. This is how most discovery/aggregator UIs work.

### Digest layout

The digest page uses lightweight "digest rows" rather than full `ItemCard` components. Each row is a horizontal strip with a rank number, source badge, category, score, date, and title. This is intentional: the digest is designed to be scanned quickly, not browsed card-by-card. Compact rows let the reader see 5 items per section without scrolling past large cards.

### Related items (two-pass strategy)

The detail page's related items use a two-pass query: first, items from the same `ai_category`, then — if fewer than 6 are found — supplemented by items from the same `source`. This ensures that a niche item with few category peers still shows something contextually relevant rather than an empty section.

---

## What I would improve next

**Embedding-based semantic search** — Keyword `ilike` search misses synonyms and related concepts. Adding `pgvector` embeddings to the items table and switching to cosine similarity search would significantly improve search quality. The enrichment step is the right place to generate and store the embedding.

**Category quality** — Some items are miscategorized. The current fix is the fixed enum, but the prompt could include few-shot examples per category to improve accuracy. Alternatively, a post-enrichment validation pass could flag low-confidence categorizations for review.

**Re-enrichment on significant changes** — GitHub star counts are captured at ingestion time and never updated. A re-enrichment job that detects significant star count changes and re-ingests affected repos would keep the corpus fresher.

**AI-generated digest summaries** — The digest currently lists items with their per-item AI summary. A higher-quality product would generate one paragraph per section synthesizing the week's highlights. This requires a second LLM call per section, which is straightforward to add.

---

## What this demonstrates technically

**Full-stack TypeScript** — Strict TypeScript throughout: Next.js App Router pages, server-only data-fetching helpers, CLI scripts, title quality utilities with 44 unit tests, ranking library with 10 unit tests, Zod schemas for all external data. Zero `any` types in the application code.

**Production-grade automation** — `lib/workflows/daily-refresh.ts` orchestrates the full pipeline (ingestion → title cleanup → enrichment → ranking) as a single reusable module, exercised by a CRON_SECRET-protected `/api/refresh/daily` API route that Vercel Cron calls at 08:00 UTC. The module always resolves (never throws), captures billing errors without marking items failed, and returns a structured result object with per-phase counts for observability.

**AI-in-the-loop data pipeline** — The enrichment layer is not a demo: it handles API errors, validates output with Zod, marks failures for retry, and is provider-agnostic (Anthropic or OpenAI). The pipeline runs against a live Supabase instance and processes real items.

**Compound ranking formula** — The ranking is not "just sort by stars." It combines five signals with weights, normalises the GitHub component against corpus-level statistics, and applies a non-linear penalty for low-relevance items. The formula is unit-tested (10 cases covering edge conditions).

**Data quality under real conditions** — The fork artifact problem, the 1,000-row pagination bug, the null/empty title rendering failures, and the HN prefix display issue were all discovered during real QA passes — not anticipated in advance. Each was diagnosed, root-caused, and fixed with a durable solution (not a one-time patch). The title quality work in particular grew into a standalone module with its own test suite after the initial fix proved insufficient for the empty-string case.

**Next.js Server Components architecture** — All data fetching is server-side. The client boundary is a single component (`SearchControls`). The `SUPABASE_SERVICE_ROLE_KEY` never touches the browser.

**Defensive engineering** — Every DB query has a try/catch returning a safe default. AI output is validated before any DB write. The UI has fallbacks for every nullable field. The result is that no combination of bad data in the DB produces a broken or empty page.
