-- Lock down tables that are accessed only by AgentRadar's server-side service
-- client. RLS alone is not enough to make Data API exposure deterministic, so
-- direct privileges are revoked from public client roles as well.

alter table if exists public.pipeline_runs enable row level security;
alter table if exists public.pipeline_runs force row level security;
alter table if exists public.subscribers enable row level security;
alter table if exists public.subscribers force row level security;

revoke all privileges on table public.pipeline_runs from public, anon, authenticated;
revoke all privileges on table public.subscribers from public, anon, authenticated;

grant select, insert, update, delete on table public.pipeline_runs to service_role;
grant select, insert, update, delete on table public.subscribers to service_role;

-- Public pages use server-rendered, explicitly projected queries. Prevent direct
-- Data API clients from requesting raw ingestion payloads or pipeline errors.
revoke all privileges on table public.items from public, anon, authenticated;
revoke all privileges on table public.digests from public, anon, authenticated;
revoke all privileges on table public.digest_items from public, anon, authenticated;
revoke all privileges on table public.rss_feeds from public, anon, authenticated;
revoke all privileges on table public.digest_summaries from public, anon, authenticated;

grant select, insert, update, delete on table public.items to service_role;
grant select, insert, update, delete on table public.digests to service_role;
grant select, insert, update, delete on table public.digest_items to service_role;
grant select, insert, update, delete on table public.rss_feeds to service_role;
grant select, insert, update, delete on table public.digest_summaries to service_role;

-- A durable lease prevents overlapping cron/manual pipeline executions from
-- duplicating paid AI calls. Expired rows are safely reclaimed by the app.
create table if not exists public.pipeline_locks (
  name          text primary key,
  owner_token   uuid not null,
  acquired_at   timestamptz not null default now(),
  expires_at    timestamptz not null
);

create index if not exists pipeline_locks_expires_at_idx
  on public.pipeline_locks (expires_at);

alter table public.pipeline_locks enable row level security;
alter table public.pipeline_locks force row level security;
revoke all privileges on table public.pipeline_locks from public, anon, authenticated;
grant select, insert, update, delete on table public.pipeline_locks to service_role;
