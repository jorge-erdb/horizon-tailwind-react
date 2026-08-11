-- Nova Analytics — 0007_function_grants
--
-- Tightens who may execute the RPC functions.
--
-- 0005 and 0006 revoked execute from `public` and granted it to
-- `authenticated`. That is not sufficient on Supabase: the project applies
-- default privileges that grant EXECUTE on new functions in `public` to the
-- `anon` role directly, and revoking from `public` does not remove a grant
-- made to a named role.
--
-- For three of the four the practical effect was small: `pct_change`,
-- `get_dashboard_kpis` and `create_workspace` each check `auth.uid()`, which
-- is null for `anon`, so an unauthenticated call raised rather than returning
-- data. Reaching the function body at all is still wrong — it is one guard
-- away from a leak and lets an unauthenticated client burn database time.
--
-- `seed_workspace_demo_data` was NOT in that position. It had no membership
-- check whatsoever, so the anon grant made it an unauthenticated write into
-- any workspace by UUID. That is fixed properly in 0008_seed_guard.sql; the
-- revoke below is the outer layer, not the fix.

revoke execute on function public.pct_change(numeric, numeric) from anon;
revoke execute on function public.get_dashboard_kpis(uuid, integer) from anon;
revoke execute on function public.create_workspace(text) from anon;
revoke execute on function public.seed_workspace_demo_data(uuid) from anon;

-- Left alone deliberately:
--   public.is_workspace_member(uuid)
--   public.is_workspace_admin(uuid)
--
-- These are evaluated inside RLS policies, so the *querying* role needs
-- execute for a policy to run at all. On hosted Supabase anon has that grant
-- and an anonymous read returns an empty array; revoking it would turn the
-- same read into a permission error instead. Both outcomes disclose nothing —
-- the helper returns false for a null auth.uid() — so this keeps the friendlier
-- one. Revoke here only if anon should be unable to query these tables at all.
