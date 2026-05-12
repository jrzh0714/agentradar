# AgentRadar — Architecture Reference

This document describes the system architecture, data model, module boundaries, and key design decisions.

---

## System overview

```
External sources
  GitHub Search API  ──┐
  HN Algolia API     ──┤──→ Ingestion ──→ Supabase (items, status='new')
  RSS feeds          ──┘       ▲                    │
                               │                    ▼
                    Vercel Cron 08:00 UTC    Title cleanup
                  /api/refresh/daily         (lib/ingestion/title.ts)
                  [CRON_SECRET protected]             │
                                                      ▼
                                             Enrichment script
                                          (OpenAI / Anthropic)
                                               │
                                               ▼
                                     Supabase (items, status='enriched')
                                               │
                                               ▼
                                         Ranking script
                                               │
                                               ▼
                                     Supabase (items.ranking_score updated)
                                               │
                                   ┌───────────┼───────────────────┐
                                   ▼           ▼                   ▼
                              Homepage      Search         Digest / Detail
                           (Server Comp)  (Server Comp)  (Server Components)
```

---

## Database schema

### `items` table (single table design)

All ingested content lives in one table regardless of source. Source-specific columns are nullable for rows from other sources.

```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
title           text NOT NULL
url             text NOT NULL
canonical_url   text UNIQUE           -- dedup key for upserts
source          text NOT NULL         -- 'github' | 'hackernews' | 'rss'
source_id       text                  -- repo full_name, HN story ID, etc.
author          text

-- Raw content
description     text
raw_content     text
raw_data        jsonb                 -- full API response for auditability

-- Timestamps
published_at    timestamptz           -- pushed_at for GitHub, story date for HN/RSS
discovered_at   timestamptz DEFAULT now()

-- GitHub-specific
github_stars    integer
github_forks    integer
github_language text

-- HN-specific
hn_points       integer
hn_comments     integer

-- AI enrichment (null until enriched)
ai_summary          text
ai_why_it_matters   text
ai_category         text
ai_tags             text[]
ai_audience         text[]
ai_maturity         text
ai_relevance_score  numeric(3,2)     -- 0.00–1.00 (stored as score/10)

-- Pipeline
ranking_score   numeric(10,4) DEFAULT 0
status          text DEFAULT 'new'   -- 'new' | 'enriched' | 'failed'
error_message   text

-- Timestamps
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### `rss_feeds` table

```sql
id          uuid PRIMARY KEY
name        text
url         text UNIQUE
category_hint text
active      boolean DEFAULT true
created_at  timestamptz DEFAULT now()
```

The RSS feed list is managed in the DB so feeds can be added without code changes. `config/rss-feeds.ts` is a reference copy for re-seeding.

---

## Module boundaries

### `lib/supabase/`

Two clients, never mixed:

| File | Client | Key used | Used in |
|---|---|---|---|
| `server.ts` | `createServerClient()` | `SUPABASE_SERVICE_ROLE_KEY` | Server Components, scripts |
| `client.ts` | `createBrowserClient()` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser only |

`createBrowserClient()` is not used anywhere in the current application — all data fetching is server-side. It is provided for future use (e.g., real-time subscriptions, auth).

### `lib/db/`

Data-fetching helpers for each page. All use `createServerClient()`. Return typed, pre-shaped data — no raw Supabase types leak into the UI.

| File | Purpose |
|---|---|
| `homepage.ts` | `getTopPicks`, `getAiNews`, `getLatestHighSignal`, `getAgentTools`, `getHomepageStats` |
| `search.ts` | `searchItems` with multi-filter Postgres queries |
| `items-detail.ts` | `getItemById`, `getRelatedItems` (two-pass) |
| `digest.ts` | `getDigestSections` with cross-section in-memory dedup |

**Type pattern:** `HomepageItem` is a `Pick<Item, ...>` of the columns the homepage needs. `DetailItem` is a superset that includes detail-only fields. Both are structurally compatible so `DetailItem[]` can be passed where `HomepageItem[]` is expected.

**Error handling:** Every function wraps its Supabase call in `try/catch` and returns a safe default (`null`, `[]`, or a fallback object). No page can crash due to a DB error.

**Double-cast pattern:** Supabase's type inference breaks when `.select()` receives a plain string (necessary for multi-column strings). The established pattern is `(data as unknown as HomepageItem[])`.

### `lib/ingestion/`

Per-source fetch + normalize logic. Returns `ItemInsert[]` — the shape needed for `supabase.from('items').upsert(...)`. Scripts in `scripts/` call these and handle the actual DB writes.

| File | Source | Key logic |
|---|---|---|
| `github.ts` | GitHub Search API | `rejectReason()` filter chain, `toItemInsert()` mapper |
| `hn.ts` | HN Algolia API | Keyword queries, minimum points filter |
| `rss.ts` | RSS (rss-parser) | Feed fetch, per-item normalize |
| `title.ts` | — (utility) | Title quality: `normalizeTitle`, `getDisplayTitle`, `getTitlePrefix`, `cleanHnTitle`, `deriveTitleFromUrl`, `deriveTitleFromDescription` |

**Title resolution order in `getDisplayTitle()`:**
1. For HN items: strip "Show HN / Ask HN / Tell HN" prefix from stored title, return the rest
2. `normalizeTitle(item.title)` — rejects null, empty, whitespace-only, and known placeholders
3. `deriveTitleFromUrl(item.url)` — title-cases the last meaningful URL path segment
4. `deriveTitleFromDescription(item.description)` — first sentence, capped at 100 characters
5. `"Untitled article"` — final fallback

HN prefix handling is non-destructive: `getTitlePrefix()` extracts the prefix for use as an `HnPrefixBadge` UI component; the DB title is never mutated.

### `lib/workflows/`

Shared pipeline logic consumed by the API route.

| File | Contents |
|---|---|
| `daily-refresh.ts` | `runDailyRefresh(enrichLimit)` — orchestrates `runIngestion` → `runTitleCleanup` → `runEnrichment` → `runRanking`. Always resolves; never throws. Returns `RefreshResult` with per-phase counts. |

`runDailyRefresh` contains no CLI side-effects (no dotenv, no ws polyfill) — safe to import directly in a Next.js API route.

### `lib/ranking/`

Pure functions, no I/O.

| File | Contents |
|---|---|
| `score.ts` | `computeRankingScore`, component functions, `WEIGHTS`, `SOURCE_QUALITY` |
| `score.test.ts` | 10 unit tests |

**Test suite:** `npm run test` runs 54 tests total — 10 ranking tests and 44 title quality tests (`lib/ingestion/title.test.ts`). Both use Node.js built-in `node:test` with no external test framework.

### `lib/ai/`

LLM provider abstraction.

| File | Contents |
|---|---|
| `provider.ts` | `callAi()`, `getProvider()`, `getModel()` — Anthropic / OpenAI / mock |
| `schemas.ts` | `EnrichmentSchema` (Zod), `CATEGORIES`, `MATURITY_VALUES` |

### `lib/validation/`

Zod schemas for external API responses:

- `github.ts` — `GithubRepoSchema`, `GithubSearchResponseSchema`
- `hn.ts` — `HnStorySchema`, `HnSearchResponseSchema`

---

## Application layer

### Routing

```
/                  app/page.tsx              (force-dynamic Server Component)
/search            app/search/page.tsx       (force-dynamic Server Component)
/digest            app/digest/page.tsx       (force-dynamic Server Component)
/items/[id]        app/items/[id]/page.tsx   (force-dynamic Server Component)
                   app/items/[id]/not-found.tsx
