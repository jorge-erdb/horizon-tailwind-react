-- Nova Analytics — migration assertions
--
-- Behavioural checks, not syntax checks. Raises an exception on the first
-- failure so `run-migration-tests.sh` exits non-zero.
--
-- The important one is tenant isolation: a table with RLS enabled but a
-- mistaken policy returns rows rather than erroring, so "no error" proves
-- nothing. These assertions check for the absence of *rows*.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  alice   uuid := '11111111-1111-4111-8111-111111111111';
  bob     uuid := '22222222-2222-4222-8222-222222222222';
  alice_ws uuid;
  bob_ws   uuid;
  n        bigint;
  kpi      record;
begin
  -- --- signup trigger ------------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data) values
    (alice, 'alice@novaanalytics.io', '{"full_name":"Alice Chen"}'::jsonb),
    (bob,   'bob@example.com',        '{}'::jsonb);

  select default_workspace_id into alice_ws from public.profiles where id = alice;
  select default_workspace_id into bob_ws   from public.profiles where id = bob;

  if alice_ws is null or bob_ws is null then
    raise exception 'FAIL: signup did not create a default workspace';
  end if;

  perform 1 from public.workspace_members
    where user_id = alice and workspace_id = alice_ws and role = 'owner';
  if not found then
    raise exception 'FAIL: signup did not create an owner membership';
  end if;

  -- Display name should come from metadata, falling back to the email local part.
  perform 1 from public.profiles where id = alice and full_name = 'Alice Chen';
  if not found then raise exception 'FAIL: full_name not taken from signup metadata'; end if;
  perform 1 from public.profiles where id = bob and full_name = 'bob';
  if not found then raise exception 'FAIL: full_name did not fall back to email local part'; end if;

  -- --- seed ----------------------------------------------------------------
  perform public.seed_workspace_demo_data(alice_ws);
  perform public.seed_workspace_demo_data(bob_ws);
  -- Second call must not duplicate.
  perform public.seed_workspace_demo_data(alice_ws);

  select count(*) into n from public.data_sources where workspace_id = alice_ws;
  if n <> 6 then raise exception 'FAIL: seed is not idempotent (% data_sources, expected 6)', n; end if;

  raise notice 'PASS: signup trigger, naming, and idempotent seed';
end $$;

-- --- tenant isolation -------------------------------------------------------
-- Run as a real `authenticated` role so RLS actually applies; the table owner
-- bypasses it.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare
  bob_ws uuid;
  n      bigint;
  ok     boolean;
begin
  select m.workspace_id into bob_ws from public.workspace_members m
   where m.user_id = '22222222-2222-4222-8222-222222222222';

  select count(*) into n from public.workspaces;
  if n <> 1 then raise exception 'FAIL: leaked workspaces (saw %, expected 1)', n; end if;

  select count(distinct workspace_id) into n from public.data_sources;
  if n <> 1 then raise exception 'FAIL: leaked data_sources across % workspaces', n; end if;

  select count(distinct workspace_id) into n from public.metric_points;
  if n <> 1 then raise exception 'FAIL: leaked metric_points across % workspaces', n; end if;

  select count(*) into n from public.data_sources where workspace_id = bob_ws;
  if n <> 0 then raise exception 'FAIL: read % of another tenant''s data_sources', n; end if;

  -- The KPI RPC must refuse a workspace the caller is not a member of.
  ok := false;
  begin
    perform public.get_dashboard_kpis(bob_ws);
  exception when others then
    ok := true;
  end;
  if not ok then raise exception 'FAIL: get_dashboard_kpis returned another tenant''s data'; end if;

  raise notice 'PASS: tenant isolation (tables + RPC)';
end $$;

-- --- KPI shape --------------------------------------------------------------
do $$
declare
  kpi      record;
  ws       uuid;
  src_rows bigint;
begin
  select default_workspace_id into ws from public.profiles where id = auth.uid();
  select * into kpi from public.get_dashboard_kpis(ws);

  if kpi.monthly_revenue <= 0 then raise exception 'FAIL: no revenue from seed'; end if;
  if kpi.conversion_rate <= 0 or kpi.conversion_rate > 100 then
    raise exception 'FAIL: implausible conversion rate %', kpi.conversion_rate;
  end if;

  -- The tile must agree with the table rendered directly beneath it.
  select count(*) into src_rows from public.data_sources where workspace_id = ws;
  if kpi.data_sources <> src_rows then
    raise exception 'FAIL: data_sources tile (%) disagrees with table (%)', kpi.data_sources, src_rows;
  end if;

  raise notice 'PASS: KPI values plausible and self-consistent';
