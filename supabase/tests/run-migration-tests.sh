#!/usr/bin/env bash
#
# Apply every migration to a throwaway Postgres and assert the behaviour that
# matters — the signup trigger, seed idempotency, and RLS tenant isolation.
#
# Run this before pasting migrations into a Supabase project. Postgres will
# happily accept a policy that leaks data across tenants; syntax being valid
# proves nothing.
#
#   ./supabase/tests/run-migration-tests.sh
#
# Requires Docker. Nothing touches your Supabase project.

set -euo pipefail

CONTAINER="nova-pg-test-$$"

# Match the major version the Supabase project actually runs (17.x). Asserting
# migrations against a different major than production is a gap in the one
# layer these tests exist to cover -- policy and function behaviour is exactly
# the kind of thing that can differ across majors. Override to check a
# prospective upgrade before Supabase applies it:
#
#   POSTGRES_IMAGE=postgres:18-alpine ./supabase/tests/run-migration-tests.sh
IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting throwaway postgres"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null

# Probe over TCP, not the unix socket. The official image runs a *temporary*
# server during initdb to apply POSTGRES_PASSWORD and the init scripts, and
# that server listens on the socket only — never on TCP. Probing the socket
# therefore reports "ready" against a server that is seconds from being shut
# down and restarted, and the first real psql call lands in the gap and dies
# with "No such file or directory" on the socket path.
#
# Locally this almost never fires: the postgres image is already cached, so
# the window is tiny. On a cold CI runner the image pull shifts the timing and
# it fires readily — the same commit passed on one branch and failed on the
# other, which is what a race looks like. A TCP probe cannot see the temporary
# server at all, so "ready" means the real one.
ready=false
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done

# Without this the loop just falls through after 60 tries and every later step
# fails with a confusing connection error instead of the real cause.
if [ "$ready" != true ]; then
  echo "==> postgres never accepted TCP connections; container log follows" >&2
  docker logs "$CONTAINER" >&2 || true
  exit 1
fi

# Migrations are chatty on re-run ("already exists, skipping") — that is the
# idempotency working, so quiet it down to keep the output readable.
run_migration() {
  docker cp "$1" "$CONTAINER:/tmp/current.sql" >/dev/null
  docker exec -i "$CONTAINER" psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 --quiet -c 'set client_min_messages = warning' \
    -f /tmp/current.sql
}

# Assertions must run as one transaction: they use SET LOCAL ROLE to become
# `authenticated`, and SET LOCAL outside a transaction block is silently a
# no-op — which would leave the checks running as superuser, bypassing RLS
# entirely and passing for the wrong reason.
run_assertions() {
  docker cp "$1" "$CONTAINER:/tmp/current.sql" >/dev/null
  docker exec -i "$CONTAINER" psql -U postgres -d postgres \
    -v ON_ERROR_STOP=1 --quiet --single-transaction -f /tmp/current.sql
}

echo "==> installing Supabase shim (auth schema, auth.uid, roles)"
run_migration "$ROOT/supabase/tests/shim.sql" >/dev/null

echo "==> applying migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  printf '    %-28s' "$(basename "$migration")"
  run_migration "$migration" >/dev/null
  echo "ok"
done

echo "==> re-applying migrations (must be idempotent)"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  printf '    %-28s' "$(basename "$migration")"
  run_migration "$migration" >/dev/null
  echo "ok"
done

echo "==> assertions"
run_assertions "$ROOT/supabase/tests/assertions.sql"

echo
echo "All migration tests passed."
