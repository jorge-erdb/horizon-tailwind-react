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

There is no test script — no test runner is configured yet. See Limitations.

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

   Verify them locally first with `./supabase/tests/run-migration-tests.sh`
   (see Testing below).
7. Supabase's built-in SMTP is heavily rate-limited (a few messages per hour)
   and intended only for testing. Configure your own SMTP before any real
   signup volume.

If the two env vars are missing the app still builds and runs — the landing
page works, and the auth screens render with an explanatory banner and
disabled submit buttons rather than crashing.

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
| Icons | `react-icons` | Inherited. |

### Where things live

```
nova_analytics_id/        Brand kit — logos, color/type tokens, guidelines
src/
  assets/img/layout/nova/ Nova logo SVGs + favicon source
  components/
    auth/ProtectedRoute   Session gate for /admin/*
    brand/NovaLogo        Inline-SVG logo (mark | horizontal | stacked)
  contexts/AuthContext    Session + profile state, all auth actions
  lib/supabase.js         Supabase client, reads env vars
  views/
    landing/              Marketing page and its sections
    auth/                 SignIn, SignUp, AuthCallback, ResetPassword
    admin/                Dashboard, data tables, profile
  routes/                 adminRoutes (sidebar nav) + authRoutes
supabase/migrations/      SQL to run in the Supabase SQL Editor, in order
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
./supabase/tests/run-migration-tests.sh    # requires Docker
```

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

- **The dashboard charts and tables are still static demo data.** Every
  number, chart and table row is a fixture under
  `src/views/admin/*/variables/`. The only live data in the app is the
  signed-in user and their profile row.
- The profile page reads the real account, but the "Plan" and "Data
  residency" cards are still hardcoded copy — there are no columns behind
  them yet.
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
  billing integration and no event metering behind the quotas.

**Build and tooling**

- No frontend tests and no JS test runner. `@testing-library` packages are
  still installed from the CRA era but nothing runs them — Vitest is the
  natural fit alongside Vite. The SQL layer *is* covered, see Testing.
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
