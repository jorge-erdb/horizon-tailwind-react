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
IMAGE="postgres:16-alpine"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting throwaway postgres"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

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
