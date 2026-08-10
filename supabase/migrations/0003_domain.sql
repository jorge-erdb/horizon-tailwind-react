-- Nova Analytics — 0003_domain
--
-- The entities behind the dashboard's tables and lists. Every table is scoped
-- to a workspace and gated by the membership helpers from 0002.
--
-- Which UI each table feeds:
--   data_sources  -> "Data sources" CheckTable, DevelopmentTable (SDK
--                    coverage), ColumnsTable (ingestion volume), and the
--                    "Data Sources" KPI
--   reports       -> "Scheduled reports" ComplexTable
--   alerts        -> "Active Alerts" KPI
--   tasks         -> TaskCard
--   notifications -> the navbar bell dropdown

-- ---------------------------------------------------------------------------
-- Shared RLS shape
--
-- Read for any member; writes for any member too — role enforcement beyond
-- membership is not modelled yet (the `role` column is descriptive). Tighten
-- to is_workspace_admin here when that changes.
-- ---------------------------------------------------------------------------

-- data_sources ---------------------------------------------------------------

create table if not exists public.data_sources (
  id             uuid        primary key default gen_random_uuid(),
  workspace_id   uuid        not null references public.workspaces (id) on delete cascade,
  name           text        not null,
  kind           text        not null default 'web'
                   check (kind in ('web', 'mobile', 'api', 'billing', 'email', 'warehouse', 'ads', 'support')),
  status         text        not null default 'active'
                   check (status in ('active', 'paused', 'error')),
  -- Which platforms the source reports from; drives the DevelopmentTable icons.
  platforms      text[]      not null default '{}',
  -- Rolling 30-day event count, refreshed by the rollup in phase 5. Stored
  -- rather than computed so the table view is a single cheap select.
  events_30d     bigint      not null default 0,
  health_pct     numeric(5,2) not null default 100 check (health_pct between 0 and 100),
  last_sync_at   timestamptz,
  -- Phase 5: per-source write key. Only the hash is ever stored; the plaintext
  -- key is shown once at creation and never again.
  write_key_hash text,
  write_key_hint text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists data_sources_workspace_idx
  on public.data_sources (workspace_id, created_at desc);

alter table public.data_sources enable row level security;

drop policy if exists "Members read data sources" on public.data_sources;
create policy "Members read data sources"
  on public.data_sources for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write data sources" on public.data_sources;
create policy "Members write data sources"
  on public.data_sources for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop trigger if exists data_sources_set_updated_at on public.data_sources;
create trigger data_sources_set_updated_at
  before update on public.data_sources
  for each row execute function public.set_updated_at();

-- reports --------------------------------------------------------------------

create table if not exists public.reports (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  name          text        not null,
  status        text        not null default 'approved'
                  check (status in ('approved', 'disabled', 'error')),
  -- Cron expression; null means the report is manual-run only.
  schedule      text,
  completion    numeric(5,2) not null default 0 check (completion between 0 and 100),
  last_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists reports_workspace_idx
  on public.reports (workspace_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Members read reports" on public.reports;
create policy "Members read reports"
  on public.reports for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write reports" on public.reports;
create policy "Members write reports"
  on public.reports for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- alerts ---------------------------------------------------------------------

create table if not exists public.alerts (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  name          text        not null,
  metric_key    text        not null,
  comparator    text        not null default 'above'
                  check (comparator in ('above', 'below', 'changes_by')),
  threshold     numeric     not null,
  is_active     boolean     not null default true,
  triggered_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists alerts_workspace_active_idx
  on public.alerts (workspace_id, is_active);

alter table public.alerts enable row level security;

drop policy if exists "Members read alerts" on public.alerts;
create policy "Members read alerts"
  on public.alerts for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write alerts" on public.alerts;
create policy "Members write alerts"
  on public.alerts for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();

-- tasks ----------------------------------------------------------------------

create table if not exists public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  title         text        not null,
  is_done       boolean     not null default false,
  position      integer     not null default 0,
  assignee_id   uuid        references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists tasks_workspace_position_idx
  on public.tasks (workspace_id, position);

alter table public.tasks enable row level security;

drop policy if exists "Members read tasks" on public.tasks;
create policy "Members read tasks"
  on public.tasks for select
  using (public.is_workspace_member(workspace_id));

drop policy if exists "Members write tasks" on public.tasks;
create policy "Members write tasks"
  on public.tasks for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- notifications --------------------------------------------------------------

create table if not exists public.notifications (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  -- null = workspace-wide; set = addressed to one member.
  user_id       uuid        references auth.users (id) on delete cascade,
  title         text        not null,
  body          text,
  kind          text        not null default 'info'
                  check (kind in ('info', 'success', 'warning', 'danger')),
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_workspace_created_idx
  on public.notifications (workspace_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Members read their notifications" on public.notifications;
create policy "Members read their notifications"
  on public.notifications for select
  using (
    public.is_workspace_member(workspace_id)
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists "Members update their notifications" on public.notifications;
create policy "Members update their notifications"
  on public.notifications for update
  using (
    public.is_workspace_member(workspace_id)
    and (user_id is null or user_id = (select auth.uid()))
  )
  with check (
    public.is_workspace_member(workspace_id)
    and (user_id is null or user_id = (select auth.uid()))
  );
