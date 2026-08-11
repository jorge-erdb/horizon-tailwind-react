-- Nova Analytics — 0008_seed_guard
--
-- Adds the membership guard that seed_workspace_demo_data never had.
--
-- The hole: the function is SECURITY DEFINER and its only precondition was
-- `target_workspace is null`. Supabase's default privileges had also granted
-- EXECUTE to `anon`. Together that meant an unauthenticated caller holding
-- only the publishable key could write ~950 rows into ANY workspace whose
-- UUID they knew:
--
--   curl -X POST "$URL/rest/v1/rpc/seed_workspace_demo_data" \
--     -H "apikey: $PUBLISHABLE_KEY" -H 'Content-Type: application/json' \
--     -d '{"target_workspace":"<uuid>"}'
--   → 204 No Content, and the rows land.
--
-- This was confirmed against the live project, not inferred. It is an
-- integrity bug rather than a disclosure one — RLS still stops the caller
-- reading anything back — but it lets an anonymous party pollute a tenant's
-- dashboard and burn database time on repeat.
--
-- 0007 revokes the anon grant, which shuts the door. This closes the second
-- one: the function should refuse a non-member regardless of who holds
-- EXECUTE, because a future default-privileges change or a hand-run GRANT
-- should not be able to reopen it.
--
-- The body is renamed rather than copied. Restating ~160 lines of seed logic
-- here would leave two versions to drift apart; this keeps 0006 the single
-- source of truth for what the demo data *is*, and makes this file purely
-- about who may ask for it.

-- Re-running the whole migration set puts 0006's unguarded body back under
-- the original name, so this has to be able to redo the rename. Dropping the
-- previous `_unchecked` first makes that safe: plpgsql bodies are not tracked
-- dependencies, so nothing holds a reference to it.
drop function if exists public.seed_workspace_demo_data_unchecked(uuid);

alter function public.seed_workspace_demo_data(uuid)
  rename to seed_workspace_demo_data_unchecked;

-- Not reachable through PostgREST by any client role. The wrapper below is
-- the only supported entry point; this exists so the guard can live in front
-- of the body without restating it.
revoke execute on function public.seed_workspace_demo_data_unchecked(uuid) from public;
revoke execute on function public.seed_workspace_demo_data_unchecked(uuid) from anon;
revoke execute on function public.seed_workspace_demo_data_unchecked(uuid) from authenticated;

create or replace function public.seed_workspace_demo_data(target_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_workspace is null then
    return;
  end if;

  -- Callers arrive three ways and only the first is untrusted:
  --   * through PostgREST as anon/authenticated — must prove membership;
  --   * as service_role from a trusted backend — allowed, no JWT to check;
  --   * as the migration role running the backfill at the bottom of 0006,
  --     where auth.uid() is null by definition.
  if auth.uid() is not null then
    if not public.is_workspace_member(target_workspace) then
      raise exception 'Not a member of that workspace' using errcode = 'P0001';
    end if;
  elsif current_user in ('anon', 'authenticated') then
    raise exception 'Not authenticated' using errcode = 'P0001';
  end if;

  perform public.seed_workspace_demo_data_unchecked(target_workspace);
end;
$$;

revoke execute on function public.seed_workspace_demo_data(uuid) from public;
revoke execute on function public.seed_workspace_demo_data(uuid) from anon;
grant execute on function public.seed_workspace_demo_data(uuid) to authenticated;