/api/refresh/daily app/api/refresh/daily/route.ts  (GET + POST, maxDuration=300)
```

All data pages are `force-dynamic` — they read from live DB data and must not be statically cached. When the daily cron is active, switching to `revalidate = 3600` (hourly ISR) is a straightforward future optimisation.

`/api/refresh/daily` requires `Authorization: Bearer <CRON_SECRET>`. Vercel Cron attaches this header automatically. Manual `GET` or `POST` requests with the correct header are also accepted (useful for local testing and forced refreshes).

### Client component surface

Only one client component exists in the application: `app/search/SearchControls.tsx`.

It handles URL-param driven filter state. The approach uses `useRouter().push()` wrapped in `useTransition()` — this avoids the Next.js `useSearchParams()` requirement to wrap the component in a `<Suspense>` boundary.

**Supported filters (all URL-persisted):**

| Param | Values | Default |
|---|---|---|
| `q` | keyword string | `""` |
| `source` | `all` \| `github` \| `hackernews` \| `rss` | `all` |
| `category` | any of 13 categories \| `all` | `all` |
| `maturity` | `all` \| `production-ready` \| `promising` \| `experimental` \| `unknown` | `all` |
| `min_score` | `0` \| `5` \| `6` \| `7` \| `8` \| `9` (relevance ×10) | `0` |
| `date_range` | `all` \| `1d` \| `7d` \| `30d` \| `90d` | `all` |
| `sort` | `ranking` \| `newest` \| `relevance` \| `stars` \| `discussed` | `ranking` |

Active filter chips are rendered for any non-default filter value. Each chip has an individual remove button; a "clear all" link resets everything. `key={q}` on `<SearchControls>` remounts the component when the URL's `q` param changes, resetting the uncontrolled keyword input.

`SearchControls` does not import any server-side code. It imports only:
- `react` (hooks)
- `next/navigation` (useRouter)
- `@/lib/utils` (cn)
- `type { SearchSort, DateRange }` from `@/lib/db/search` — **type-only imports**, no runtime code

### Component hierarchy

```
page.tsx (Server)
  └── ItemSection (Server)
        └── ItemCard (Server — no 'use client')
              ├── SourceBadge
              ├── CategoryBadge
              ├── MaturityBadge
              ├── ScorePill
              ├── TagList
              └── Link (next/link)

