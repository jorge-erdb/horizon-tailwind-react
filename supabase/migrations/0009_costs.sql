-- Nova Analytics — 0009_costs
--
-- Makes `profit` a computed number instead of an invented one.
--
-- 0006 modelled profit as a flat 42% of revenue. That was fine while every
-- number on the dashboard was seeded, but phase 5 ingests real revenue, and a
-- real revenue line paired with a margin nobody chose is worse than no profit
-- line at all — it looks measured.
--
-- So profit gets a basis: an effective-dated cost model per workspace.
--
--   profit(month) = revenue
--                 - fixed_monthly_cents
--                 - per_1k_events_cents * (events / 1000)
--                 - revenue * revenue_share_bps / 10000
--
-- The three terms cover the shapes a real cost base actually takes: a flat
-- platform bill, a volume charge that scales with ingestion, and a percentage
-- cut (payment fees, rev-share) that scales with revenue.
--
-- Effective-dated rather than a single current value, because restating last
-- year's profit every time this year's hosting bill changes makes the chart
-- untrustworthy. Each month is costed at the basis in force during that month.
--
-- A workspace with no cost row gets NO profit rows at all, and the chart
-- silently drops to a single revenue line. That is the intended behaviour:
-- "we have not told the system what things cost" must not render as "we have
-- no costs", which is what a zero-cost default would draw.

-- ---------------------------------------------------------------------------
-- workspace_costs
-- ---------------------------------------------------------------------------

create table if not exists public.workspace_costs (
  id                  uuid    primary key default gen_random_uuid(),
  workspace_id        uuid    not null references public.workspaces (id) on delete cascade,
  -- The month this basis starts applying. Date rather than timestamptz: a cost
  -- basis changes on a billing boundary, not at an instant.
  effective_from      date    not null,
  fixed_monthly_cents bigint  not null default 0 check (fixed_monthly_cents >= 0),
  per_1k_events_cents bigint  not null default 0 check (per_1k_events_cents >= 0),
  -- Basis points so a 2.9% card fee is expressible exactly; 10000 bps = 100%.
  revenue_share_bps   integer not null default 0
                        check (revenue_share_bps between 0 and 10000),
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- One basis per workspace per start month; re-costing a month means editing
  -- the row, which keeps history unambiguous.
  unique (workspace_id, effective_from)
);

create index if not exists workspace_costs_lookup_idx
  on public.workspace_costs (workspace_id, effective_from desc);

alter table public.workspace_costs enable row level security;

drop policy if exists "Members read costs" on public.workspace_costs;
create policy "Members read costs"
  on public.workspace_costs for select
  using (public.is_workspace_member(workspace_id));

-- Cost basis rewrites every historical profit figure in the workspace, so
-- unlike the other domain tables this one is admin-only to write.
drop policy if exists "Admins write costs" on public.workspace_costs;
create policy "Admins write costs"
  on public.workspace_costs for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop trigger if exists workspace_costs_set_updated_at on public.workspace_costs;
create trigger workspace_costs_set_updated_at
  before update on public.workspace_costs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- refresh_profit_points — recompute every month/profit row for a workspace
