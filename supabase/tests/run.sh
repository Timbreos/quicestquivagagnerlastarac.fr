#!/usr/bin/env bash
# Rejoue les migrations et le test de scoring sur un Postgres local.
# Usage : PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${TEST_DB:-starac_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
echo "→ seed.sql"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/seed.sql
echo "→ tests"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/scoring_test.sql
echo "OK : toutes les assertions passent."
