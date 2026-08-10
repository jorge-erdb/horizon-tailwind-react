-- Nova Analytics — 0004_metrics
--
-- Two tables: raw `events` (populated in phase 5 by the ingest function) and
-- `metric_points`, the rolled-up series everything on screen actually reads.
--
-- metric_points is deliberately one generic table rather than a bespoke table
-- per chart. Each chart is a different slice of the same shape:
--
--   TotalSpent line     -> metric_key in ('revenue','profit'), grain 'month'
--   WeeklyRevenue bars  -> metric_key 'revenue', grain 'day',
--                          dims->>'stream' in (subscriptions|usage|services)
--   DailyTraffic bars   -> metric_key 'visitors', grain 'hour'
--   Traffic pie         -> metric_key 'sessions', grain 'day',
--                          dims->>'platform' in (web|mobile|api)
--
-- Adding a chart means adding rows, not a migration.

-- ---------------------------------------------------------------------------
-- events — raw, append-only
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id             bigint      generated always as identity primary key,
  workspace_id   uuid        not null references public.workspaces (id) on delete cascade,
  data_source_id uuid        references public.data_sources (id) on delete set null,
  name           text        not null,
  occurred_at    timestamptz not null default now(),
  -- Anonymous or identified actor; what "active users" counts distinctly.
  distinct_id    text,
  platform       text        check (platform in ('web', 'mobile', 'api', 'server')),
  properties     jsonb       not null default '{}'::jsonb,
  revenue_cents  bigint      not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists events_workspace_occurred_idx
  on public.events (workspace_id, occurred_at desc);
create index if not exists events_workspace_name_idx
  on public.events (workspace_id, name, occurred_at desc);
create index if not exists events_properties_idx
  on public.events using gin (properties);

alter table public.events enable row level security;

-- Read-only from the browser. Writes arrive through the ingest edge function
-- (phase 5), which authenticates a per-source write key rather than a user.
drop policy if exists "Members read events" on public.events;
create policy "Members read events"
  on public.events for select
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- metric_points — the aggregated series behind every chart and KPI
-- ---------------------------------------------------------------------------

create table if not exists public.metric_points (
  workspace_id uuid        not null references public.workspaces (id) on delete cascade,
  bucket       timestamptz not null,
  grain        text        not null check (grain in ('hour', 'day', 'month')),
  metric_key   text        not null,
  dims         jsonb       not null default '{}'::jsonb,
  value        numeric     not null default 0,
  updated_at   timestamptz not null default now(),
  -- One row per series point. The rollup upserts on this, so re-running it is
  -- idempotent. dims participates in the key so a metric can be sliced by
  -- platform or revenue stream without colliding.
  primary key (workspace_id, grain, metric_key, bucket, dims)
);

create index if not exists metric_points_lookup_idx
  on public.metric_points (workspace_id, metric_key, grain, bucket desc);
create index if not exists metric_points_dims_idx
  on public.metric_points using gin (dims);

alter table public.metric_points enable row level security;

drop policy if exists "Members read metrics" on public.metric_points;
create policy "Members read metrics"
  on public.metric_points for select
  using (public.is_workspace_member(workspace_id));

-- Seeding and the phase-5 rollup both run as definer functions, so no write
-- policy is exposed to the browser.

-- ---------------------------------------------------------------------------
-- Series reader
--
-- One RPC for every chart. Returning the slice pre-shaped keeps the client
-- from pulling a wide range and filtering in JS.
-- ---------------------------------------------------------------------------

create or replace function public.get_metric_series(
  target_workspace uuid,
  metric           text,
  series_grain     text,
  since            timestamptz default null,
  dim_key          text        default null
)
returns table (bucket timestamptz, dim_value text, value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.bucket,
    case when dim_key is null then null else p.dims ->> dim_key end as dim_value,
    sum(p.value) as value
  from public.metric_points p
  where p.workspace_id = target_workspace
    and p.metric_key   = metric
    and p.grain        = series_grain
    and (since is null or p.bucket >= since)
  group by p.bucket, 2
  order by p.bucket;
$$;

-- SECURITY INVOKER above is deliberate: the caller's RLS on metric_points
-- still applies, so this cannot be used to read another tenant's series.

revoke execute on function public.get_metric_series(uuid, text, text, timestamptz, text) from public;
grant execute on function public.get_metric_series(uuid, text, text, timestamptz, text) to authenticated;
