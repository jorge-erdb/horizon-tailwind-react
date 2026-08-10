-- Nova Analytics — 0002_workspaces
--
-- Multi-tenancy. Every domain table from 0003 onward hangs off workspace_id,
-- and every RLS policy in the schema routes through the membership helpers
-- defined here.
--
-- Run after 0001_profiles.sql.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workspaces (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  slug            text        not null unique,
  plan            text        not null default 'trial'
                    check (plan in ('trial', 'starter', 'scale', 'enterprise')),
  data_residency  text        not null default 'us'
                    check (data_residency in ('us', 'eu')),
  trial_ends_at   timestamptz not null default now() + interval '14 days',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.workspaces is
  'A tenant. All product data is scoped to one of these.';

create table if not exists public.workspace_members (
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  role          text        not null default 'member'
                  check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members (user_id);

create table if not exists public.workspace_invites (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  email         text        not null,
  role          text        not null default 'member'
                  check (role in ('owner', 'admin', 'member', 'viewer')),
  token         uuid        not null default gen_random_uuid(),
  invited_by    uuid        references auth.users (id) on delete set null,
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, email)
);

-- Link a profile to the workspace the app should open by default.
alter table public.profiles
  add column if not exists default_workspace_id uuid
    references public.workspaces (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Membership helpers
--
-- These MUST be SECURITY DEFINER and MUST be what every policy calls.
--
-- A policy on workspace_members that itself selects from workspace_members
-- re-enters that same policy and Postgres raises
-- "infinite recursion detected in policy for relation". Routing through a
-- definer function bypasses RLS for the lookup and breaks the cycle. This is
-- the single most common way to get multi-tenant RLS wrong.
--
-- search_path is pinned empty with fully-qualified names, matching the
-- hardening used by handle_new_user in 0001.
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = target_workspace
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

-- workspaces
drop policy if exists "Members can view their workspace" on public.workspaces;
create policy "Members can view their workspace"
  on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists "Admins can update their workspace" on public.workspaces;
create policy "Admins can update their workspace"
  on public.workspaces for update
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

-- Workspace creation goes through create_workspace() below, which is
-- SECURITY DEFINER — it has to insert the workspace and the owner membership
-- together, and neither insert can satisfy a policy until the other exists.

-- workspace_members
drop policy if exists "Members can view co-members" on public.workspace_members;
create policy "Members can view co-members"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can manage members" on public.workspace_members;
create policy "Admins can manage members"
  on public.workspace_members for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

drop policy if exists "Members can leave a workspace" on public.workspace_members;
create policy "Members can leave a workspace"
  on public.workspace_members for delete
  using (user_id = (select auth.uid()));

-- workspace_invites
drop policy if exists "Members can view invites" on public.workspace_invites;
create policy "Members can view invites"
  on public.workspace_invites for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Admins can manage invites" on public.workspace_invites;
create policy "Admins can manage invites"
  on public.workspace_invites for all
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Workspace creation
--
-- Creating a workspace is inherently a two-statement operation (the row, then
-- the owner membership) and neither half can pass RLS on its own, so it is
-- exposed as a definer function instead of direct inserts.
-- ---------------------------------------------------------------------------

create or replace function public.slugify(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from
    regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g')
  );
$$;

create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller       uuid := (select auth.uid());
  base_slug    text;
  final_slug   text;
  suffix       integer := 0;
  new_workspace public.workspaces;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  base_slug := nullif(public.slugify(workspace_name), '');
  if base_slug is null then
    base_slug := 'workspace';
  end if;

  -- Slug is unique across all tenants, so retry with a numeric suffix.
  final_slug := base_slug;
  while exists (select 1 from public.workspaces w where w.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug)
  values (coalesce(nullif(trim(workspace_name), ''), 'My Workspace'), final_slug)
  returning * into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, caller, 'owner');

  return new_workspace;
end;
$$;

revoke execute on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Give every new signup a workspace
--
-- Replaces the 0001 version of handle_new_user: same profile insert, plus a
-- personal workspace, an owner membership, and default_workspace_id.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
  base_slug    text;
  final_slug   text;
  suffix       integer := 0;
  new_workspace_id uuid;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, display_name)
  on conflict (id) do nothing;

  base_slug := coalesce(
    nullif(public.slugify(display_name), ''),
    'workspace'
  );
  final_slug := base_slug;
  while exists (select 1 from public.workspaces w where w.slug = final_slug) loop
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix::text;
  end loop;

  insert into public.workspaces (name, slug)
  values (display_name || '''s Workspace', final_slug)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  update public.profiles
     set default_workspace_id = new_workspace_id
   where id = new.id
     and default_workspace_id is null;

  return new;
end;
$$;

-- Trigger itself is unchanged from 0001; recreated so a fresh database that
-- runs these in order ends up in the same state as an upgraded one.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: anyone who signed up under 0001 has a profile but no workspace.
-- ---------------------------------------------------------------------------

do $$
declare
  orphan record;
  base_slug  text;
  final_slug text;
  suffix     integer;
  new_id     uuid;
begin
  for orphan in
    select p.id, coalesce(p.full_name, split_part(p.email, '@', 1)) as display_name
    from public.profiles p
    where not exists (
      select 1 from public.workspace_members m where m.user_id = p.id
    )
  loop
    base_slug := coalesce(nullif(public.slugify(orphan.display_name), ''), 'workspace');
    final_slug := base_slug;
    suffix := 0;
    while exists (select 1 from public.workspaces w where w.slug = final_slug) loop
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix::text;
    end loop;

    insert into public.workspaces (name, slug)
    values (orphan.display_name || '''s Workspace', final_slug)
    returning id into new_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (new_id, orphan.id, 'owner');

    update public.profiles
       set default_workspace_id = new_id
     where id = orphan.id
       and default_workspace_id is null;
  end loop;
end;
$$;
