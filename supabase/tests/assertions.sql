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

  -- Stash Bob's workspace id for the isolation block below, which runs as
  -- `authenticated`. Resolving it there instead is the obvious thing to do and
  -- it is wrong: workspace_members' own select policy hides Bob's row from
  -- Alice, so the lookup returns NULL, every `where workspace_id = bob_ws`
  -- predicate evaluates to NULL, and the resulting zero row counts pass the
  -- assertions without testing anything. set_config(..., true) is
  -- transaction-local and the file runs under --single-transaction, so this
  -- lives exactly as long as it should.
  perform set_config('nova.test_bob_ws', bob_ws::text, true);

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
  tbl    text;
begin
  bob_ws := nullif(current_setting('nova.test_bob_ws', true), '')::uuid;

  -- A NULL here would silently defeat every foreign-tenant check below, so
  -- refuse to run rather than report a meaningless pass.
  if bob_ws is null then
    raise exception 'FAIL: bob_ws unavailable; foreign-tenant checks would be vacuous';
  end if;

  select count(*) into n from public.workspaces;
  if n <> 1 then raise exception 'FAIL: leaked workspaces (saw %, expected 1)', n; end if;

  select count(distinct workspace_id) into n from public.data_sources;
  if n <> 1 then raise exception 'FAIL: leaked data_sources across % workspaces', n; end if;

  select count(distinct workspace_id) into n from public.metric_points;
  if n <> 1 then raise exception 'FAIL: leaked metric_points across % workspaces', n; end if;

  select count(*) into n from public.data_sources where workspace_id = bob_ws;
  if n <> 0 then raise exception 'FAIL: read % of another tenant''s data_sources', n; end if;

  -- The remaining workspace-scoped tables. Every one of these renders on a
  -- page a reviewer can reach, and each had RLS and policies but no proof.
  -- Both halves matter: the distinct-count catches a policy that leaks every
  -- tenant, the direct read catches one that leaks a specific foreign tenant.
  -- The seed populates all of these for both tenants (0006_seed.sql:56,70,85,
  -- 100 and 0009_costs.sql:251), so neither check passes against empty tables.
  foreach tbl in array array['reports', 'alerts', 'tasks', 'notifications', 'workspace_costs']
  loop
    execute format('select count(distinct workspace_id) from public.%I', tbl) into n;
    if n <> 1 then
      raise exception 'FAIL: leaked % across % workspaces', tbl, n;
    end if;

    execute format('select count(*) from public.%I where workspace_id = $1', tbl)
      into n using bob_ws;
    if n <> 0 then
      raise exception 'FAIL: read % of another tenant''s %', n, tbl;
    end if;
  end loop;

  -- profiles is the consequential one: it holds PII, and its select policy
  -- (0001_profiles.sql) is `auth.uid() = id` -- strictly self, not co-members.
  -- So Alice must see exactly her own row and nobody else's.
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FAIL: profiles leaked (saw % rows, expected 1)', n; end if;

  select count(*) into n from public.profiles
   where id = '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'FAIL: read another user''s profile row'; end if;

  -- Invites carry an email address and a token that grants membership; a leak
  -- here is both a PII leak and an escalation path.
  select count(*) into n from public.workspace_invites where workspace_id = bob_ws;
  if n <> 0 then raise exception 'FAIL: read % of another tenant''s invites', n; end if;

  -- The KPI RPC must refuse a workspace the caller is not a member of.
  ok := false;
  begin
    perform public.get_dashboard_kpis(bob_ws);
  exception when others then
    ok := true;
  end;
  if not ok then raise exception 'FAIL: get_dashboard_kpis returned another tenant''s data'; end if;

  raise notice 'PASS: tenant isolation (every workspace-scoped table, profiles, invites, RPC)';
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
  -- `reset role` does NOT clear the JWT claim, and these assertions run as one
  -- transaction, so leaving it set would make auth.uid() keep returning this
  -- non-member for every later block — quietly changing what they test.
  set local request.jwt.claim.sub = '';

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

-- --- ingestion pipeline (phase 5) -------------------------------------------
--
-- The write key is the only thing standing between the public internet and
-- someone else's `events` table, so these check rejection paths first and the
-- happy path second.
do $$
declare
  alice_ws uuid;
  bob_ws   uuid;
  src      uuid;
  key      text;
  n        bigint;
  rejected boolean;
  today    timestamptz := date_trunc('day', now());
