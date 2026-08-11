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
-- The practical effect was small — every one of these functions checks
-- `auth.uid()` through `is_workspace_member`, which is null for `anon`, so an
-- unauthenticated call raised "Not a member of that workspace" rather than
-- returning data. But an anonymous caller should not reach the function body
-- at all: that is one guard away from an information leak, and it lets an
-- unauthenticated client burn database time.

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
