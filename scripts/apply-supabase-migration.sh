#!/usr/bin/env bash
# Apply a single GoTRefs SQL migration to a Supabase Postgres database.
#
# Usage:
#   ./scripts/apply-supabase-migration.sh                          # marketplace (default)
#   ./scripts/apply-supabase-migration.sh 20260215100000_dev_screening_clear_rpc.sql
#
# Requires DATABASE_URL — from Supabase Dashboard → Project Settings → Database
# (Connection string → URI, use the pooler or direct connection).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATION="${1:-20260213130000_gotrefs_marketplace.sql}"
MIGRATION_PATH="$ROOT/supabase/migrations/$MIGRATION"

if [[ ! -f "$MIGRATION_PATH" ]]; then
  echo "Migration not found: $MIGRATION_PATH" >&2
  echo "Available migrations:" >&2
  ls -1 "$ROOT/supabase/migrations/" >&2
  exit 1
fi

# Load DATABASE_URL from web/.env.local when not set in the shell.
if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/web/.env.local" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/web/.env.local" | cut -d= -f2- | tr -d '\r' || true)"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Set DATABASE_URL in web/.env.local or your shell." >&2
  echo "Supabase → Project Settings → Database → Connection string (URI)." >&2
  exit 1
fi

echo "Applying $MIGRATION ..."
npx supabase db query --db-url "$DATABASE_URL" -f "$MIGRATION_PATH"
echo "Done: $MIGRATION"
