/**
 * Request-parsing helpers for the ingest endpoint.
 *
 * Split out of index.ts purely so they can be unit tested: index.ts calls
 * Deno.serve at module scope, so importing it from vitest would try to start
 * a server. These functions are the only logic the edge function actually
 * owns — everything else is delegated to public.ingest_events().
 */

/**
 * Postgres error codes chosen in migration 0010 so the HTTP layer can
 * classify failures without string-matching error messages:
 *
 *   28000 — bad or missing write key      -> 401
 *   22023 — malformed event in the batch  -> 400
 *   P0001 — explicit raise                -> 400
 *
 * Anything else is our bug, not the caller's: 500, and the detail is logged
 * rather than returned.
 */
export const statusForPgError = (code: string | undefined | null): number => {
  if (code === "28000") return 401;
  if (code === "22023" || code === "P0001") return 400;
  return 500;
};

/**
 * Pull the write key from either header form.
 *
 * The scheme match is case-insensitive because RFC 7235 says auth schemes are,
 * and real clients send "bearer" — Postgres would then be handed the string
 * "bearer nvk_..." as a key, which fails as a 401 with no hint about why.
 */
export const readWriteKey = (headers: Headers): string | null => {
  const header = headers.get("authorization");
  if (header && /^bearer\s/i.test(header)) {
    return header.replace(/^bearer\s+/i, "").trim() || null;
  }
  return headers.get("x-nova-write-key")?.trim() || null;
};

/**
 * Accept either `{ events: [...] }` or a bare array — SDKs differ and
 * rejecting the bare form buys nothing. Returns null when the body is neither.
 */
export const readEvents = (payload: unknown): unknown[] | null => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const { events } = payload as { events?: unknown };
    if (Array.isArray(events)) return events;
  }
  return null;
};

export const MAX_BATCH = 500;