--
-- Called by the phase-5 rollup after revenue changes, and by the backfill at
-- the bottom of this file.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_profit_points(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_basis boolean;
begin
  if target_workspace is null then
    return;
  end if;

  select exists (
    select 1 from public.workspace_costs c where c.workspace_id = target_workspace
  ) into has_basis;

  -- No cost basis: remove any profit rows rather than leaving stale ones
  -- behind. This is also what clears the fabricated 42%-margin rows that
  -- 0006 used to write.
  if not has_basis then
    delete from public.metric_points p
      where p.workspace_id = target_workspace
        and p.grain = 'month'
        and p.metric_key = 'profit';
    return;
  end if;

  with months as (
    -- Revenue is stored at month grain; events only at day grain, so the
    -- volume term has to roll the days up itself. Reading month-grain
    -- 'events' would silently find nothing and cost every month as if it had
    -- ingested zero events.
    select
      p.bucket,
      sum(p.value) as revenue,
      coalesce((
        select sum(e.value) from public.metric_points e
        where e.workspace_id = target_workspace
          and e.grain = 'day'
          and e.metric_key = 'events'
          and date_trunc('month', e.bucket) = p.bucket
      ), 0) as events
    from public.metric_points p
    where p.workspace_id = target_workspace
      and p.grain = 'month'
      and p.metric_key = 'revenue'
    group by p.bucket
  ),
  costed as (
    select
      m.bucket,
      coalesce(m.revenue, 0) as revenue,
      coalesce(m.events, 0)  as events,
      -- The basis in force during that month: the latest row starting on or
      -- before it. A month earlier than every cost row has no basis, so
      -- `basis` is null and the row is dropped by the join below rather than
      -- being costed at zero.
      (
        select c.id from public.workspace_costs c
        where c.workspace_id = target_workspace
          and c.effective_from <= (m.bucket at time zone 'UTC')::date
        order by c.effective_from desc
        limit 1
      ) as basis
    from months m
  )
  insert into public.metric_points (workspace_id, bucket, grain, metric_key, dims, value)
  select
    target_workspace,
    x.bucket,
    'month',
    'profit',
    '{}'::jsonb,
    round(
      x.revenue
      - (c.fixed_monthly_cents / 100.0)
      - (x.events / 1000.0) * (c.per_1k_events_cents / 100.0)
      - x.revenue * (c.revenue_share_bps / 10000.0)
    , 2)
  from costed x
  join public.workspace_costs c on c.id = x.basis
  on conflict (workspace_id, grain, metric_key, bucket, dims)
    do update set value = excluded.value, updated_at = now();

  -- Months that fall before the earliest cost row must not keep a profit
  -- value computed under an older basis.
  delete from public.metric_points p
  where p.workspace_id = target_workspace
    and p.grain = 'month'
    and p.metric_key = 'profit'
    and (p.bucket at time zone 'UTC')::date < (
      select min(c.effective_from) from public.workspace_costs c
      where c.workspace_id = target_workspace
    );
end;
$$;

revoke execute on function public.refresh_profit_points(uuid) from public;
revoke execute on function public.refresh_profit_points(uuid) from anon;
-- Members may recompute their own workspace's profit after editing the basis;
-- the membership check below is what makes that safe.
grant execute on function public.refresh_profit_points(uuid) to authenticated;

-- The definer function above is member-callable, so it needs the same guard
-- 0008 added to the seeder. Wrapping rather than inlining keeps the recompute
-- body callable from the rollup, which runs with no JWT.
--
-- Re-running this file recreates the unchecked body under the guarded name
-- (the `create or replace` above), so the rename has to be able to redo
-- itself. Dropping the previous target first makes that safe: plpgsql bodies
-- are not tracked dependencies, so nothing holds a reference to it.
drop function if exists public.refresh_profit_points_unchecked(uuid);

alter function public.refresh_profit_points(uuid)
  rename to refresh_profit_points_unchecked;

revoke execute on function public.refresh_profit_points_unchecked(uuid) from public;
revoke execute on function public.refresh_profit_points_unchecked(uuid) from anon;
revoke execute on function public.refresh_profit_points_unchecked(uuid) from authenticated;

create or replace function public.refresh_profit_points(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_workspace is null then
    return;
  end if;

  -- Same three caller shapes as seed_workspace_demo_data in 0008: an
  -- untrusted PostgREST caller must prove membership; service_role and the
  -- migration role have no JWT and are trusted.
  if auth.uid() is not null then
    if not public.is_workspace_member(target_workspace) then
      raise exception 'Not a member of that workspace' using errcode = 'P0001';
    end if;
  elsif current_user in ('anon', 'authenticated') then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  perform public.refresh_profit_points_unchecked(target_workspace);
end;
$$;

revoke execute on function public.refresh_profit_points(uuid) from public;
revoke execute on function public.refresh_profit_points(uuid) from anon;
grant execute on function public.refresh_profit_points(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill
--
-- Recompute profit everywhere. For workspaces seeded before this migration
-- this deletes the old flat-margin rows and replaces them with costed ones;
-- for workspaces with no basis it just deletes them.
-- ---------------------------------------------------------------------------

do $$
declare
  ws uuid;
begin
  -- Workspaces that already carry month/profit rows are exactly the ones
  -- 0006's old flat-margin block wrote to — i.e. the seeded demo workspaces.
  -- Give them the same basis 0006 now inserts, so a database created before
  -- this migration and one created after end up identical, and so the demo
  -- keeps its second chart line.
  insert into public.workspace_costs (
    workspace_id, effective_from, fixed_monthly_cents,
    per_1k_events_cents, revenue_share_bps, note
  )
  select distinct
    p.workspace_id,
    (date_trunc('month', now()) - interval '11 months')::date,
    4800000, 35, 290,
    'Demo cost basis — replace with your actual costs'
  from public.metric_points p
  where p.grain = 'month' and p.metric_key = 'profit'
  on conflict (workspace_id, effective_from) do nothing;

  for ws in select id from public.workspaces loop
    perform public.refresh_profit_points_unchecked(ws);
  end loop;
end $$;
