-- Nova Analytics — 0010_ingest
--
-- Phase 5. Three things:
--
--   1. Per-source write keys — minted once, stored only as a hash.
--   2. ingest_events() — authenticates a write key and appends to `events`.
--   3. refresh_metric_points() — rolls `events` up into the same
--      `metric_points` rows the seed writes, so nothing on screen changes
--      shape when real data starts arriving.
--
-- The event vocabulary is open but the four names that drive charts are
-- validated strictly, because a typo'd `purchase` is not a missing bar — it
-- is a *wrong* bar, and wrong is worse than absent:
--
--   page_view     -> visits (additive), visitors (distinct)
--   session_start -> sessions, split by platform
--   signup        -> signups
--   purchase      -> revenue, split by properties->>'stream'
--   (any name)    -> events, active_users
--
-- ---------------------------------------------------------------------------

-- `digest` and `gen_random_bytes` come from pgcrypto. Supabase already has an
-- `extensions` schema and puts it there; creating the schema first keeps this
-- file runnable against a bare Postgres too (the migration test container),
-- and is a no-op on Supabase.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Write keys
--
-- SHA-256, not bcrypt. Bcrypt is the right answer for passwords because
-- passwords are low-entropy and guessable, and the cost factor is what buys
-- you resistance. A write key here is 24 bytes from gen_random_bytes — there
-- is nothing to guess, so a slow hash would only tax every ingest request on
-- the hot path while buying no security.
-- ---------------------------------------------------------------------------

create or replace function public.hash_write_key(raw_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(raw_key, 'UTF8'), 'sha256'), 'hex');
$$;

-- Lookup is by hash on every ingest call, so it needs an index. Partial
-- because most rows never get a key, and unique because two sources sharing a
-- key would make ingestion non-deterministic about where events land.
create unique index if not exists data_sources_write_key_hash_idx
  on public.data_sources (write_key_hash)
  where write_key_hash is not null;

-- ---------------------------------------------------------------------------
-- issue_write_key — mint (or rotate) a source's key and return it ONCE
--
-- The plaintext is returned to the caller and never stored. Rotating
-- immediately invalidates the old key: there is one hash column, so the
-- previous value is overwritten rather than kept alongside.
-- ---------------------------------------------------------------------------

