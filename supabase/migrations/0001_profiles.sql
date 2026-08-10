-- Nova Analytics — 0001_profiles
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query),
-- or via `supabase db push` if you wire up the CLI.
--
-- Creates the per-user profile record the app reads, with row level security
-- so a user can only ever see and edit their own row, and a trigger that
-- creates the row automatically when someone signs up.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text        not null default 'member',
  team        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each auth user. One row per auth.users row.';

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- RLS is what actually protects this data — the publishable/anon key shipped
-- in the browser bundle is public by design. Without these policies enabled,
-- anyone with the key could read every row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create a profile automatically on signup
--
-- SECURITY DEFINER so the trigger can write to public.profiles while running
-- in the auth schema's context. search_path is pinned to empty and every
-- object referenced with its full name, which is the pattern Supabase
-- recommends to keep a definer function from being hijacked via search_path.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Backfill: give any user who signed up before this migration a profile.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;
