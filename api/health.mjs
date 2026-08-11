/**
 * GET /api/health — liveness and dependency check.
 *
 * A health endpoint that only proves it can return 200 tells you the CDN is
 * up, which was never in doubt. This one checks the dependency that can
 * actually break: PostgREST reachability, and that the schema is present.
 *
 * It also asserts that anonymous reads stay empty. The publishable key is in
 * the browser bundle by design, so RLS is the only thing standing between it
 * and every tenant's data; a policy change that opens a table up would
 * otherwise be invisible until someone noticed their data in a stranger's
 * dashboard. Rows coming back here means that has happened, and the endpoint
 * reports `degraded` rather than pretending the system is fine because it
 * answered quickly.
 *
 * Runs on Vercel's Node runtime with no secrets: only the same URL and
 * publishable key the browser already holds. There is deliberately no path
 * here that uses service_role.
 *
 * .mjs, not .js: package.json has no `"type": "module"`, so a .js file here
 * would be treated as CommonJS and `export default` would throw at runtime.
 * Setting the package to ESM instead would break postcss.config.js and
 * prettier.config.js, which are both `module.exports`. The extension scopes
 * the decision to this one file.
 */

const TIMEOUT_MS = 3000;

// Long enough to distinguish "slow" from "down", short enough that a hung
// dependency does not hold the request open until Vercel's own limit.
async function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  // A health check answering a stale cached response is worse than no health
  // check: it reports the state of the world at some unknown past moment.
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ status: "error", error: "Use GET" });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  const startedAt = Date.now();

  const body = {
    status: "ok",
    service: "nova-analytics",
    checks: {},
    // Vercel injects this; absent in local dev, which is not an error.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    timestamp: new Date().toISOString(),
  };

  if (!url || !key) {
    // Distinguished from a failed check on purpose: nothing is broken, the
    // deployment was never given its environment. That is a different fix.
    body.status = "degraded";
    body.checks.config = { ok: false, detail: "Supabase env vars not set" };
    return res.status(503).json(body);
  }
  body.checks.config = { ok: true };

  try {
    // `workspaces` is RLS-protected and always present once 0002 has run, so
    // one request covers reachability, schema, and policy posture. `limit=1`
    // keeps it cheap; a leak of any size fails the check just as loudly.
    const response = await withTimeout(
      (signal) =>
        fetch(`${url}/rest/v1/workspaces?select=id&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal,
        }),
      TIMEOUT_MS
    );

    if (!response.ok) {
      body.status = "degraded";
      body.checks.database = {
        ok: false,
        detail: `PostgREST returned ${response.status}`,
      };
      return res.status(503).json(body);
    }

    const rows = await response.json();
    body.checks.database = { ok: true, latency_ms: Date.now() - startedAt };

    // The important one. An anonymous caller must see nothing.
    if (Array.isArray(rows) && rows.length > 0) {
      body.status = "degraded";
      body.checks.rls = {
        ok: false,
        detail: "anonymous read returned rows; tenant isolation is open",
      };
      return res.status(503).json(body);
    }
    body.checks.rls = { ok: true };

    return res.status(200).json(body);
  } catch (error) {
    // Never echo the raw error: it can carry the project URL and internal
    // detail, and a monitor cannot act on it anyway.
    const timedOut = error?.name === "AbortError";
    body.status = "degraded";
    body.checks.database = {
      ok: false,
      detail: timedOut ? `no response in ${TIMEOUT_MS}ms` : "unreachable",
    };
    return res.status(503).json(body);
  }
}
