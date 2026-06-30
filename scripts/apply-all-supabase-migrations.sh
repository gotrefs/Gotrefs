#!/usr/bin/env bash
# Apply every GoTRefs migration in timestamp order.
#
# Usage:
#   ./scripts/apply-all-supabase-migrations.sh
#
# Fresh Supabase project: enable Auth (email) first, then run this script.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY="$ROOT/scripts/apply-supabase-migration.sh"

for migration in $(ls -1 "$ROOT/supabase/migrations/"*.sql | xargs -n1 basename | sort); do
  "$APPLY" "$migration"
done

echo "All migrations applied."
