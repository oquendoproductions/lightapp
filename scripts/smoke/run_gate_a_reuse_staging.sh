#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web"
PROJECT_REF="madjklbsdwbtrqhpxmfs"
OUT_DIR="$ROOT/docs/evidence/automation"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/gate-a-reuse-staging-$STAMP_UTC.md"

cd "$ROOT"
mkdir -p "$OUT_DIR"
TMP_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/cityreport-stage-link.XXXXXX")"
trap 'rm -rf "$TMP_WORKDIR"' EXIT

mkdir -p "$TMP_WORKDIR/supabase/migrations"
cp "$ROOT/supabase/config.toml" "$TMP_WORKDIR/supabase/config.toml"
rsync -a "$ROOT/supabase/migrations/" "$TMP_WORKDIR/supabase/migrations/"

{
  echo "# Gate A Reuse-Staging Automation"
  echo
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "Project ref: $PROJECT_REF"
  echo "Temp workdir: $TMP_WORKDIR"
  echo
  echo "## Execution Output"
  echo '```text'
} > "$OUT_FILE"

supabase link --workdir "$TMP_WORKDIR" --project-ref "$PROJECT_REF" --yes >> "$OUT_FILE" 2>&1
supabase migration list --workdir "$TMP_WORKDIR" --linked >> "$OUT_FILE" 2>&1
supabase db push --workdir "$TMP_WORKDIR" --linked --include-all --yes >> "$OUT_FILE" 2>&1
supabase migration list --workdir "$TMP_WORKDIR" --linked >> "$OUT_FILE" 2>&1
for fn in email-pothole-report email-water-drain-report rate-limit-gate cache-official-light-geo lead-capture; do
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt >> "$OUT_FILE" 2>&1
done
supabase secrets set --project-ref "$PROJECT_REF" TENANT_FALLBACK_ENABLED=true >> "$OUT_FILE" 2>&1
supabase secrets list --project-ref "$PROJECT_REF" >> "$OUT_FILE" 2>&1

{
  echo '```'
} >> "$OUT_FILE"

echo "$OUT_FILE"
