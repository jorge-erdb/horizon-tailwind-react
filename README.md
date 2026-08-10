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
| `npm start` | Dev server with hot reload on port 3000 |
| `npm run build` | Production bundle into `build/` |
| `npm test` | Test runner (no test suite exists yet — see Limitations) |
| `npm run pretty` | Prettier over all JS/JSX/JSON |

### Environment variables

**You need to supply these — they are not in the repo and nothing is
hardcoded.** Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it | Required |
| --- | --- | --- |
| `REACT_APP_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API → Project URL | Yes, for auth |
| `REACT_APP_SUPABASE_ANON_KEY` | Same page → Project API keys → `anon` `public` | Yes, for auth |

Notes:

- Create React App only exposes variables prefixed with `REACT_APP_`, and it
  **inlines them at build time**. Restart `npm start` after editing
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
6. **Run the database migration**: paste `supabase/migrations/0001_profiles.sql`
   into the SQL Editor and run it. It creates `public.profiles`, enables RLS
   with owner-only policies, and adds a trigger that creates a profile row on
   signup. Without it the app still works, but the profile page falls back to
   session data and the console warns.
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
| Build | Create React App (`react-scripts` 5) | Inherited. Kept deliberately — see Limitations. |
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
  routes.js               Sidebar + router route table
supabase/migrations/      SQL to run in the Supabase SQL Editor
tailwind.config.js        Nova design tokens
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
- Landing-page copy — pricing, uptime, event volumes, "SOC 2 Type II" — is
  **placeholder marketing copy that I invented**. Replace it with claims Nova
  can actually stand behind before this is public. Compliance claims in
  particular should not ship unreviewed.

**Build and tooling**

- Still on Create React App, which is deprecated and unmaintained. `npm
  install` reports vulnerabilities from its transitive dependencies. Migrating
  to Vite is the obvious next step but is a bigger change than a whitelabel
  and would have made the diff hard to review.
- No tests. `@testing-library` is installed but there is no test file and no
  CI.
- The `browserslist` database is ~20 months stale; `npx update-browserslist-db@latest`
  clears the build warning.

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

## Deployment

`npm run build` emits a static bundle in `build/`. Serve it from any static
host, with two requirements:

1. **SPA fallback** — rewrite all unmatched paths to `index.html`, or deep
   links like `/auth/sign-in` will 404.
2. Set `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` in the build
   environment, and add the deployed origin to Supabase's Redirect URLs.
