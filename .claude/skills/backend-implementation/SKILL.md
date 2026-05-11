---
name: backend-implementation
description: Use for Supabase schema, API routes, ingestion scripts, server-side utilities. Keeps secrets server-only and runs lint/typecheck/build after every change.
---

# Backend Implementation

Use this skill whenever adding or modifying server-side code: database schema, API routes, ingestion jobs, Supabase utilities, or any logic that touches secrets.

## Process

1. **Read all files you will touch** before making any edit.
2. **Implement one logical unit at a time** (one route, one migration, one utility function). Do not batch unrelated changes.
3. **After each unit**, run:
   ```bash
   npm run lint && npm run typecheck && npm run build
   ```
   Fix every failure before continuing.
4. **Summarize changed files** and suggest a commit message when the unit is complete.

## Secret handling rules

- `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN` are server-only.
- Never reference these in files under `app/` that are not Route Handlers or Server Actions.
- Never include them in API responses, error messages, or logs.
- Access via `process.env.*` only inside server-only modules.

## Supabase conventions

- Use the service role client only in Route Handlers and server utilities — never in client components.
- Validate all inputs with Zod before issuing queries.
- Return typed results; do not use `any`.
- Handle `error` from every Supabase call explicitly — do not silently ignore it.

## API route conventions

- Every route must handle the error case and return a typed error response.
- Validate request bodies with Zod before processing.
- Use `NextResponse.json()` with explicit status codes.
- Rate-limit external-facing routes where appropriate.

## Ingestion scripts

- Treat all external API responses (GitHub, HN, RSS) as untrusted — validate with Zod.
- Log fetch errors without leaking secrets.
- Implement idempotent upserts (not blind inserts) so re-runs are safe.
- Add empty-response handling: log and return gracefully when a source returns nothing.

## Checklist before marking done

- [ ] No secret references outside server-only files
- [ ] All inputs validated with Zod
- [ ] All Supabase errors handled
- [ ] lint + typecheck + build pass
- [ ] Empty/error states handled
