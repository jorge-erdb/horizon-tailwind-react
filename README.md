# Nova Analytics

The Nova Analytics web app: a marketing landing page, email/password
authentication, and a whitelabeled analytics dashboard.

```
/                    Landing page (public)
/auth/sign-in        Sign in
/auth/sign-up        Create account
/admin/*             Dashboard — requires an authenticated session
```

---

## Setup

Requires **Node.js 18+** (LTS recommended) and npm.

```bash
git clone <this-repo>
cd nova-analytics-dashboard
npm install
cp .env.example .env.local     # then fill in the values — see below
npm start                      # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev` (or `npm start`) | Vite dev server on port 3000 |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the production build locally on port 3000 |
| `npm run pretty` | Prettier over `src/**/*.{js,jsx,json}` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |

The SQL layer has its own suite — `./supabase/tests/run-migration-tests.sh`,
which needs Docker and never touches your Supabase project. See Testing.

### Environment variables

**You need to supply these — they are not in the repo and nothing is
hardcoded.** Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it | Required |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API → Project URL | Yes, for auth |
| `VITE_SUPABASE_ANON_KEY` | Same page → Project API keys → `anon` `public` | Yes, for auth |

Notes:

- Vite only exposes variables prefixed with `VITE_`, and it **inlines them at
  build time**. Restart the dev server after editing
  `.env.local`; changing them requires a rebuild, not just a redeploy.
- The anon key is designed to be public and shipped in a browser bundle. It
  is not a secret. What actually protects your data is **Row Level Security**
  on every table — enable it before storing anything real.
- Never put the `service_role` key in this file or anywhere in the frontend.
- `.env.local` is gitignored. `.env.example` is committed and contains
  placeholders only.

### Supabase project setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email**: enable it. Email/password is all
   this app uses; no OAuth provider is wired up.
3. **Authentication → URL Configuration → Site URL**: `http://localhost:3000`
   for local development; your real origin before deploying.
4. **Authentication → URL Configuration → Redirect URLs**: add
   `http://localhost:3000/**` (and `https://your-domain/**` for production).
   **This is required.** Every emailed link redirects to `/auth/callback`, and
   Supabase silently falls back to the Site URL if that path is not
   allow-listed — the link then appears to do nothing.
5. **Authentication → Email → Confirm email**: your call. Both are handled.
   - **On** (Supabase default): sign-up shows a "check your inbox" message
     with a resend option; the emailed link lands on `/auth/callback`, which
     establishes the session and forwards into the dashboard.
   - **Off**: sign-up returns a session immediately and goes straight to the
     dashboard.
6. **Run the database migrations**: paste each file in
   `supabase/migrations/` into the SQL Editor **in numeric order** and run it.
   They are idempotent, so re-running is safe.

   | Migration | What it adds |
   | --- | --- |
   | `0001_profiles` | `profiles`, RLS, profile-on-signup trigger |
   | `0002_workspaces` | `workspaces`, `workspace_members`, `workspace_invites`, membership helpers, workspace-on-signup |
   | `0003_domain` | `data_sources`, `reports`, `alerts`, `tasks`, `notifications` |
   | `0004_metrics` | `events` (phase 5) and `metric_points` + `get_metric_series` |
   | `0005_rpc` | `get_dashboard_kpis` |
   | `0006_seed` | `seed_workspace_demo_data`, then seeds existing workspaces |
   | `0007_function_grants` | Revokes `anon` EXECUTE left by Supabase's defaults |
   | `0008_seed_guard` | Requires workspace membership to run the seeder |
   | `0009_costs` | `workspace_costs`; profit becomes computed, not invented |
   | `0010_ingest` | Write keys, `ingest_events`, `refresh_metric_points`, pg_cron |

   Verify them locally first with `./supabase/tests/run-migration-tests.sh`
   (see Testing below).
7. Supabase's built-in SMTP is heavily rate-limited (a few messages per hour)
   and intended only for testing. Configure your own SMTP before any real
   signup volume.

If the two env vars are missing the app still builds and runs — the landing
page works, and the auth screens render with an explanatory banner and
disabled submit buttons rather than crashing.

---

## Event ingestion

