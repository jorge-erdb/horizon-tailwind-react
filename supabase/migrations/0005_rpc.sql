-- Nova Analytics — 0005_rpc
--
-- get_dashboard_kpis: the six-tile row at the top of the dashboard, plus
-- period-over-period deltas, in one round trip.
--
-- Six separate queries for one card row is the obvious thing to get wrong —
-- it is also six chances for the tiles to disagree with each other if data
-- shifts mid-render. One call, one snapshot.

-- ---------------------------------------------------------------------------
-- Percentage change, with the divide-by-zero and "grew from nothing" cases
-- handled once rather than at four call sites.
--
-- Defined before get_dashboard_kpis because it is called from that body.
-- ---------------------------------------------------------------------------

create or replace function public.pct_change(current_value numeric, prior_value numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when prior_value is null or prior_value = 0 then
      case when coalesce(current_value, 0) = 0 then 0 else 100 end
    else round(((coalesce(current_value, 0) - prior_value) / abs(prior_value)) * 100, 2)
  end;
$$;

-- ---------------------------------------------------------------------------
-- The KPI row
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
  -- Belt and braces: metric_points RLS already scopes reads to the caller's
  -- workspaces, but failing loudly beats silently returning zeros for a
  -- workspace the caller cannot see.
  if not public.is_workspace_member(target_workspace) then
    raise exception 'Not a member of that workspace';
  end if;

  return query
  with
  -- Current and prior window totals for every daily metric, in one pass.
  metric_windows as (
    select
      p.metric_key,
      sum(p.value) filter (where p.bucket >= period_start)                            as current_total,
      sum(p.value) filter (where p.bucket >= prior_start and p.bucket < period_start) as prior_total
    from public.metric_points p
    where p.workspace_id = target_workspace
      and p.grain = 'day'
      and p.bucket >= prior_start
      and p.metric_key in ('revenue', 'active_users', 'events', 'signups', 'visitors')
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
      coalesce(max(current_total) filter (where metric_key = 'visitors'), 0)     as visitors_now,
      coalesce(max(prior_total)   filter (where metric_key = 'visitors'), 0)     as visitors_prior
    from metric_windows
  ),
  counts as (
    select
      (select count(*) from public.alerts a
        where a.workspace_id = target_workspace and a.is_active)   as alert_count,
      -- Every configured source, including errored ones. Counting only
      -- healthy sources made the tile disagree with the table right below it,
      -- which reads as a bug; source health is already surfaced by the alerts
      -- tile and the status column.
      (select count(*) from public.data_sources d
        where d.workspace_id = target_workspace)                   as source_count
  )
  select
    m.revenue_now,
    public.pct_change(m.revenue_now, m.revenue_prior),
    -- active_users is a daily figure, so the headline is the daily average
    -- over the window. Summing would count a returning user once per day.
    round(m.users_now / greatest(window_days, 1)::numeric, 0),
    public.pct_change(m.users_now, m.users_prior),
    m.events_now,
    public.pct_change(m.events_now, m.events_prior),
    case when m.visitors_now = 0 then 0
         else round((m.signups_now / m.visitors_now) * 100, 2) end,
    public.pct_change(
      case when m.visitors_now   = 0 then 0 else m.signups_now   / m.visitors_now   end,
      case when m.visitors_prior = 0 then 0 else m.signups_prior / m.visitors_prior end
    ),
    c.alert_count,
    c.source_count
  from metric m cross join counts c;
end;
$$;

revoke execute on function public.pct_change(numeric, numeric) from public;
revoke execute on function public.get_dashboard_kpis(uuid, integer) from public;
grant execute on function public.pct_change(numeric, numeric) to authenticated;
grant execute on function public.get_dashboard_kpis(uuid, integer) to authenticated;
