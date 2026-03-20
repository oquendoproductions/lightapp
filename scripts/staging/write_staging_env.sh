#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <staging_supabase_url> <staging_anon_key>" >&2
  exit 1
fi

STAGING_URL="$1"
STAGING_ANON_KEY="$2"
CURRENT_ENV_FILE=".env.local"
OUT_FILE=".env.staging.local"

if [[ -f "$CURRENT_ENV_FILE" ]]; then
  MAPS_KEY="$(grep -E '^VITE_GOOGLE_MAPS_API_KEY=' "$CURRENT_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  MAPS_KEY_DEV="$(grep -E '^VITE_GOOGLE_MAPS_API_KEY_DEV=' "$CURRENT_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  MAP_ID="$(grep -E '^VITE_GOOGLE_MAP_ID=' "$CURRENT_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  LEGACY_PLACES="$(grep -E '^VITE_ENABLE_LEGACY_PLACES_SERVICE=' "$CURRENT_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
else
  MAPS_KEY=""
  MAPS_KEY_DEV=""
  MAP_ID=""
  LEGACY_PLACES="true"
fi

cat > "$OUT_FILE" <<EOF_ENV
VITE_SUPABASE_URL=${STAGING_URL}
VITE_SUPABASE_ANON_KEY=${STAGING_ANON_KEY}
VITE_LEAD_CAPTURE_URL=${STAGING_URL}/functions/v1/lead-capture
VITE_GOOGLE_MAPS_API_KEY=${MAPS_KEY}
VITE_GOOGLE_MAPS_API_KEY_DEV=${MAPS_KEY_DEV}
VITE_GOOGLE_MAP_ID=${MAP_ID}
VITE_ENABLE_LEGACY_PLACES_SERVICE=${LEGACY_PLACES}
EOF_ENV

echo "Wrote ${OUT_FILE}"
