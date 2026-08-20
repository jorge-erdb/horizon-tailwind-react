# Future plans

Work that is designed but not built. Each entry exists because a card was
removed from the UI rather than left in place pretending to work, and this
file is where the intended implementation is recorded so the removal is a
deferral rather than a deletion.

Two cards came off the profile page in that pass: **notification
preferences** and **avatar upload**. Both are described below with the state
of the schema as it actually stands, so the next person starts from what is
there rather than from what the template implied.

---

## 1. Notification preferences

### Why it was removed

The card rendered nine switches. None of them held state — no `useState`, no
`onChange`, no `checked` anywhere in the file — so every toggle sprang back
on the next render. No label was associated with any control either: the
labels pointed at `checkbox1`–`checkbox8` while the switches carried
`switch1`–`switch8`, and one id was used twice. Clicking a label did nothing
and a screen reader announced nine unlabelled switches.

The labels themselves came from the template Nova was forked from — "Buyer
review notifications", "Meetups near you", "Email me when someone follows
me". They describe a marketplace, not an analytics tool, so there was no
original intent worth preserving. What follows is a design for the feature
Nova should actually have.

### The part worth getting right first

The obvious move is to add a preferences table and wire the switches to it.
That would be building the last mile of a road that has no earlier miles.

Here is the chain as it stands today:

| Link | State | Evidence |
| --- | --- | --- |
| `alerts` rows exist, with `metric_key`, `comparator`, `threshold`, `is_active` | **Built** | `0003_domain.sql:108` |
| Something evaluates those thresholds against `metric_points` and sets `triggered_at` | **Missing** | `triggered_at` is written nowhere outside `0006_seed.sql:70` |
| Something writes a `notifications` row when an alert fires | **Missing** | The only `insert into public.notifications` is `0006_seed.sql:100` |
| The bell dropdown reads and marks them read | **Built** | `src/lib/queries/notifications.js` |
| The user chooses which of these reach them | **Missing** | No table, no column |

So `notifications` is a *delivery log* — `title`, `body`, `kind`, `read_at` —
and not a preferences store. Nothing has ever written to it except the seed.
Once seeded data is removed, the bell is permanently empty, and an alert with
a threshold set on it will never fire, because no evaluator runs.

A preferences UI added on top of that would be a panel of switches
controlling a delivery path that does not exist. Build the chain in order.

### Phase 1 — evaluate alerts

A scheduled job (`pg_cron` in Postgres, or a Supabase Edge Function on a
schedule) that, per active alert, reads the current value of `metric_key`
from `metric_points`, compares it per `comparator`, and on a crossing sets
`triggered_at` and inserts a `notifications` row addressed to the workspace.

Two things to decide before writing it:

- **Re-arming.** An alert that stays above its threshold should not produce a
  notification per run. Fire on the crossing — the transition from not-
  breaching to breaching — and require a return below the threshold before it
  can fire again. `triggered_at` carries the state needed to tell those apart.
- **`changes_by`.** The comparator set includes it, and unlike `above` and
  `below` it needs a prior window to compare against. `get_metric_series`
  (`0004_metrics.sql:99`) already returns bucketed series and is the natural
  source for both sides of that comparison.

Worth asserting in `supabase/tests/` alongside the existing RLS checks: an
alert fires once on a crossing, not on every run.

### Phase 2 — a preferences table

Only once something is being delivered.

```sql
create table if not exists public.notification_preferences (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  workspace_id  uuid        not null references public.workspaces (id) on delete cascade,
  -- Which classes of event reach this member. Nova's real events, not the
  -- template's: an alert crossing its threshold, a connected source failing
  -- to sync, a scheduled report completing.
  alert_fired       boolean not null default true,
  source_unhealthy  boolean not null default true,
  report_ready      boolean not null default false,
  -- In-app is always on; email is the one worth opting out of.
  email_enabled     boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (user_id, workspace_id)
);
```

Preferences are **per member per workspace**, not per user. Someone in two
workspaces will want different things from each, and a single row on
`profiles` cannot express that.

RLS should follow the pattern the rest of the schema already uses — a member
reads and writes only their own row, gated on `is_workspace_member`, in the
shape of the `notifications` policies at `0003_domain.sql:197`. The absent
row must mean *defaults*, not *nothing*: read through
`coalesce`, and let the first toggle be the insert.

### Phase 3 — the card

Then the UI is small, and it is the easy part: a query, a mutation, an
optimistic toggle, and switches that carry `htmlFor` matching a real control
id. Three or four toggles that name Nova's actual events beat nine that name
another product's.

---

## 2. Avatar upload

### Why it was removed

The card was untouched template. The dropzone had no file input and no
handler — "Upload Files / PNG, JPG and GIF files are allowed" did nothing at
all. Beside it sat copy for a different product: *"Stay on the pulse of
distributed projects with an anline whiteboard to plan, coordinate and
discuss"* — typo included — under a "Publish now" button carrying an `href`,
which is not valid on a `<button>` and went nowhere regardless.

### What already exists

More than for notifications, which makes this the better first pick of the
two:

- `profiles.avatar_url` is in the schema (`0001_profiles.sql`), and RLS
  already lets a user update their own profile row and only their own.
- `Banner.jsx` already reads it: `profile?.avatar_url || avatar`, falling
  back to the bundled placeholder. **The display side is done.** Give the
  column a value and the avatar changes.

What is missing is a bucket and a write path. There is no Supabase Storage
bucket configured anywhere in `supabase/`, and no code in `src/lib/` writes
to `profiles` at all — the profile page is entirely read-only today, so this
would be the first mutation against it.

### Implementation

1. **Create the bucket.** `avatars`, public-read, with storage RLS allowing a
   user to write only under a prefix of their own uid — the standard
   `(storage.foldername(name))[1] = auth.uid()::text` policy. Without the
   prefix condition any authenticated user can overwrite anyone's avatar.
2. **Upload, then record.** `supabase.storage.from("avatars").upload()` to
   `{uid}/{filename}`, then write the resulting public URL to
   `profiles.avatar_url`. Use `upsert: true`, or a content hash in the key,
   so replacing an avatar does not accumulate orphans.
3. **Validate before uploading, not after.** Accept a small explicit set of
   image types and cap the size. A bucket-level limit rejects an oversized
   file only after it has been sent; checking `file.type` and `file.size`
   client-side fails immediately. Both are worth having — the client check is
   for the person waiting, the bucket limit is what actually enforces it.
4. **The card.** A real `<input type="file">` with a visible label, the
   current avatar as a preview, and pending/error states. `QueryLoading` and
   `QueryError` in `components/common/QueryState` are the house pattern.
5. **Invalidate.** `AuthContext` holds `profile`; the write has to refresh it
   or the new avatar will not appear until reload.

A note on scope: `profiles` also has `full_name` and `team`, both read-only
in the UI today and both editable under the same existing RLS policy. Once
there is one working mutation against `profiles`, an editable General
Information card is a small addition, and probably the more useful one.

---

## Not planned

Two things were also removed and are **not** coming back, so that nobody
reinstates them from the git history assuming they were wanted:

- **The dashboard search box.** It was decoration — no `value`, no
  `onChange`, no handler. Real search across sources, reports, alerts and
  tasks is a genuine feature, but it is a feature, not a restoration of that
  input. It should be designed rather than un-deleted.
- **The "Pages /" breadcrumb** in the navbar, whose links pointed at `" "`
  and `"#"`. Nova's dashboard is two levels deep; the sidebar already says
  where you are.
