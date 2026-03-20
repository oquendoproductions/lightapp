#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd supabase
require_cmd node
require_cmd rsync
require_cmd mktemp

PROJECT_NAME="${STAGING_PROJECT_NAME:-cityreport-staging-$(date +%Y%m%d-%H%M)}"
REGION="${STAGING_REGION:-us-east-1}"
INSTANCE_SIZE="${STAGING_SIZE:-}"
DB_PASSWORD="${STAGING_DB_PASSWORD:-$(node -e "const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';let out='';for(let i=0;i<24;i++) out += chars[Math.floor(Math.random()*chars.length)];process.stdout.write(out);")}"
ORG_ID="${STAGING_ORG_ID:-}"

pick_json_field() {
  local json="$1"
  local code="$2"
  node -e "$code" "$json"
}

if [[ -z "$ORG_ID" ]]; then
  ORGS_JSON="$(supabase orgs list -o json)"
  ORG_ID="$(pick_json_field "$ORGS_JSON" '
    const rows = JSON.parse(process.argv[1]);
    if (!Array.isArray(rows) || rows.length === 0) process.exit(2);
    if (rows.length > 1) process.exit(3);
    const row = rows[0] || {};
    const id = row.id || row.org_id || row.slug || "";
    if (!id) process.exit(4);
    process.stdout.write(String(id));
  ')"
fi

echo "Creating staging project: $PROJECT_NAME"
CREATE_ARGS=(
  "$PROJECT_NAME"
  --org-id "$ORG_ID"
  --db-password "$DB_PASSWORD"
  --region "$REGION"
  -o json
)
if [[ -n "$INSTANCE_SIZE" ]]; then
  CREATE_ARGS+=(--size "$INSTANCE_SIZE")
fi
CREATE_JSON="$(supabase projects create "${CREATE_ARGS[@]}")"
PROJECT_REF="$(pick_json_field "$CREATE_JSON" '
  const input = JSON.parse(process.argv[1]);
  const keys = ["project_ref", "ref", "reference", "id"];
  const seen = new Set();
  const queue = [input];
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      for (const v of cur) queue.push(v);
      continue;
    }
    for (const k of keys) {
      const v = cur[k];
      if (typeof v === "string" && /^[a-z0-9]{20}$/.test(v)) {
        process.stdout.write(v);
        process.exit(0);
      }
    }
    for (const v of Object.values(cur)) queue.push(v);
  }
  process.exit(5);
')"

if [[ -z "$PROJECT_REF" ]]; then
  echo "Failed to determine project ref from create output." >&2
  exit 3
fi

echo "Created staging project ref: $PROJECT_REF"

API_KEYS_JSON="$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json)"
ANON_KEY="$(pick_json_field "$API_KEYS_JSON" '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows)) process.exit(2);
  const match = rows.find((r) => {
    const n = String(r?.name || "").toLowerCase();
    return n.includes("anon") || n.includes("publishable");
  });
  const key = String(match?.api_key || match?.key || "").trim();
  if (!key) process.exit(3);
  process.stdout.write(key);
')"
SERVICE_ROLE_KEY="$(pick_json_field "$API_KEYS_JSON" '
  const rows = JSON.parse(process.argv[1]);
  if (!Array.isArray(rows)) process.exit(2);
  const match = rows.find((r) => String(r?.name || "").toLowerCase().includes("service_role"));
  const key = String(match?.api_key || match?.key || "").trim();
  if (!key) process.exit(3);
  process.stdout.write(key);
')"

STAGING_URL="https://${PROJECT_REF}.supabase.co"

TMP_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/cityreport-staging-link.XXXXXX")"
trap 'rm -rf "$TMP_WORKDIR"' EXIT

mkdir -p "$TMP_WORKDIR/supabase"
cp "$ROOT_DIR/supabase/config.toml" "$TMP_WORKDIR/supabase/config.toml"
mkdir -p "$TMP_WORKDIR/supabase/migrations"
rsync -a "$ROOT_DIR/supabase/migrations/" "$TMP_WORKDIR/supabase/migrations/"

echo "Linking temporary workdir to staging project..."
supabase link --workdir "$TMP_WORKDIR" --project-ref "$PROJECT_REF" -p "$DB_PASSWORD" --yes

echo "Pushing migrations to staging..."
supabase db push --workdir "$TMP_WORKDIR" --linked --include-all -p "$DB_PASSWORD" --yes

echo "Deploying edge functions to staging..."
for fn in email-pothole-report email-water-drain-report rate-limit-gate cache-official-light-geo lead-capture; do
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo "Setting baseline staging secrets..."
supabase secrets set --project-ref "$PROJECT_REF" TENANT_FALLBACK_ENABLED=true
if [[ -n "${STAGING_RESEND_API_KEY:-}" ]]; then
  supabase secrets set --project-ref "$PROJECT_REF" RESEND_API_KEY="$STAGING_RESEND_API_KEY"
fi
if [[ -n "${STAGING_PW_REPORT_TO:-}" ]]; then
  supabase secrets set --project-ref "$PROJECT_REF" PW_REPORT_TO="$STAGING_PW_REPORT_TO"
fi
if [[ -n "${STAGING_PW_REPORT_FROM:-}" ]]; then
  supabase secrets set --project-ref "$PROJECT_REF" PW_REPORT_FROM="$STAGING_PW_REPORT_FROM"
fi
if [[ -n "${STAGING_ASHTABULA_CITY_GEOJSON:-}" ]]; then
  supabase secrets set --project-ref "$PROJECT_REF" ASHTABULA_CITY_GEOJSON="$STAGING_ASHTABULA_CITY_GEOJSON"
fi

./scripts/staging/write_staging_env.sh "$STAGING_URL" "$ANON_KEY"

echo
echo "Staging setup complete."
echo "Project ref: $PROJECT_REF"
echo "Project URL: $STAGING_URL"
echo "DB password: $DB_PASSWORD"
echo "Service role key: $SERVICE_ROLE_KEY"
echo "Saved app env: .env.staging.local"
echo
echo "Next:"
echo "1) cp .env.staging.local .env.local"
echo "2) npm run dev -- --host 0.0.0.0 --port 4173"
echo "3) Test /gmaps and pilot flows against staging backend."
