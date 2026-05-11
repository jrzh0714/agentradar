# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AgentRadar is an AI-curated discovery hub that tracks emerging GenAI tools, agent frameworks, GitHub projects, and developer workflows, then summarizes what matters and why.

## Tech Stack

- **Next.js App Router** (TypeScript)
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (Postgres, via service role server-side only)
- **OpenAI or Anthropic API** for summarization/curation
- **GitHub API**, **Hacker News Algolia API**, **RSS feeds** for ingestion
- **Vercel** deployment

## Commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run lint       # eslint . (next lint does not exist in Next.js 16)
npm run typecheck  # tsc --noEmit
npm test           # no tests yet — exits 0
```

After any code change: run lint, typecheck, tests (if present), and build. If a command fails, diagnose and fix before moving on.

## Architecture

### Data flow

External sources (GitHub API, HN Algolia, RSS) → ingestion API routes or cron jobs → Supabase Postgres → AI summarization layer → read API routes → frontend.

### Key boundaries

- **Ingestion**: server-only API routes or Vercel cron jobs that fetch raw items from external sources and write to Supabase. Never called from the client.
- **Summarization**: server-only calls to OpenAI/Anthropic that annotate ingested items. AI output must be validated with Zod before persisting.
- **Read layer**: API routes (or Server Components) that query Supabase and return typed, validated data to the UI.
- **UI**: Client and Server Components using shadcn/ui + Tailwind. No direct database or AI calls from client components.

### Supabase keys

Supabase now issues **publishable keys** (`sb_publishable_...`) in place of the legacy anon key.

| Variable | Used in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | safe to expose |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser client only | replaces old `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | never expose to browser |

### Security invariants

`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GITHUB_TOKEN` are server-side only. Never import or reference them in client components or expose them in API responses.

### Validation

Use Zod for all external API responses (GitHub, HN, RSS) and all AI-generated output before it touches the database or the client.

## Development Workflow

1. **Plan** the change before editing any file.
2. **Inspect existing files** before editing them.
3. **Implement one phase at a time** — no large features in a single step.
4. **Run checks** (lint → typecheck → tests → build).
5. **Summarize changed files** and suggest a git commit message.

Prefer small, reviewable changes. Every feature needs basic error handling and empty states. This is a portfolio-grade app — code clarity matters.

Do not fake metrics, fake screenshots, fake live links, or fake users.