app/search/page.tsx (Server)
  ├── SearchControls ('use client')
  └── ItemCard (Server)

app/digest/page.tsx (Server)
  └── DigestRow (inline Server function component)

app/items/[id]/page.tsx (Server)
  ├── SourceBadge, CategoryBadge, MaturityBadge, ScorePill, TagList
  └── ItemCard (Server) × 6 (related items)
```

---

## Data flow: search request

```
Browser ──GET /search?q=agent&source=github&date_range=7d&sort=stars──→ Next.js

Next.js:
  1. await searchParams (async, Next.js 15+)
  2. parse + sanitize all params (q, source, category, maturity,
     min_score, date_range, sort) — unknown values replaced with defaults
  3. call searchItems({ q, source, category, maturity, minRelevance,
                        dateRange, sort, limit: 60 })
     └── createServerClient() [SUPABASE_SERVICE_ROLE_KEY]
     └── .from('items').select(...)
         .eq('status', 'enriched')
         .or('title.ilike.%agent%,...,ai_tags.cs.{agent},...')  ← keyword
         .eq('source', 'github')                                 ← source filter
         .gte('published_at', cutoffDate)                        ← date range
         .gte('ai_relevance_score', 0.5)                        ← min score
         .order('github_stars', { ascending: false })            ← sort=stars
         .limit(60)
  4. render SearchPage server component (with active filter chips)
  5. stream HTML to browser

SearchControls (client):
  - renders filter dropdowns + keyword input from URL-derived props
  - active filter chips shown for any non-default filter value
  - on filter change: router.push('/search?...') in a transition
  - Next.js fetches new server render, streams update
