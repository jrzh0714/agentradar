-- Digest email subscribers — demand probe for the weekly digest email.
-- Sending is not built yet; this table measures whether people want to be
-- pulled back before we invest in delivery.

create table if not exists subscribers (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null unique,
  created_at    timestamptz not null    default now(),
  -- where the signup came from (digest page, homepage, etc.)
  source        text        not null    default 'digest',
  -- soft unsubscribe flag for when sending exists
  unsubscribed  boolean     not null    default false
);

create index if not exists subscribers_created_at_idx on subscribers (created_at desc);
