-- Nova Analytics — 0006_seed
--
-- Populates a workspace with demo content so the dashboard has something to
-- render before real ingestion exists (phase 5).
--
-- Exposed as a function rather than a bare INSERT script so it can be:
--   * called for any workspace, not just whichever one existed at migration
--     time,
--   * re-run safely (every write is an upsert or guarded by NOT EXISTS),
--   * called from the app when a brand-new workspace would otherwise show an
--     empty dashboard.
--
-- Running this file seeds every existing workspace once, at the bottom.

create or replace function public.seed_workspace_demo_data(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_offset  integer;
  hour_offset integer;
  bucket_day  timestamptz;
  -- Deterministic per-workspace jitter so two workspaces don't look identical
  -- but a given workspace is stable across re-runs.
  seed_base   numeric := (('x' || substr(md5(target_workspace::text), 1, 8))::bit(32)::bigint % 1000) / 1000.0;
  weekday     integer;
  seasonal    numeric;
  trend       numeric;
  visitors    numeric;
  signups     numeric;
begin
  if target_workspace is null then
    return;
  end if;

  -- --- data sources --------------------------------------------------------
  insert into public.data_sources
    (workspace_id, name, kind, status, platforms, events_30d, health_pct, last_sync_at)
  select target_workspace, v.name, v.kind, v.status, v.platforms, v.events_30d, v.health, now() - v.sync_ago
  from (values
    ('Web Analytics',   'web',       'active', array['apple','android','windows'], 2458000, 99.2, interval '4 minutes'),
    ('Mobile SDK',      'mobile',    'active', array['apple','android'],           1485000, 97.4, interval '11 minutes'),
    ('Billing Events',  'billing',   'active', array['windows'],                   1024000, 99.9, interval '2 minutes'),
    ('Checkout Funnel', 'web',       'active', array['apple','android','windows'],  858000, 95.0, interval '7 minutes'),
    ('Product API',     'api',       'active', array['apple','android','windows'], 3170000, 98.1, interval '1 minute'),
    ('Warehouse Sync',  'warehouse', 'error',  array['apple'],                       91200, 12.0, interval '3 days')
  ) as v(name, kind, status, platforms, events_30d, health, sync_ago)
  where not exists (
    select 1 from public.data_sources d
    where d.workspace_id = target_workspace and d.name = v.name
  );

  -- --- reports -------------------------------------------------------------
  insert into public.reports (workspace_id, name, status, schedule, completion, last_run_at)
  select target_workspace, v.name, v.status, v.schedule, v.completion, now() - v.ran_ago
  from (values
    ('Weekly Revenue Report', 'approved', '0 8 * * 1',  92.0, interval '2 days'),
    ('Churn Cohort Analysis', 'disabled', null,         41.0, interval '30 days'),
    ('Warehouse Sync',        'error',    '0 * * * *',  18.0, interval '3 days'),
    ('Acquisition Funnel',    'approved', '0 6 * * *',  67.0, interval '9 hours')
  ) as v(name, status, schedule, completion, ran_ago)
  where not exists (
    select 1 from public.reports r
    where r.workspace_id = target_workspace and r.name = v.name
  );

  -- --- alerts --------------------------------------------------------------
  insert into public.alerts (workspace_id, name, metric_key, comparator, threshold, is_active, triggered_at)
  select target_workspace, v.name, v.metric_key, v.comparator, v.threshold, v.is_active, v.triggered
  from (values
    ('Signup conversion drop', 'conversion_rate', 'below',      3.0,  true,  now() - interval '5 hours'),
    ('Revenue spike',          'revenue',         'above',      20000, true, null::timestamptz),
    ('Ingestion stalled',      'events',          'below',      1000, true,  now() - interval '3 days'),
    ('Churn climbing',         'churn_rate',      'changes_by', 15.0, true,  null::timestamptz),
    ('Warehouse lag',          'sync_lag',        'above',      60.0, false, null::timestamptz)
  ) as v(name, metric_key, comparator, threshold, is_active, triggered)
  where not exists (
    select 1 from public.alerts a
    where a.workspace_id = target_workspace and a.name = v.name
  );

  -- --- tasks ---------------------------------------------------------------
  insert into public.tasks (workspace_id, title, is_done, position)
  select target_workspace, v.title, v.is_done, v.position
  from (values
    ('Review churn alert threshold',    false, 1),
    ('Connect Stripe billing source',   false, 2),
    ('Publish Q3 revenue dashboard',    true,  3),
    ('Audit event schema drift',        false, 4),
    ('Share funnel report with growth', false, 5)
  ) as v(title, is_done, position)
  where not exists (
    select 1 from public.tasks t
    where t.workspace_id = target_workspace and t.title = v.title
  );

  -- --- notifications -------------------------------------------------------
  insert into public.notifications (workspace_id, title, body, kind, created_at)
  select target_workspace, v.title, v.body, v.kind, now() - v.ago
  from (values
    ('Signup conversion is up 12%', 'Week over week, driven by the paid-search segment.', 'success', interval '2 hours'),
    ('Weekly report is ready',      'Your Nova Analytics summary for last week has been generated.', 'info', interval '1 day'),
    ('Warehouse Sync failed',       'The last three sync attempts returned a connection error.', 'danger', interval '3 days')
  ) as v(title, body, kind, ago)
  where not exists (
    select 1 from public.notifications n
    where n.workspace_id = target_workspace and n.title = v.title
  );

  -- --- metric history ------------------------------------------------------
  -- 90 days of daily series with a gentle upward trend and weekday
  -- seasonality, so the charts show something with a shape rather than noise.
  for day_offset in 0..89 loop
    bucket_day := date_trunc('day', now()) - make_interval(days => day_offset);
    weekday    := extract(isodow from bucket_day)::integer;
    -- Weekends run ~35% quieter.
    seasonal   := case when weekday >= 6 then 0.65 else 1.0 end;
    -- Older days are smaller: ~0.6x at 90 days ago rising to 1.0x today.
    trend      := 1.0 - (day_offset::numeric / 225.0);

    visitors := round(2400 * seasonal * trend * (0.9 + seed_base * 0.2));
    signups  := round(visitors * (0.035 + seed_base * 0.01));

    insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
    values
      (target_workspace, bucket_day, 'day', 'visitors',     '{}'::jsonb, visitors),
      (target_workspace, bucket_day, 'day', 'signups',      '{}'::jsonb, signups),
      (target_workspace, bucket_day, 'day', 'active_users', '{}'::jsonb, round(visitors * 0.85)),
      (target_workspace, bucket_day, 'day', 'events',       '{}'::jsonb, round(visitors * 74 * (0.9 + seed_base * 0.2))),
      -- Revenue split across the three streams the stacked bar chart shows.
      (target_workspace, bucket_day, 'day', 'revenue', '{"stream":"subscriptions"}'::jsonb, round(7400 * seasonal * trend)),
      (target_workspace, bucket_day, 'day', 'revenue', '{"stream":"usage"}'::jsonb,         round(3100 * seasonal * trend)),
      (target_workspace, bucket_day, 'day', 'revenue', '{"stream":"services"}'::jsonb,      round(1250 * seasonal * trend)),
      -- Sessions by platform for the donut.
      (target_workspace, bucket_day, 'day', 'sessions', '{"platform":"web"}'::jsonb,    round(visitors * 0.63)),
      (target_workspace, bucket_day, 'day', 'sessions', '{"platform":"mobile"}'::jsonb, round(visitors * 0.25)),
      (target_workspace, bucket_day, 'day', 'sessions', '{"platform":"api"}'::jsonb,    round(visitors * 0.12))
    on conflict (workspace_id, grain, metric_key, bucket, dims)
      do update set value = excluded.value, updated_at = now();
  end loop;

  -- Monthly rollup for the revenue/profit line chart, derived from the daily
  -- rows just written so the two charts cannot disagree.
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

  -- Profit used to be written here as a flat 42% of revenue. It is now
  -- computed from an explicit cost basis by refresh_profit_points (0009), so
  -- that a real ingested revenue line is never paired with an invented
  -- margin. All this does is give the demo workspace a basis to be costed
  -- against; the numbers are stated in the row rather than hidden in a
  -- multiplier, and the row is editable from the app.
  --
  -- Guarded because on a fresh database this file runs before 0009 creates
  -- the table. 0009's backfill covers that pass.
  if to_regclass('public.workspace_costs') is not null then
    insert into public.workspace_costs (
      workspace_id, effective_from, fixed_monthly_cents,
      per_1k_events_cents, revenue_share_bps, note
    )
    values (
      target_workspace,
      (date_trunc('month', now()) - interval '11 months')::date,
      4800000,  -- $48,000/mo fixed: infrastructure, salaries, tooling
      35,       -- $0.35 per 1k events ingested
      290,      -- 2.90% payment processing
      'Demo cost basis — replace with your actual costs'
    )
    on conflict (workspace_id, effective_from) do nothing;

    perform public.refresh_profit_points_unchecked(target_workspace);
  end if;

  -- Today's traffic by hour, for the DailyTraffic bars. Shaped as a working
  -- day: quiet overnight, peaking early afternoon.
  for hour_offset in 0..23 loop
    insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
    values (
      target_workspace,
      date_trunc('day', now()) + make_interval(hours => hour_offset),
      'hour',
      'visitors',
      '{}'::jsonb,
      round(
        140 * (0.25 + 0.75 * exp(-power(hour_offset - 14, 2) / 42.0)) * (0.9 + seed_base * 0.2)
      )
    )
    on conflict (workspace_id, grain, metric_key, bucket, dims)
      do update set value = excluded.value, updated_at = now();
  end loop;
end;
$$;

revoke execute on function public.seed_workspace_demo_data(uuid) from public;
grant execute on function public.seed_workspace_demo_data(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed every workspace that exists right now.
-- ---------------------------------------------------------------------------

do $$
declare
  ws record;
begin
  for ws in select id from public.workspaces loop
    perform public.seed_workspace_demo_data(ws.id);
  end loop;
end;
$$;