create or replace function public.issue_write_key(target_source uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws       uuid;
  raw_key  text;
begin
  select d.workspace_id into ws
    from public.data_sources d where d.id = target_source;

  if ws is null then
    raise exception 'Data source not found' using errcode = 'P0001';
  end if;

  -- Definer function reachable from PostgREST, so membership is checked here
  -- rather than relying on the table's RLS (which a definer bypasses).
  -- Same three caller shapes as 0008: an untrusted PostgREST caller must
  -- prove membership; service_role and a backend script have no JWT to check.
  if auth.uid() is not null then
    if not public.is_workspace_member(ws) then
      raise exception 'Not a member of that workspace' using errcode = 'P0001';
    end if;
  elsif current_user in ('anon', 'authenticated') then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  raw_key := 'nvk_' || encode(extensions.gen_random_bytes(24), 'hex');

  update public.data_sources
     set write_key_hash = public.hash_write_key(raw_key),
         -- Last six characters only: enough to tell two keys apart in the UI,
         -- useless for reconstructing one.
         write_key_hint = right(raw_key, 6)
   where id = target_source;

  return raw_key;
end;
$$;

revoke execute on function public.issue_write_key(uuid) from public;
revoke execute on function public.issue_write_key(uuid) from anon;
grant execute on function public.issue_write_key(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ingest_events
--
-- Called only by the edge function, which holds the service_role key. NOT
-- granted to anon: the write key is the credential, but keeping this off the
-- public PostgREST surface means a bug in validation cannot be reached
-- without first getting past the edge function.
--
-- Returns the number of rows written. Raises on a bad key or a malformed
-- reserved event, and the edge function maps those to 401/400.
-- ---------------------------------------------------------------------------

create or replace function public.ingest_events(p_write_key text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  src_id    uuid;
  ws        uuid;
  item      jsonb;
  idx       integer := 0;
  written   integer := 0;
  ev_name   text;
  ev_stream text;
  ev_plat   text;
  ev_rev    numeric;
begin
  if p_write_key is null or length(p_write_key) < 8 then
    raise exception 'Missing write key' using errcode = '28000';
  end if;

  -- Equality against a hashed column, so a null write_key_hash on the ~6
  -- seeded sources can never match: `null = anything` is null, not true.
  select d.id, d.workspace_id into src_id, ws
    from public.data_sources d
   where d.write_key_hash = public.hash_write_key(p_write_key);

  if src_id is null then
    raise exception 'Invalid write key' using errcode = '28000';
  end if;

  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'events must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_events) = 0 then
    return 0;
  end if;

  if jsonb_array_length(p_events) > 500 then
    raise exception 'Batch too large: % events (max 500)', jsonb_array_length(p_events)
      using errcode = '22023';
  end if;

  for item in select * from jsonb_array_elements(p_events) loop
    ev_name := nullif(trim(item ->> 'name'), '');
    if ev_name is null then
      raise exception 'events[%]: name is required', idx using errcode = '22023';
    end if;

    ev_plat := nullif(item ->> 'platform', '');
    if ev_plat is not null and ev_plat not in ('web', 'mobile', 'api', 'server') then
      raise exception 'events[%]: platform % is not one of web, mobile, api, server',
        idx, ev_plat using errcode = '22023';
    end if;

    -- Strict validation for the reserved names only. Everything else is
    -- accepted as-is and counted toward `events` / `active_users`.
    if ev_name = 'purchase' then
      if item -> 'revenue_cents' is null then
        raise exception 'events[%]: purchase requires revenue_cents', idx
          using errcode = '22023';
      end if;

      begin
        ev_rev := (item ->> 'revenue_cents')::numeric;
      exception when others then
        raise exception 'events[%]: revenue_cents must be a number', idx
          using errcode = '22023';
      end;

      if ev_rev < 0 or ev_rev <> trunc(ev_rev) then
        raise exception 'events[%]: revenue_cents must be a non-negative integer', idx
          using errcode = '22023';
      end if;

      -- The stacked revenue chart has exactly three streams. An unrecognised
      -- one would silently render a fourth bar segment nobody configured, so
      -- it is rejected at the door instead.
      ev_stream := nullif(item #>> '{properties,stream}', '');
      if ev_stream is null then
        raise exception 'events[%]: purchase requires properties.stream', idx
          using errcode = '22023';
      end if;
      if ev_stream not in ('subscriptions', 'usage', 'services') then
        raise exception 'events[%]: stream % is not one of subscriptions, usage, services',
          idx, ev_stream using errcode = '22023';
      end if;
    end if;

    if ev_name in ('page_view', 'session_start') and nullif(item ->> 'distinct_id', '') is null then
      raise exception 'events[%]: % requires distinct_id', idx, ev_name
        using errcode = '22023';
    end if;

    insert into public.events (
      workspace_id, data_source_id, name, occurred_at,
      distinct_id, platform, properties, revenue_cents
    )
    values (
      ws,
      src_id,
      ev_name,
      coalesce((item ->> 'occurred_at')::timestamptz, now()),
      nullif(item ->> 'distinct_id', ''),
      ev_plat,
      coalesce(item -> 'properties', '{}'::jsonb),
      coalesce((item ->> 'revenue_cents')::bigint, 0)
    );

    written := written + 1;
    idx := idx + 1;
  end loop;

  update public.data_sources
     set last_sync_at = now()
   where id = src_id;

  return written;
end;
$$;

revoke execute on function public.ingest_events(text, jsonb) from public;
revoke execute on function public.ingest_events(text, jsonb) from anon;
revoke execute on function public.ingest_events(text, jsonb) from authenticated;
grant execute on function public.ingest_events(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- refresh_metric_points — events -> metric_points
--
-- Authoritative per bucket: every day bucket that has events gets its owned
-- metric keys deleted and rewritten. Upserting instead would leave stale
-- seeded rows behind for dims that no longer appear (a revenue stream that
-- stopped, say), and the chart would keep drawing them forever.
--
-- Buckets with no events are never touched, so a workspace can carry seeded
-- history and live data side by side.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_metric_points(
  target_workspace uuid,
  since            timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Default to a 3-day tail rather than all history: cron runs often, and
  -- rewriting 90 days of buckets every five minutes is wasted work. Late
  -- arriving events older than this need an explicit backfill call.
  --
  -- Snapped to a day boundary. This keeps the touched-bucket set stable
  -- across runs within a day instead of drifting with the clock, and it is
  -- one of the two things stopping a partially-covered bucket from being
  -- rebuilt from a partial day — see the note on the aggregate joins below.
  from_ts timestamptz := date_trunc('day', coalesce(since, now() - interval '3 days'));
begin
  if target_workspace is null then
    return;
  end if;

  -- --- day grain ----------------------------------------------------------
  -- The touched-bucket set is recomputed as a CTE in each statement rather
  -- than materialised into a temp table. plpgsql caches query plans, and a
  -- cached plan that references a temp table breaks with "relation with OID
  -- ... does not exist" the next time the function runs in the same session
  -- against a freshly recreated one — which is exactly what a cron job does.
  delete from public.metric_points p
  where p.workspace_id = target_workspace
    and p.grain = 'day'
    and p.metric_key in
      ('visits', 'visitors', 'signups', 'active_users', 'events', 'revenue', 'sessions')
    and p.bucket in (
      select distinct date_trunc('day', e.occurred_at)
        from public.events e
       where e.workspace_id = target_workspace
         and e.occurred_at >= from_ts
    );

  -- Scalar day metrics.
  with touched as (
    select distinct date_trunc('day', e.occurred_at) as bucket
      from public.events e
     where e.workspace_id = target_workspace
       and e.occurred_at >= from_ts
  )
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select target_workspace, t.bucket, 'day', m.metric_key, '{}'::jsonb, m.value
  from touched t
  cross join lateral (
      select 'visits' as metric_key,
             count(*) filter (where e.name = 'page_view')::numeric as value
        from public.events e
       where e.workspace_id = target_workspace
         and date_trunc('day', e.occurred_at) = t.bucket
      union all
      -- Distinct, so this is NOT additive across buckets. Summing a week of
      -- these counts a returning visitor once per day. `visits` above exists
      -- precisely so the conversion rate has an additive denominator.
      select 'visitors',
             count(distinct e.distinct_id) filter (where e.name = 'page_view')::numeric
        from public.events e
       where e.workspace_id = target_workspace
         and date_trunc('day', e.occurred_at) = t.bucket
      union all
      select 'signups',
             count(*) filter (where e.name = 'signup')::numeric
        from public.events e
       where e.workspace_id = target_workspace
         and date_trunc('day', e.occurred_at) = t.bucket
      union all
      -- "Active" means did something other than look at a page.
      select 'active_users',
             count(distinct e.distinct_id) filter (where e.name <> 'page_view')::numeric
        from public.events e
       where e.workspace_id = target_workspace
         and date_trunc('day', e.occurred_at) = t.bucket
      union all
      select 'events', count(*)::numeric
        from public.events e
       where e.workspace_id = target_workspace
         and date_trunc('day', e.occurred_at) = t.bucket
  ) m
  where m.value is not null;

  -- Revenue by stream. Stored in the same units as the seed — whole currency,
  -- not cents — because the charts format it as currency and metric_points
  -- has no unit column to disambiguate.
  --
  -- Note the shape of the join: the touched set selects *which* buckets to
  -- rebuild, and the aggregate then reads the whole of each one. The delete
  -- above removes whole buckets, so an aggregate that instead filtered on
  -- `occurred_at >= from_ts` would rebuild a bucket from only the slice after
  -- the cutoff and silently drop everything earlier in that day.
  --
  -- Snapping from_ts to midnight independently prevents that, so the two are
  -- redundant — either alone is sufficient. Both are kept because they fail
  -- in opposite directions: the snap is easy to drop while "optimising" the
  -- window, and the join shape is easy to lose while adding a metric.
  -- assertions.sql covers the case where both are removed.
  with touched as (
    select distinct date_trunc('day', e.occurred_at) as bucket
      from public.events e
     where e.workspace_id = target_workspace
       and e.occurred_at >= from_ts
  )
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select
    target_workspace,
    t.bucket,
    'day',
    'revenue',
    jsonb_build_object('stream', e.properties ->> 'stream'),
    sum(e.revenue_cents) / 100.0
  from touched t
  join public.events e
    on e.workspace_id = target_workspace
   and date_trunc('day', e.occurred_at) = t.bucket
  where e.name = 'purchase'
  group by t.bucket, 5;

  -- Sessions by platform. session_start is one row per session, so a plain
  -- count is the session count; no distinct needed.
  with touched as (
    select distinct date_trunc('day', e.occurred_at) as bucket
      from public.events e
     where e.workspace_id = target_workspace
       and e.occurred_at >= from_ts
  )
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select
    target_workspace,
    t.bucket,
    'day',
    'sessions',
    jsonb_build_object('platform', coalesce(e.platform, 'web')),
    count(*)::numeric
  from touched t
  join public.events e
    on e.workspace_id = target_workspace
   and date_trunc('day', e.occurred_at) = t.bucket
  where e.name = 'session_start'
  group by t.bucket, 5;

  -- --- hour grain (DailyTraffic) ------------------------------------------
  delete from public.metric_points p
  where p.workspace_id = target_workspace
    and p.grain = 'hour'
    and p.metric_key = 'visitors'
    and p.bucket in (
      select distinct date_trunc('hour', e.occurred_at)
        from public.events e
       where e.workspace_id = target_workspace
         and e.occurred_at >= from_ts
    );

  with touched as (
    select distinct date_trunc('hour', e.occurred_at) as bucket
      from public.events e
     where e.workspace_id = target_workspace
       and e.occurred_at >= from_ts
  )
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select
    target_workspace,
    t.bucket,
    'hour',
    'visitors',
    '{}'::jsonb,
    count(distinct e.distinct_id)::numeric
  from touched t
  join public.events e
    on e.workspace_id = target_workspace
   and date_trunc('hour', e.occurred_at) = t.bucket
  where e.name = 'page_view'
  group by t.bucket;

  -- --- month grain --------------------------------------------------------
  -- Rebuilt from the day rows rather than from events, so months that mix
  -- seeded history with live data add up to the sum of what the daily chart
  -- shows. Deriving from events would drop the seeded portion.
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select
    target_workspace,
    date_trunc('month', p.bucket),
    'month',
    'revenue',
    '{}'::jsonb,
    sum(p.value)
  from public.metric_points p
  where p.workspace_id = target_workspace
    and p.grain = 'day'
    and p.metric_key = 'revenue'
  group by date_trunc('month', p.bucket)
  on conflict (workspace_id, grain, metric_key, bucket, dims)
    do update set value = excluded.value, updated_at = now();

  perform public.refresh_profit_points_unchecked(target_workspace);

  -- --- per-source health --------------------------------------------------
  -- Only sources that have actually reported. Seeded sources have plausible
  -- events_30d values and no events rows; recomputing those would zero them
  -- and make the demo workspace look broken.
  update public.data_sources d
     set events_30d = s.recent,
         last_sync_at = s.latest,
         -- Share of the days this source *could* have reported on which it
         -- actually did — a real signal about pipeline continuity rather
         -- than a static number.
         --
         -- The window is the source's own age, capped at 7 days, not a flat
         -- 7. Dividing by 7 unconditionally means a source connected today
         -- has one active day out of seven and scores 14% while working
         -- perfectly, and nothing under a week old can ever reach 100%. That
         -- turns the health column into an age column.
         --
         -- Clamped to 100 because health_pct is `check (between 0 and 100)`
         -- and active_days can exceed the window: backfilling history through
         -- a source created today gives 7 active days against a 1-day window.
         -- Unclamped that is 700%, which fails the constraint and takes the
         -- whole rollup — every metric, every workspace — down with it on
         -- every cron run.
         health_pct = least(
           round(
             s.active_days * 100.0 / greatest(
               least(
                 7,
                 ceil(extract(epoch from (now() - d.created_at)) / 86400.0)
               ),
               1
             ),
             2
           ),
           100
         )
    from (
      select
        e.data_source_id,
        count(*) filter (where e.occurred_at >= now() - interval '30 days') as recent,
        max(e.occurred_at)                                                  as latest,
        count(distinct date_trunc('day', e.occurred_at))
          filter (where e.occurred_at >= now() - interval '7 days')         as active_days
      from public.events e
      where e.workspace_id = target_workspace
        and e.data_source_id is not null
      group by e.data_source_id
    ) s
   where d.id = s.data_source_id
     and d.workspace_id = target_workspace;
end;
$$;

revoke execute on function public.refresh_metric_points(uuid, timestamptz) from public;
revoke execute on function public.refresh_metric_points(uuid, timestamptz) from anon;
revoke execute on function public.refresh_metric_points(uuid, timestamptz) from authenticated;
grant execute on function public.refresh_metric_points(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- refresh_all_metric_points — the cron entry point
-- ---------------------------------------------------------------------------

create or replace function public.refresh_all_metric_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws      uuid;
  touched integer := 0;
begin
  -- Only workspaces with recent events. Iterating every workspace would make
  -- the job's cost scale with signups rather than with traffic.
  for ws in
    select distinct e.workspace_id
      from public.events e
     where e.occurred_at >= now() - interval '3 days'
  loop
    perform public.refresh_metric_points(ws);
    touched := touched + 1;
  end loop;

  return touched;
end;
$$;

revoke execute on function public.refresh_all_metric_points() from public;
revoke execute on function public.refresh_all_metric_points() from anon;
revoke execute on function public.refresh_all_metric_points() from authenticated;
grant execute on function public.refresh_all_metric_points() to service_role;

-- ---------------------------------------------------------------------------
-- Conversion rate: prefer the additive denominator
--
-- Replaces the 0005 body. `visitors` is a distinct count, but the KPI sums it
-- across a 30-day window — which counts a returning visitor once per day and
-- so reports a conversion rate lower than the truth. The seed hid this by
-- generating each grain independently.
--
-- `visits` (raw page_view count) is additive and is anyway the correct
-- denominator for "signups per visit". Seeded workspaces have no `visits`
-- rows, so this falls back to the old behaviour for them rather than
-- reporting zero.
-- ---------------------------------------------------------------------------

create or replace function public.get_dashboard_kpis(
  target_workspace uuid,
  window_days      integer default 30
)
returns table (
  monthly_revenue        numeric,
  monthly_revenue_delta  numeric,
  active_users           numeric,
  active_users_delta     numeric,
  events_tracked         numeric,
  events_tracked_delta   numeric,
  conversion_rate        numeric,
  conversion_rate_delta  numeric,
  active_alerts          bigint,
  data_sources           bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  period_start timestamptz := date_trunc('day', now()) - make_interval(days => window_days);
  prior_start  timestamptz := date_trunc('day', now()) - make_interval(days => window_days * 2);
begin
  if not public.is_workspace_member(target_workspace) then
    raise exception 'Not a member of that workspace';
  end if;

  return query
  with
  metric_windows as (
    select
      p.metric_key,
      sum(p.value) filter (where p.bucket >= period_start)                            as current_total,
      sum(p.value) filter (where p.bucket >= prior_start and p.bucket < period_start) as prior_total
    from public.metric_points p
    where p.workspace_id = target_workspace
      and p.grain = 'day'
      and p.bucket >= prior_start
      and p.metric_key in ('revenue', 'active_users', 'events', 'signups', 'visitors', 'visits')
    group by p.metric_key
  ),
  metric as (
    select
      coalesce(max(current_total) filter (where metric_key = 'revenue'), 0)      as revenue_now,
      coalesce(max(prior_total)   filter (where metric_key = 'revenue'), 0)      as revenue_prior,
      coalesce(max(current_total) filter (where metric_key = 'active_users'), 0) as users_now,
      coalesce(max(prior_total)   filter (where metric_key = 'active_users'), 0) as users_prior,
      coalesce(max(current_total) filter (where metric_key = 'events'), 0)       as events_now,
      coalesce(max(prior_total)   filter (where metric_key = 'events'), 0)       as events_prior,
      coalesce(max(current_total) filter (where metric_key = 'signups'), 0)      as signups_now,
      coalesce(max(prior_total)   filter (where metric_key = 'signups'), 0)      as signups_prior,
      -- visits when the workspace has them, visitors otherwise.
      coalesce(
        nullif(max(current_total) filter (where metric_key = 'visits'), 0),
        max(current_total) filter (where metric_key = 'visitors'),
        0
      ) as denom_now,
      coalesce(
        nullif(max(prior_total) filter (where metric_key = 'visits'), 0),
        max(prior_total) filter (where metric_key = 'visitors'),
        0
      ) as denom_prior
    from metric_windows
  ),
  counts as (
    select
      (select count(*) from public.alerts a
        where a.workspace_id = target_workspace and a.is_active)   as alert_count,
      (select count(*) from public.data_sources d
        where d.workspace_id = target_workspace)                   as source_count
  )
  select
    m.revenue_now,
    public.pct_change(m.revenue_now, m.revenue_prior),
    round(m.users_now / greatest(window_days, 1)::numeric, 0),
    public.pct_change(m.users_now, m.users_prior),
    m.events_now,
    public.pct_change(m.events_now, m.events_prior),
    case when m.denom_now = 0 then 0
         else round((m.signups_now / m.denom_now) * 100, 2) end,
    public.pct_change(
      case when m.denom_now   = 0 then 0 else m.signups_now   / m.denom_now   end,
      case when m.denom_prior = 0 then 0 else m.signups_prior / m.denom_prior end
    ),
    c.alert_count,
    c.source_count
  from metric m cross join counts c;
end;
$$;

revoke execute on function public.get_dashboard_kpis(uuid, integer) from public;
revoke execute on function public.get_dashboard_kpis(uuid, integer) from anon;
grant execute on function public.get_dashboard_kpis(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule
--
-- Guarded: pg_cron is not installed in the migration test container, and on
-- Supabase it has to be enabled from Database -> Extensions first. Without it
-- the pipeline still works — the rollup just needs calling manually or from
-- the edge function.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Unschedule first so re-running this file does not stack duplicate jobs.
    perform cron.unschedule('nova-refresh-metric-points')
      where exists (select 1 from cron.job where jobname = 'nova-refresh-metric-points');

    perform cron.schedule(
      'nova-refresh-metric-points',
      '*/5 * * * *',
      $cron$ select public.refresh_all_metric_points(); $cron$
    );

    raise notice 'pg_cron: scheduled nova-refresh-metric-points every 5 minutes';
  else
    raise notice 'pg_cron not available — enable it and re-run this file to schedule the rollup';
  end if;
end $$;