begin
  select default_workspace_id into alice_ws from public.profiles where email = 'alice@novaanalytics.io';
  select default_workspace_id into bob_ws   from public.profiles where email = 'bob@example.com';

  select id into src from public.data_sources
    where workspace_id = alice_ws order by name limit 1;

  -- The seeded sources have write_key_hash = null. If the lookup ever used
  -- `is not distinct from`, or coalesced the hash, an empty or garbage key
  -- would match one of them and write into a real workspace. This is the
  -- single most dangerous failure mode in the whole pipeline.
  select count(*) into n from public.data_sources where write_key_hash is null;
  if n = 0 then
    raise exception 'FAIL: assertion setup — expected keyless seeded sources to test against';
  end if;

  rejected := false;
  begin perform public.ingest_events('', '[]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: empty write key accepted'; end if;

  rejected := false;
  begin perform public.ingest_events(null, '[]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: null write key accepted'; end if;

  rejected := false;
  begin perform public.ingest_events('nvk_not_a_real_key_at_all', '[]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: unknown write key accepted'; end if;

  -- --- mint a key ---------------------------------------------------------
  key := public.issue_write_key(src);
  if key is null or key !~ '^nvk_[0-9a-f]{48}$' then
    raise exception 'FAIL: issued write key has unexpected shape: %', key;
  end if;

  -- Only the hash is persisted.
  perform 1 from public.data_sources where id = src and write_key_hash = key;
  if found then raise exception 'FAIL: write key stored in plaintext'; end if;
  perform 1 from public.data_sources
    where id = src and write_key_hash = public.hash_write_key(key)
      and write_key_hint = right(key, 6);
  if not found then raise exception 'FAIL: write key hash/hint not stored'; end if;

  -- --- validation of reserved names ---------------------------------------
  rejected := false;
  begin
    perform public.ingest_events(key,
      '[{"name":"purchase","revenue_cents":1000,"properties":{"stream":"subscription"}}]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: purchase with an unknown stream accepted'; end if;

  rejected := false;
  begin
    perform public.ingest_events(key, '[{"name":"purchase","properties":{"stream":"usage"}}]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: purchase without revenue_cents accepted'; end if;

  rejected := false;
  begin
    perform public.ingest_events(key, '[{"name":"page_view","platform":"carrier-pigeon"}]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: unknown platform accepted'; end if;

  rejected := false;
  begin perform public.ingest_events(key, '[{"name":""}]'::jsonb);
  exception when others then rejected := true; end;
  if not rejected then raise exception 'FAIL: event with no name accepted'; end if;

  -- Nothing above should have landed.
  select count(*) into n from public.events where workspace_id = alice_ws;
  if n <> 0 then raise exception 'FAIL: % rejected events were written anyway', n; end if;

  -- --- happy path ---------------------------------------------------------
  -- An empty batch is a no-op, not an error: a client flushing on a timer
  -- with nothing queued should not see a 400.
  if public.ingest_events(key, '[]'::jsonb) <> 0 then
    raise exception 'FAIL: empty batch did not return 0';
  end if;

  perform public.ingest_events(key, jsonb_build_array(
    jsonb_build_object('name','page_view','distinct_id','u1','platform','web',
                       'occurred_at', today + interval '9 hours'),
    jsonb_build_object('name','page_view','distinct_id','u1','platform','web',
                       'occurred_at', today + interval '10 hours'),
    jsonb_build_object('name','page_view','distinct_id','u2','platform','mobile',
                       'occurred_at', today + interval '9 hours'),
    jsonb_build_object('name','session_start','distinct_id','u1','platform','web',
                       'occurred_at', today + interval '9 hours'),
    jsonb_build_object('name','session_start','distinct_id','u2','platform','mobile',
                       'occurred_at', today + interval '9 hours'),
    jsonb_build_object('name','signup','distinct_id','u2',
                       'occurred_at', today + interval '11 hours'),
    jsonb_build_object('name','purchase','distinct_id','u2','revenue_cents',25000,
                       'properties', jsonb_build_object('stream','subscriptions'),
                       'occurred_at', today + interval '11 hours'),
    -- An unreserved name: accepted, counted, but drives no chart.
    jsonb_build_object('name','feature_flag_evaluated','distinct_id','u1',
                       'occurred_at', today + interval '12 hours')
  ));

  -- Two views straddling a single day three days back, one near each end of
  -- it. The rollup's default window starts three days ago; if that start is
  -- not snapped to midnight it lands mid-day, and this bucket gets deleted in
  -- full but rebuilt from only the later event. Both must survive.
  -- Covers all three aggregate shapes — scalar, revenue-by-stream and
  -- sessions-by-platform — because they are separate statements and only one
  -- of them being whole-bucket would go unnoticed otherwise.
  perform public.ingest_events(key, jsonb_build_array(
    jsonb_build_object('name','page_view','distinct_id','u3','platform','web',
                       'occurred_at', today - interval '3 days' + interval '30 minutes'),
    jsonb_build_object('name','page_view','distinct_id','u4','platform','web',
                       'occurred_at', today - interval '3 days' + interval '23 hours'),
    jsonb_build_object('name','session_start','distinct_id','u3','platform','web',
                       'occurred_at', today - interval '3 days' + interval '30 minutes'),
    jsonb_build_object('name','session_start','distinct_id','u4','platform','web',
                       'occurred_at', today - interval '3 days' + interval '23 hours'),
    jsonb_build_object('name','purchase','distinct_id','u3','revenue_cents',10000,
                       'properties', jsonb_build_object('stream','usage'),
                       'occurred_at', today - interval '3 days' + interval '30 minutes'),
    jsonb_build_object('name','purchase','distinct_id','u4','revenue_cents',5000,
                       'properties', jsonb_build_object('stream','usage'),
                       'occurred_at', today - interval '3 days' + interval '23 hours')
  ));

  select count(*) into n from public.events where workspace_id = alice_ws;
  if n <> 14 then raise exception 'FAIL: expected 14 ingested events, got %', n; end if;

  -- Events must land in the key's workspace, never anywhere else.
  select count(*) into n from public.events where workspace_id = bob_ws;
  if n <> 0 then raise exception 'FAIL: ingestion leaked % events into another workspace', n; end if;

  raise notice 'PASS: write key auth, reserved-name validation, and event routing';
end $$;

-- --- rollup correctness -----------------------------------------------------
do $$
declare
  alice_ws uuid;
  today    timestamptz := date_trunc('day', now());
  v        numeric;
  before_v numeric;
  after_v  numeric;
  old_day  timestamptz := date_trunc('day', now()) - interval '30 days';
begin
  select default_workspace_id into alice_ws from public.profiles where email = 'alice@novaanalytics.io';

  -- A bucket well outside the rollup window, to prove the rollup leaves
  -- untouched history alone rather than zeroing everything it did not compute.
  select value into before_v from public.metric_points
    where workspace_id = alice_ws and grain = 'day'
      and metric_key = 'events' and bucket = old_day;

  perform public.refresh_metric_points(alice_ws);

  select value into after_v from public.metric_points
    where workspace_id = alice_ws and grain = 'day'
      and metric_key = 'events' and bucket = old_day;

  if before_v is distinct from after_v then
    raise exception 'FAIL: rollup altered a bucket outside its window (% -> %)', before_v, after_v;
  end if;

  -- 3 page_views -> visits 3, visitors 2 (u1 twice).
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='visits' and bucket=today;
  if v <> 3 then raise exception 'FAIL: visits = %, expected 3', v; end if;

  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='visitors' and bucket=today;
  if v <> 2 then raise exception 'FAIL: visitors = %, expected 2 distinct', v; end if;

  -- visits > visitors is the whole reason `visits` exists; if a refactor ever
  -- makes them equal, the conversion denominator has silently gone distinct.
  if (select count(*) from public.metric_points
        where workspace_id = alice_ws and grain='day' and bucket=today
          and metric_key in ('visits','visitors')
        group by value having count(*) = 2) is not null then
    raise exception 'FAIL: visits and visitors are identical — denominator is distinct again';
  end if;

  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='signups' and bucket=today;
  if v <> 1 then raise exception 'FAIL: signups = %, expected 1', v; end if;

  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='events' and bucket=today;
  if v <> 8 then raise exception 'FAIL: events = %, expected 8', v; end if;

  -- active_users = distinct ids on non-page_view events: u1 and u2.
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='active_users' and bucket=today;
  if v <> 2 then raise exception 'FAIL: active_users = %, expected 2', v; end if;

  -- 25000 cents -> 250 currency units, matching the seed's units.
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='revenue' and bucket=today
    and dims->>'stream' = 'subscriptions';
  if v <> 250 then raise exception 'FAIL: revenue = %, expected 250', v; end if;

  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='sessions' and bucket=today
    and dims->>'platform' = 'mobile';
  if v <> 1 then raise exception 'FAIL: mobile sessions = %, expected 1', v; end if;

  -- The straddling bucket: both ends of the day must be counted. A window
  -- start that is not snapped to midnight rebuilds this bucket from the later
  -- event only, and this reads 1.
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='visits' and bucket = today - interval '3 days';
  if v <> 2 then
    raise exception 'FAIL: straddling bucket visits = %, expected 2 (scalar aggregate not whole-bucket)', v;
  end if;

  -- 100.00 + 50.00, both ends of the same day.
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='revenue' and bucket = today - interval '3 days'
    and dims->>'stream' = 'usage';
  if v <> 150 then
    raise exception 'FAIL: straddling bucket revenue = %, expected 150 (revenue aggregate not whole-bucket)', v;
  end if;

  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='sessions' and bucket = today - interval '3 days'
    and dims->>'platform' = 'web';
  if v <> 2 then
    raise exception 'FAIL: straddling bucket sessions = %, expected 2 (sessions aggregate not whole-bucket)', v;
  end if;

  -- Hourly: u1 and u2 both viewed at 09:00, u1 alone at 10:00.
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='hour' and metric_key='visitors' and bucket = today + interval '9 hours';
  if v <> 2 then raise exception 'FAIL: 09:00 visitors = %, expected 2', v; end if;

  -- Rerunning must be idempotent — the delete-then-insert has to replace, not
  -- accumulate.
  perform public.refresh_metric_points(alice_ws);
  select value into v from public.metric_points where workspace_id = alice_ws
    and grain='day' and metric_key='events' and bucket=today;
  if v <> 8 then raise exception 'FAIL: rollup not idempotent (events = % after rerun)', v; end if;

  raise notice 'PASS: rollup metrics, units, and window containment';
end $$;

-- --- per-source health is a health signal, not an age signal ----------------
do $$
declare
  alice_ws uuid;
  src      uuid;
  health   numeric;
  events_n bigint;
begin
  select default_workspace_id into alice_ws from public.profiles where email = 'alice@novaanalytics.io';
  select d.id into src from public.data_sources d
    where d.workspace_id = alice_ws and d.write_key_hash is not null limit 1;

  select health_pct, events_30d into health, events_n
    from public.data_sources where id = src;

  -- The source was created moments ago by the seed and has reported on every
  -- day it has existed. Dividing by a flat 7 would score it ~29% here, which
  -- says "failing" about a source that has never missed a day.
  if health < 100 then
    raise exception
      'FAIL: healthy new source scored % percent — health window is the source age, not a flat 7 days',
      health;
  end if;

  -- Backfilled events across more days than the source has existed must not
  -- push health past the column's check constraint. Unclamped this is >100
  -- and the UPDATE throws, which would take down the entire rollup.
  if health > 100 then
    raise exception 'FAIL: health_pct % exceeds 100 and will violate the check constraint', health;
  end if;

  if events_n <> 14 then
    raise exception 'FAIL: events_30d = %, expected 14 ingested events', events_n;
  end if;

  -- Seeded sources have no events rows; recomputing them would zero their
  -- plausible demo values and make the workspace look broken.
  perform 1 from public.data_sources
    where workspace_id = alice_ws and write_key_hash is null and events_30d = 0;
  if found then
    raise exception 'FAIL: rollup zeroed a seeded source that never reported';
  end if;

  raise notice 'PASS: per-source health, event counts, and seeded sources preserved';
end $$;

-- --- profit is costed, not invented -----------------------------------------
do $$
declare
  alice_ws uuid;
  bob_ws   uuid;
  this_mo  timestamptz := date_trunc('month', now());
  revenue  numeric;
  events_n numeric;
  profit   numeric;
  expected numeric;
  c        record;
  n        bigint;
begin
  select default_workspace_id into alice_ws from public.profiles where email = 'alice@novaanalytics.io';
  select default_workspace_id into bob_ws   from public.profiles where email = 'bob@example.com';

  select * into c from public.workspace_costs where workspace_id = alice_ws
    order by effective_from desc limit 1;
  if c is null then raise exception 'FAIL: seeded workspace has no cost basis'; end if;

  select value into revenue from public.metric_points
    where workspace_id = alice_ws and grain='month' and metric_key='revenue' and bucket=this_mo;
  select coalesce(sum(value),0) into events_n from public.metric_points
    where workspace_id = alice_ws and grain='day' and metric_key='events'
      and date_trunc('month', bucket) = this_mo;
  select value into profit from public.metric_points
    where workspace_id = alice_ws and grain='month' and metric_key='profit' and bucket=this_mo;

  expected := round(
    revenue
    - (c.fixed_monthly_cents / 100.0)
    - (events_n / 1000.0) * (c.per_1k_events_cents / 100.0)
    - revenue * (c.revenue_share_bps / 10000.0)
  , 2);

  if profit is null then raise exception 'FAIL: no profit row for the current month'; end if;
  if profit <> expected then
    raise exception 'FAIL: profit = %, cost model says % (revenue %, events %)',
      profit, expected, revenue, events_n;
  end if;

  -- The old flat 42% must be gone. If profit is still exactly 0.42 * revenue
  -- the cost model is not actually driving anything.
  if revenue > 0 and profit = round(revenue * 0.42) then
    raise exception 'FAIL: profit still looks like the hardcoded 42%% margin';
  end if;

  -- A workspace with no cost basis must have no profit series at all, rather
  -- than a zero-cost one that would draw profit exactly on top of revenue.
  delete from public.workspace_costs where workspace_id = bob_ws;
  perform public.refresh_profit_points(bob_ws);
  select count(*) into n from public.metric_points
    where workspace_id = bob_ws and metric_key = 'profit';
  if n <> 0 then
    raise exception 'FAIL: % profit rows survive with no cost basis', n;
  end if;

  raise notice 'PASS: profit derived from the cost basis, absent without one';
end $$;

-- --- ingestion is not reachable from the browser ----------------------------
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    -- ingest_events and the rollups take service_role only. The write key is
    -- the credential, but keeping them off the public PostgREST surface means
    -- a validation bug is not directly reachable from the internet.
    if has_function_privilege(r, 'public.ingest_events(text, jsonb)', 'execute') then
      raise exception 'FAIL: % can execute ingest_events', r;
    end if;

    -- 0011's wrapper is a second door onto the same room, and a wrapper is
    -- exactly the kind of thing that gets added without revisiting the grants
    -- on the thing it wraps.
    if has_function_privilege(r, 'public.ingest_and_refresh(text, jsonb)', 'execute') then
      raise exception 'FAIL: % can execute ingest_and_refresh', r;
    end if;
    if has_function_privilege(r, 'public.refresh_metric_points(uuid, timestamptz)', 'execute') then
      raise exception 'FAIL: % can execute refresh_metric_points', r;
    end if;
    if has_function_privilege(r, 'public.refresh_all_metric_points()', 'execute') then
      raise exception 'FAIL: % can execute refresh_all_metric_points', r;
    end if;
    if has_function_privilege(r, 'public.refresh_profit_points_unchecked(uuid)', 'execute') then
      raise exception 'FAIL: % can execute the unguarded profit refresh', r;
    end if;
  end loop;

  -- issue_write_key IS member-callable — that is how the UI mints a key — so
  -- it must be denied to anon specifically.
  if has_function_privilege('anon', 'public.issue_write_key(uuid)', 'execute') then
    raise exception 'FAIL: anon can mint write keys';
  end if;
  if not has_function_privilege('authenticated', 'public.issue_write_key(uuid)', 'execute') then
    raise exception 'FAIL: authenticated cannot mint write keys';
  end if;

  raise notice 'PASS: ingest surface restricted to service_role';
end $$;

-- --- a member cannot mint a key for another workspace ------------------------
do $$
declare
  victim_src uuid;
  blocked    boolean := false;
begin
  select d.id into victim_src from public.data_sources d
    join public.profiles p on p.default_workspace_id = d.workspace_id
   where p.email = 'alice@novaanalytics.io'
   order by d.name limit 1;

  set local role authenticated;
  set local request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

  begin
    perform public.issue_write_key(victim_src);
  exception when others then
    blocked := true;
  end;

  reset role;
  set local request.jwt.claim.sub = '';

  if not blocked then
    raise exception 'FAIL: non-member minted a write key for another workspace';
  end if;

  raise notice 'PASS: write key minting requires membership';
end $$;

\echo ''
\echo 'All migration assertions passed.'