```

No client-side Supabase calls. No API routes. No loading spinners needed (streaming handles it).

**Array-column keyword search:** `ai_tags` and `ai_audience` are `text[]` columns; PostgREST `ilike` does not apply to arrays. For single-word search terms, the query additionally uses `.cs.{term}` (array containment) to match tag/audience values exactly.

---

## Data flow: enrichment pipeline

The pipeline can be run two ways:
- **Manually:** `scripts/enrich-items.ts` (CLI, supports `--limit`, `--dry-run`, `--mock`)
- **Automatically:** `lib/workflows/daily-refresh.ts` invoked by `/api/refresh/daily` (Vercel Cron)

Both share the same `enrichItem()` function from `lib/ai/enrich.ts`.

```
runEnrichment() / scripts/enrich-items.ts

1. Query DB for up to N items where status = 'new' OR status = 'failed'
2. For each item:
   a. Build prompt from title + description + URL
   b. Call AI provider (Anthropic or OpenAI)
   c. Parse JSON response
   d. Validate with EnrichmentSchema (Zod)
   e. On success: upsert enrichment fields, status = 'enriched'
   f. On validation failure: status = 'failed', log error
   g. On ProviderBillingError: abort entire batch
3. Log summary
```

The `ProviderBillingError` abort is important: billing/quota errors affect the entire account, not just one item. Continuing after such an error wastes retries and can incur costs.

---

## Ranking pipeline

```
scripts/rank-items.ts

1. Query all enriched items, paginated in batches of 500
2. Find maxStars across the entire corpus (for normalisation)
3. For each item: computeRankingScore(item, { maxStars })
4. Batch write ranking_score back to DB (concurrent, WRITE_CONCURRENCY = 10)
5. Log summary + top 20 (dry-run mode: skip step 4)
```

The `maxStars` value is corpus-global, not batch-local. This ensures the GitHub momentum score is comparable across all items.

---

## Security model

| Asset | Where used | How protected |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/server.ts` only | Never imported in `app/` or `components/` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | `lib/ai/provider.ts` only | Never imported in `app/` |
| `GITHUB_TOKEN` | `lib/ingestion/github.ts` only | Script-only, never in web app |
| `CRON_SECRET` | `app/api/refresh/daily/route.ts` only | Compared against `Authorization: Bearer` header; route returns 401 if missing or mismatched; never sent to client |
| `NEXT_PUBLIC_SUPABASE_URL` | Both client and server | Safe to expose — just the project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `lib/supabase/client.ts` only | Publishable key, subject to RLS |

**Row-level security:** The service-role key bypasses RLS. The `items` table is currently read-only from the web app, so this is safe. If a browser client is introduced in the future, RLS policies should restrict it to `SELECT` only.

---

## Key constraints and tradeoffs

**Single `items` table** — A normalized design would have separate tables for `github_items`, `hn_items`, `rss_items`. The single-table design simplifies queries (especially cross-source ranking) at the cost of nullable source-specific columns. At the current scale (< 10,000 items), this is the right tradeoff.

**Computed `ranking_score` vs. real-time calculation** — The ranking score is computed by the ranking script and stored in the DB. Real-time calculation per request would be more accurate (especially for recency) but is too expensive at query time across thousands of items. The stored score is recomputed after each ingestion + enrichment cycle.

**In-memory deduplication** — Cross-section dedup on the homepage and digest is done in-memory in the Server Component, not in SQL. This is correct: SQL-side dedup across sections would require complex CTEs or multiple roundtrips. The in-memory approach is simple, readable, and fast for the quantities involved (< 100 candidates fetched total).

**`force-dynamic` on all pages** — All four data pages could use `revalidate = 3600` (hourly ISR) since data only changes when the cron runs (08:00 UTC) or when scripts are run manually. `force-dynamic` was chosen to guarantee freshness and simplify reasoning during development. Switching to ISR is a straightforward future optimisation now that the cron schedule is predictable.