Every number on the dashboard is read from `metric_points`. Those rows come
either from the demo seed or from real events rolled up on a schedule — the
UI cannot tell the difference, which is what lets a workspace carry seeded
history and live data at the same time.

### Setting it up

1. **Database → Extensions**: enable `pg_cron`, then re-run
   `0010_ingest.sql`. The schedule block is guarded, so without the extension
   everything still works — the rollup just never runs on its own.
2. **Deploy the function**:
   ```bash
   supabase functions deploy ingest --no-verify-jwt
   ```
   `--no-verify-jwt` is required and is not a weakening. The gateway checks
   for a Supabase JWT *before* your code runs, and ingest callers authenticate
   with a write key, which is not a JWT — leave it on and every legitimate
   request is rejected with a 401 you will never see in the logs.
   `supabase/config.toml` sets this for CLI deploys.
3. **Create a source**: Data Tables → Connect a source. The write key is shown
   **once**. Only a SHA-256 hash and a six-character hint are stored, so a
   lost key must be rotated, not recovered.

### Sending events

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/ingest \
  -H "Authorization: Bearer nvk_..." \
  -H "Content-Type: application/json" \
  -d '{"events":[{"name":"page_view","distinct_id":"u_123","platform":"web"}]}'
```

Up to 500 events per request. `202` with `{"accepted":N}` on success, `401`
for a bad key, `400` for a malformed event.

### The event contract

Any event name is accepted and counted, but four names drive charts and are
validated strictly — a typo'd `purchase` is not a missing bar, it is a wrong
one, and wrong is worse than absent.

| Name | Required | Feeds |
| --- | --- | --- |
| `page_view` | `distinct_id` | `visits`, `visitors` (hourly + daily) |
| `session_start` | `distinct_id` | `sessions`, split by `platform` |
| `signup` | — | `signups` (conversion numerator) |
| `purchase` | `revenue_cents`, `properties.stream` | `revenue`, split by stream |
| *anything else* | `name` | `events`, `active_users` |

`platform` must be one of `web`, `mobile`, `api`, `server`. `stream` must be
one of `subscriptions`, `usage`, `services`. `occurred_at` defaults to now,
so backfilling history means setting it explicitly.

### visits vs visitors

`visitors` is a distinct count and therefore **not additive** — summing seven
days of it counts a returning visitor once per day. `visits` is a raw
`page_view` count and is additive, which is why the conversion rate uses it
as its denominator. Anything summing metrics across buckets must use
`visits`, `events`, `signups` or `revenue`; `visitors` and `active_users` are
only meaningful at the grain they were computed at.

### Profit and the cost model

`profit` is derived from `workspace_costs`, not from a margin assumption:

```
profit = revenue
       - fixed_monthly_cents
       - per_1k_events_cents × (events / 1000)
       - revenue × revenue_share_bps / 10000