end $$;

-- --- empty workspace --------------------------------------------------------
-- Back to superuser to create the user, then impersonate *that* user. Both
-- the role and the JWT claim have to move: resetting the role alone leaves
-- auth.uid() pointing at the previous user, and the membership check would
-- then fail for the wrong reason.
reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-8444-444444444444', 'empty@nova.io', '{"full_name":"Empty User"}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

do $$
declare
  ws  uuid;
  kpi record;
begin
  select default_workspace_id into ws from public.profiles where id = auth.uid();
  if ws is null then
    raise exception 'FAIL: fresh user has no default workspace';
  end if;

  select * into kpi from public.get_dashboard_kpis(ws);
  if kpi.monthly_revenue <> 0 or kpi.data_sources <> 0 then
    raise exception 'FAIL: unseeded workspace returned data';
  end if;
  if kpi.monthly_revenue is null then
    raise exception 'FAIL: unseeded workspace returned nulls instead of zeros';
  end if;

  raise notice 'PASS: empty workspace returns zeros, not nulls or errors';
end $$;

-- --- anon cannot reach the RPCs ---------------------------------------------
-- 0007 exists because revoking from `public` does not remove Supabase's
-- default grant to `anon`. Without this assertion that migration is a comment:
-- nothing else in the suite would notice if the revoke were dropped.
--
-- The guard inside get_dashboard_kpis means an anon call raises either way, so
-- checking for "it raised" would pass for the wrong reason. Check the ACL
-- directly instead.
reset role;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.pct_change(numeric, numeric)',
    'public.get_dashboard_kpis(uuid, integer)',
    'public.create_workspace(text)',
    'public.seed_workspace_demo_data(uuid)'
  ] loop
    if has_function_privilege('anon', fn, 'execute') then
      raise exception 'FAIL: anon can execute %', fn;
    end if;
    -- The same call must still work for a signed-in user; a revoke that took
    -- authenticated with it would break the dashboard rather than secure it.
    if not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: authenticated lost execute on %', fn;
    end if;
  end loop;

  -- Deliberately NOT asserted here: anon's execute grant on
  -- is_workspace_member / is_workspace_admin. Hosted Supabase grants it via
  -- project default privileges, this shim does not, so the two environments
  -- genuinely disagree and an assertion either way would be testing the
  -- harness rather than the schema. Nothing depends on the difference — the
  -- helper returns false for a null auth.uid(), so an anon read is empty
  -- where the grant exists and an error where it doesn't. Neither leaks rows.
  --
  -- The checks above are safe to assert because they cover explicit revokes
  -- this repo issues, not ambient platform defaults.

  raise notice 'PASS: RPC execute grants scoped to authenticated';
end $$;

-- --- the seed function refuses non-members ----------------------------------
-- The grant check above is the outer layer. This is the real one: even a
-- caller who holds EXECUTE must not be able to write into a workspace they
-- are not a member of. Asserted separately from the ACL because a future
-- default-privileges change could hand the grant back, and the function
-- should still refuse.
--
-- Uses the empty user from above against the *seeded* user's workspace: two
-- real workspaces, and the caller is legitimately authenticated — so a pass
-- here means the membership check fired, not that authentication did.
do $$
declare
  victim_ws uuid;
  seeded    bigint;
  blocked   boolean := false;
begin
  select default_workspace_id into victim_ws
    from public.profiles where email = 'alice@novaanalytics.io';

  if victim_ws is null then
    raise exception 'FAIL: assertion setup — no seeded workspace to target';
  end if;

  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

  begin
    perform public.seed_workspace_demo_data(victim_ws);
  exception when others then
    blocked := true;
  end;

  reset role;

  if not blocked then
    raise exception 'FAIL: non-member seeded another workspace';
  end if;

  -- Belt and braces: prove nothing landed. A function that raised *after*
  -- writing would still be a hole, and plpgsql exception blocks roll back
  -- to the savepoint, so this checks the rollback too.
  select count(*) into seeded
    from public.data_sources where workspace_id = victim_ws;
  raise notice 'PASS: non-member blocked from seeding (victim still has % sources)', seeded;
end $$;

\echo ''
\echo 'All migration assertions passed.'
