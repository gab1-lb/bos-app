#!/usr/bin/env bash
# Runs supabase/migrations/*.sql then supabase/tests/*.test.sql against a throwaway
# local PostgreSQL 16 with a minimal Supabase-like `auth` schema and roles.
# Exits non-zero on the first failure; always stops the server and removes the cluster.
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGUSER_OS="${PGUSER_OS:-postgres}"
PORT="${PGTEST_PORT:-$(( 54000 + RANDOM % 1000 ))}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/bos-pgtest.XXXXXX")"
DATA="$WORK/data"

as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u "$PGUSER_OS" -- "$@"; else "$@"; fi
}

chmod 755 "$WORK"
[ "$(id -u)" = "0" ] && chown "$PGUSER_OS" "$WORK"

cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_pg "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres)
"${PSQL[@]}" -d postgres -c "create database bos_test" >/dev/null
PSQL+=(-d bos_test)

# Minimal Supabase stand-ins.
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase grants table privileges to anon/authenticated by default; mimic that.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
SQL

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

# The shipped seeds must run: seed.sql with its placeholders replaced, then seed-demo.sql
# once the bootstrap admin has signed in (twice, to prove idempotence).
echo "seed: seed.sql"
sed -e "s/__ALLOWED_DOMAIN__/example.com/" -e "s/__ADMIN_EMAIL__/Admin@Example.com/" "$ROOT/supabase/seed.sql" | "${PSQL[@]}"
"${PSQL[@]}" -c "select count(*) = 12 as ok from public.templates" -t | grep -q t || { echo "seed: expected 12 templates"; exit 1; }
"${PSQL[@]}" -c "insert into auth.users (email, email_confirmed_at) values ('admin@example.com', now())"
echo "seed: seed-demo.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed-demo.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed-demo.sql"
"${PSQL[@]}" -c "select count(*) = 1 as ok from public.deals where owner_id is not null" -t | grep -q t || { echo "seed: expected 1 demo deal"; exit 1; }
"${PSQL[@]}" -c "delete from public.activity; delete from public.deals; delete from public.templates; delete from public.mandate; delete from public.app_settings; delete from auth.users"

status=0
for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "test: $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f"; then status=1; fi
done

if [ "$status" = "0" ]; then echo "SQL TESTS: PASS"; else echo "SQL TESTS: FAIL"; fi
exit "$status"