```

Rows are effective-dated, so each month is costed at the basis in force
during that month rather than restating history whenever a bill changes.

**A workspace with no cost row gets no profit series at all**, and the chart
drops to a single revenue line. That is deliberate: "we have not said what
things cost" must not render as "we have no costs", which is exactly what a
zero-cost default would draw. The demo seed inserts a clearly-labelled basis
so the seeded workspace still shows two lines.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 | Already the base of the template this product is derived from; no reason to churn it. |
| Build | Vite 8 | Migrated off the inherited Create React App, which is deprecated and carried transitive CVEs. Build went from ~40s to ~0.6s, and route-level code splitting became straightforward. |
| Routing | React Router 6 | Inherited; `ProtectedRoute` composes cleanly with its element API. |
| Styling | Tailwind CSS 3 | Inherited, and the brand kit maps onto a token-based utility system almost directly. |
| Charts | ApexCharts via `react-apexcharts` | Inherited. Colors now come from the brand kit's `dataviz-categorical` palette. |
| Auth | Supabase Auth (`@supabase/supabase-js` v2) | Requested. Hosted email/password with session persistence and refresh handled for us — no backend to run. |
| Server state | `@tanstack/react-query` | Every dashboard number is remote state with caching, staleness and refetch concerns. `@tanstack/react-table` was already a dependency, so this is the same family. |
| Tests | Vitest | Reuses `vite.config.mjs`, so the `src`-rooted import aliases work in tests without a second resolver config. |
| Icons | `react-icons` | Inherited. |

### Where things live

```
nova_analytics_id/        Brand kit — logos, color/type tokens, guidelines
src/
  assets/img/layout/nova/ Nova logo SVGs + favicon source
  components/
    auth/ProtectedRoute   Session gate for /admin/*
    brand/NovaLogo        Inline-SVG logo (mark | horizontal | stacked)
    common/QueryState     Shared loading / empty / error states for data cards
  contexts/AuthContext    Session + profile state, all auth actions
  contexts/WorkspaceContext  Resolves the active workspace and its memberships
  lib/supabase.js         Supabase client, reads env vars
  lib/queryClient.js      react-query defaults (retry policy, staleness)
  lib/format.js           Number/date display, shared so two cards agree
  lib/tableRows.js        DB rows -> the shapes the Horizon tables expect
  lib/queries/            One module per entity; every query is workspace-scoped
    base.js               Shared hooks: enable-when-ready, error unwrapping
    shape.js              Pure metric_points -> chart-series transforms
  variables/charts.js     Chart *presentation* only — series come from queries
  views/
    landing/              Marketing page and its sections
    auth/                 SignIn, SignUp, AuthCallback, ResetPassword
    admin/                Dashboard, data tables, profile
  routes/                 adminRoutes (sidebar nav) + authRoutes
supabase/migrations/      SQL to run in the Supabase SQL Editor, in order
supabase/functions/ingest Edge Function: the public event ingest endpoint
supabase/tests/           Dockerised migration test harness
tailwind.config.js        Nova design tokens
vercel.json               SPA rewrite, caching, security headers
```

### Design tokens

`tailwind.config.js` is the single source of truth for color. It reads from
the brand kit anchors and exposes:

- `primary-*` (indigo, `500` = `#4F46E5`), also aliased as `brand-*`
- `accent-*` (spark cyan, `500` = `#22D3EE`)
- `neutral-*` (Nova gray ramp), also aliased as `gray-*`
- `amber-*` (secondary accent), `success` / `warning` / `danger` / `info`
- `navy-*` — the dark-mode surface ramp, running ink → indigo-darker

Fonts: `font-display` (Space Grotesk), `font-sans` (Inter, the default), and
`font-mono` (JetBrains Mono, used for metrics, tables and code). Loaded from
Google Fonts in `src/index.css`, which also re-exports every token as a CSS
custom property (`--nova-indigo`, `--nova-font-body`, …).

The brand kit specifies anchor values, not full ramps. Intermediate steps
(`primary` 50–400, `neutral` 200/400/600/800, `accent` 600–900) are
interpolated in `tailwind.config.js` and marked as such in comments.

---

## Testing

```bash
npm test                                   # Vitest — unit tests
./supabase/tests/run-migration-tests.sh    # requires Docker — schema + RLS
```

### Unit tests

`src/lib/queries/__tests__/` covers `shape.js`, the pure transforms that turn
`metric_points` rows into chart series. That is the only real logic in the
data layer — everything else is a `select` — and its failure mode is silent: a
chart that renders happily with points attached to the wrong day.

The fixture is real output from `0006_seed.sql`, captured from the same
throwaway Postgres the migration tests use. It is there because PostgREST
returns metric rows *interleaved*, not grouped by series, and hand-written
rows would have missed that.

One caveat worth knowing: the seeded data is complete — every series has a
value in every bucket — so the fixture tests cannot detect a misalignment bug
on their own. Replacing the bucket-indexed fill with a naive per-series
`push()` fails exactly one test, the synthetic gap case. That test is doing
the load-bearing work; the fixture tests guard shape and ordering.

**The suite runs in `America/Monterrey`, pinned in `vite.config.mjs`, and that
is load-bearing.** Metric buckets are UTC boundaries from `date_trunc`, so
formatting them in local time slides every label one bucket backwards — a
May–Aug chart labelled Apr–Jul. In UTC the correct and incorrect
implementations agree, so a CI box on UTC would go on passing while the
dashboard misreported which day a number belonged to. Timestamps in the tests
carry an explicit `Z` for the same reason: a bare `"2026-08-01T00:00:00"`
parses as local and quietly reintroduces the frame the code is meant to be
free of.

### Migration tests

Spins up a throwaway Postgres, installs a minimal Supabase shim (the `auth`
schema, `auth.uid()`, the `anon`/`authenticated` roles), applies every
migration **twice** to prove idempotency, then asserts behaviour:

- signup creates a profile, a workspace and an owner membership, with the
  display name taken from metadata and falling back to the email local part
- slug collisions between identically-named workspaces resolve
- the demo seed does not duplicate rows when re-run
- **tenant isolation** — a second user's rows are invisible across every
  table, and `get_dashboard_kpis` refuses a workspace the caller is not a
  member of
- the KPI tile values are plausible and agree with the table beneath them
- an unseeded workspace returns zeros rather than nulls or an error
- RPC execute grants are scoped to `authenticated`, not `anon` (see
  `0007_function_grants.sql`)
- **write keys** — an empty, null or unknown key is rejected, and in
  particular a key can never match one of the six seeded sources that have
  no key at all. That last case is the most dangerous failure in the
  pipeline: a null-tolerant comparison would turn "no key issued" into
  "accepts any key" and hand the public internet a write into a real
  workspace
- reserved-name validation rejects an unknown revenue stream, a `purchase`
  with no `revenue_cents`, and an unknown platform — and nothing from a
  rejected batch is written
- the rollup's arithmetic, units (cents in, currency out), idempotency on
  re-run, and **window containment**: buckets outside the window are left
  untouched, and a bucket straddling the window boundary is rebuilt from the
  whole day rather than the slice after the cutoff
- `profit` matches the cost model exactly, and disappears entirely when the
  cost basis is removed
- `ingest_events` and the rollups are executable by `service_role` only, so a
  validation bug is not directly reachable from the browser

`supabase/functions/ingest/__tests__/` covers the only logic the Edge
Function owns — header parsing and SQLSTATE-to-HTTP mapping. The rest is
delegated to `ingest_events()` on purpose: two implementations of "is this
key valid" would drift, and the one that drifts is the one on the public
internet.

Isolation is the reason this exists. A mistaken RLS policy does not raise an
error — it silently returns rows, so "the migration ran fine" proves nothing.
The suite is checked against a deliberately broken policy (`using (true)`) to
confirm it actually fails when isolation breaks, rather than passing
vacuously.

Nothing here touches your Supabase project.

---

## Known limitations and shortcuts

Things worth knowing before this goes in front of anyone:

**Auth**

- Email/password only. No OAuth, no magic links, no MFA. The
  non-functional "Sign in with Google" button from the template was removed
  rather than left as decoration.
- Password reset is complete: request → email → `/auth/callback` →
  `/auth/reset-password` → signed in with the new password.
- `public.profiles` stores name, role and team, and the navbar/profile page
  read from it. Nothing in the UI edits it yet — role and team are set
  directly in the database.
- The `role` column is descriptive only. There is no authorization: any
  confirmed account reaches the whole dashboard. Enforcing roles means RLS
  policies on real tables plus route guards.

**Data**

- Every KPI, chart, table and profile card now reads from Postgres. A fresh
  workspace is empty until it is seeded or starts ingesting.
- **Demo seed data and real events look identical in the UI.** That is
  deliberate — it is what lets a workspace carry seeded history alongside
  live data — but it also means a seeded workspace shows numbers nobody
  measured. `workspace_costs.note` on the seeded basis says so; nothing else
  does. Clear `metric_points` before showing a workspace to a customer.
- Two cards on the profile page are still template fiction: the `Upload`
  card ("Complete Your Profile" / "Publish now") and the `Notification`
  settings card, whose toggles are not wired to anything. Neither was in
  scope for the data work; both should be built or removed before this is
  shown to a user.
- The seeded hourly traffic series covers a full UTC day, including hours
  that have not happened yet, so the DailyTraffic chart runs to the end of
  the day in a seeded workspace. Real ingestion does not do this.
- The "Data Sources" KPI counts every source while the table beneath it caps
  at five rows, so a workspace with six sources shows a tile and a table that
  appear to disagree. Inherited from the Horizon table components.
- **Landing page claims were audited and rewritten.** The original copy was
  placeholder that asserted a "SOC 2 Type II" certification, "99.98% platform
  uptime", "<400ms median query time", "5.7M events ingested daily" and "24
  native integrations" — none measured, none true. Every feature claim now
  describes behaviour that ships today.

  Unbuilt capabilities live in the **"On the roadmap"** band in
  `HowItWorks.jsx`, explicitly labelled as planned, and unbuilt plan features
  carry a `planned: true` flag rendering a "Planned" chip in `Pricing.jsx`.
  **Keep that boundary**: moving something into Features or dropping its chip
  is a statement that it exists. SOC 2 in particular is a third-party audit
  certification that enterprise buyers rely on — it stays in the roadmap until
  Nova actually holds it.

- Pricing figures ($0 / $390 / Custom) are intended pricing. There is no
  billing integration. Event volume is now metered (`metric_points`,
  `metric_key = 'events'`), but nothing enforces a quota against it.

**Build and tooling**

- Test coverage is deliberately narrow: the pure transforms in
  `lib/queries/shape.js`, the ingest function's request parsing, and the SQL
  layer. There are no component tests — `@testing-library` is still installed
  from the CRA era and unused. Rendering is not where the silent bugs have
  been; arithmetic and time zones are.
- The Edge Function has never been executed here — this machine has neither
  Deno nor the Supabase CLI. Its parsing logic is unit tested and the SQL it
  calls is covered end to end, but the deployed HTTP path itself is unverified
  until someone runs `curl` against it.
- The dashboard chunk is ~169 KB gzipped, almost all ApexCharts. It is
  already split away from the landing and auth bundles, but swapping to a
  lighter chart library would matter more than any further splitting.

**Removed from the template**

- The NFT Marketplace view and all its assets.
- The RTL layout tree (`views/rtl`, `layouts/rtl`, `sidebar/RTL`,
  `navbar/RTL`). If Nova ever needs Arabic or Hebrew, this comes back as real
  i18n rather than a duplicated component tree.
- `tailwindcss-rtl`, which nothing referenced afterwards.

**Licensing**

- This product is derived from Horizon UI Tailwind React (MIT). `LICENSE.md`
  retains the upstream copyright line alongside Nova's, as the MIT license
  requires. Do not delete it.

---

## Deployment (Vercel)

`npm run build` emits a static bundle in `dist/`. `vercel.json` is committed
and configures the deploy; Vercel needs no dashboard build settings.

**What `vercel.json` does, and why:**

- **SPA fallback** — rewrites everything to `/index.html`. Without it,
  hard-refreshing `/auth/sign-in` (or opening any emailed auth link) returns
  404, because no such file exists. Vercel checks the filesystem *before*
  rewrites, so real assets, `favicon.ico` and `manifest.json` still win over
  the catch-all.
- **Immutable caching** on `/assets/*`, which Vite content-hashes.
- **Baseline security headers** — nosniff, `DENY` framing, a conservative
  referrer policy, HSTS.

Note `vercel.json` has no comments because JSON has none, and Vercel
validates the file strictly — adding an unrecognised key (including a
`comment` key) fails the build rather than being ignored.

### Steps

1. Import the repo in Vercel. It will detect Vite; `vercel.json` pins the
   build command and output directory regardless.
2. **Project → Settings → Environment Variables**, for Production, Preview
   *and* Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These are inlined into the bundle at build time, so changing one requires
   a **redeploy**, not just a restart.
3. **Supabase → Authentication → URL Configuration**:
   - Site URL: your production origin, e.g. `https://nova-analytics.vercel.app`
   - Redirect URLs — add **both**:
     ```
     https://<your-production-domain>/**
     https://<project>-*-<your-team>.vercel.app/**
     ```
     The second entry matters: every preview deployment gets a unique
     generated hostname. Without the wildcard, a signup from a preview branch
     sends a confirmation link that redirects to production, where the token
     is not valid for that origin — the link appears to silently fail.

### Not yet configured

A **Content-Security-Policy** is deliberately absent. The correct policy for
this app needs `connect-src` for `https://*.supabase.co`, font origins for
`fonts.googleapis.com` / `fonts.gstatic.com`, and `style-src 'unsafe-inline'`
for the styles Tailwind and ApexCharts inject at runtime. Shipping an
untested CSP breaks the app in ways that are hard to diagnose, so it should
be added and verified against a preview deployment rather than guessed at
here.
