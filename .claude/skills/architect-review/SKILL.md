---
name: architect-review
description: Use before building any new phase. Reviews requirements, proposes architecture, identifies risks. Read-only by default — does not edit code unless explicitly asked.
---

# Architect Review

Use this skill at the start of each new phase before writing any code.

## What to do

1. **Reread CLAUDE.md** to confirm tech stack constraints and workflow rules.
2. **Read all files relevant to the phase** — existing routes, schema, types, components — before forming an opinion.
3. **Produce a written plan** covering:
   - What this phase delivers (scope boundary)
   - Data model changes (new tables, columns, indexes)
   - API surface (new routes, inputs, outputs, auth requirements)
   - AI/LLM calls (prompts, expected output shape, Zod schema, fallback)
   - Component tree changes (new pages, layouts, shared components)
   - External API calls (GitHub, HN, RSS) and rate-limit considerations
   - Security risks and mitigation
   - Open questions that need user input before implementation can start
4. **Flag risks explicitly**: secret exposure, N+1 queries, missing empty states, AI output trust, over-engineering.
5. **Do not edit any file** unless the user explicitly says "go ahead" or "implement this."

## Output format

```
## Phase N — [Name]

### Scope
[What this phase delivers, what it explicitly excludes]

### Data model
[Tables / columns / indexes to add or change]

### API routes
[Method + path, purpose, auth, input shape, output shape]

### AI calls
[Prompt intent, expected JSON shape, Zod schema outline, fallback]

### Component changes
[New pages, layouts, components]

### External APIs
[Which APIs, rate limits, error handling approach]

### Risks
[Numbered list — severity: low/medium/high]

### Open questions
[Anything that blocks implementation]
```

## Constraints

- Never skip the open questions section — surface ambiguity rather than assume.
- Never propose a design that requires client-side access to server-only secrets.
- Keep scope narrow: one phase at a time.
