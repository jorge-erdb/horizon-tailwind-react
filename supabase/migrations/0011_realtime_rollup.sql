-- Nova Analytics — 0011_realtime_rollup
--
-- Closes the gap between "an event was accepted" and "the dashboard shows it".
--
-- 0010 rolls `events` into `metric_points` from pg_cron every five minutes.
-- That is the right safety net, but it means the floor on visible latency is
-- five minutes: ingest returns 202, and the chart keeps drawing the old number
-- until the next tick. For a product whose pitch is a live dashboard, that is
-- a real weakness rather than a demo inconvenience — the first thing anyone
-- does after wiring up ingestion is refresh the page to see whether it worked,
-- and for five minutes the honest answer is "it did, but you can't tell".
--
-- The note at the bottom of 0010 anticipated this: "the rollup just needs
-- calling manually or from the edge function."
--
-- Rather than restate ingest_events' ~120 lines of auth and validation, this
-- wraps it. ingest_events stays the single definition of "is this key valid
-- and is this event well-formed" — 0008 made the same call for the same
-- reason, and the duplication it avoided is the kind that drifts silently on
-- the copy exposed to the public internet.
--
-- Trade-off, stated plainly: ingest now pays for the rollup inline, so a write
-- costs more than it did. That is acceptable here because the refresh window
-- is bounded by the batch's own span (see below) rather than the default
-- three-day tail, so the common case — a batch of events that just happened —
-- touches exactly one day bucket. A high-volume deployment should move this
-- back to a queue and leave cron to do the work; that is a scaling decision,
-- not a correctness one, and the cron job stays scheduled either way.

-- ---------------------------------------------------------------------------
-- ingest_and_refresh — ingest_events, then roll up just what it touched
-- ---------------------------------------------------------------------------

create or replace function public.ingest_and_refresh(
  p_write_key text,
  p_events    jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  written integer;
  ws      uuid;
  since   timestamptz;
begin
  -- Every rejection path lives in here: missing key, invalid key, bad batch
  -- shape, malformed event. If it raises, nothing below runs and the caller
  -- sees the same SQLSTATE it saw before this function existed.
  written := public.ingest_events(p_write_key, p_events);

  -- 0 means an empty array, which ingest_events accepts as a no-op. Nothing
  -- was written, so there is nothing to roll up.
  if written is null or written = 0 then
    return coalesce(written, 0);
  end if;

  select d.workspace_id into ws
    from public.data_sources d
   where d.write_key_hash = public.hash_write_key(p_write_key);

  -- ingest_events already proved the key resolves, so this cannot miss. Guard
  -- anyway: silently skipping the rollup would be a much harder bug to see
  -- than a null check that never fires.
  if ws is null then
    return written;
  end if;

  -- The narrowest window that still covers the batch. Events default to now(),
  -- so the ordinary case resolves to today and rewrites one day bucket. A
  -- backfilled batch carrying older occurred_at values widens the window to
  -- reach them — which the cron job's fixed three-day tail would silently miss,
  -- leaving those buckets stale forever.
  select min(coalesce((e ->> 'occurred_at')::timestamptz, now()))
    into since
    from jsonb_array_elements(p_events) e;

  perform public.refresh_metric_points(ws, since);

  return written;
end;
$$;

-- Same posture as ingest_events: the write key is the caller's credential and
-- service_role is the edge function's. No browser role reaches this.
revoke execute on function public.ingest_and_refresh(text, jsonb) from public;
revoke execute on function public.ingest_and_refresh(text, jsonb) from anon;
revoke execute on function public.ingest_and_refresh(text, jsonb) from authenticated;
grant execute on function public.ingest_and_refresh(text, jsonb) to service_role;
