/**
 * Nova Analytics — event ingest endpoint
 *
 *   POST /functions/v1/ingest
 *   Authorization: Bearer nvk_<key>          (or  X-Nova-Write-Key: nvk_<key>)
 *   Content-Type: application/json
 *
 *   { "events": [ { "name": "page_view", "distinct_id": "u_123", ... } ] }
 *
 * This function deliberately does almost nothing. Authentication, validation
 * and the insert all live in public.ingest_events() so there is exactly one
 * implementation of "is this key valid and is this event well-formed" — a
 * second copy here would drift, and the copy that drifts is the one on the
 * public internet.
 *
 * What it does own is HTTP: CORS, method and body shape, and mapping SQLSTATE
 * to a status code.
 *
 * It holds the service_role key. That is the legitimate use of that key —
 * server side, never shipped to a browser — and it is why ingest_events is
 * granted to service_role only rather than to anon. The write key is the
 * caller's credential; service_role is this function's.
 */

import {
  MAX_BATCH,
  readEvents,
  readWriteKey,
  statusForPgError,
} from "./parse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Browser SDKs post from arbitrary origins, so this endpoint is intentionally
// open to all of them. That is safe here and only here: the write key is the
// credential, there are no cookies involved, and nothing is ever read back.
// Do not copy this header block onto an endpoint that returns data.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-nova-write-key, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("ingest: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY unset");
    return json({ error: "Ingest is not configured" }, 500);
  }

  const writeKey = readWriteKey(req.headers);
  if (!writeKey) {
    return json(
      { error: "Missing write key. Send Authorization: Bearer <key>." },
      401
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be JSON" }, 400);
  }

  const events = readEvents(payload);
  if (!events) {
    return json({ error: "Expected an array of events" }, 400);
  }

  // Checked here as well as in SQL so an oversized body is rejected before it
  // becomes a database round trip.
  if (events.length > MAX_BATCH) {
    return json(
      { error: `Batch too large: ${events.length} events (max ${MAX_BATCH})` },
      400
    );
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_events`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_write_key: writeKey, p_events: events }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const status = statusForPgError(detail?.code);

    if (status === 500) {
      // Never echo an unexpected database error to the caller: it can carry
      // schema detail, and the caller cannot act on it anyway.
      console.error("ingest: unexpected database error", detail);
      return json({ error: "Ingest failed" }, 500);
    }

    return json({ error: detail?.message ?? "Ingest rejected" }, status);
  }

  const accepted = await response.json();
  return json({ accepted }, 202);
});
