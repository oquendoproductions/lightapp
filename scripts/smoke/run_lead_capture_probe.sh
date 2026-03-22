#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT_DIR="$ROOT/docs/evidence/automation"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/lead-capture-probe-${STAMP_UTC}.md"

APP_URL="${APP_URL:-https://cityreport.io}"
EXECUTE_WRITE="${EXECUTE_WRITE:-0}"

mkdir -p "$OUT_DIR"

HTML="$(curl -sL "$APP_URL")"
BUNDLE_PATH="$(printf '%s' "$HTML" | rg -o 'assets/index-[^"]+\.js' -m1 || true)"
if [[ -z "${BUNDLE_PATH:-}" ]]; then
  echo "Failed to resolve frontend bundle from $APP_URL" >&2
  exit 1
fi

BUNDLE_URL="${APP_URL%/}/${BUNDLE_PATH}"
BUNDLE_TEXT="$(curl -sL "$BUNDLE_URL")"
SUPABASE_URL="$(printf '%s' "$BUNDLE_TEXT" | rg -o 'https://[a-z0-9]+\.supabase\.co' -m1 || true)"
SUPABASE_KEY="$(printf '%s' "$BUNDLE_TEXT" | rg -o 'sb_publishable_[A-Za-z0-9._-]+' -m1 || true)"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_KEY:-}" ]]; then
  echo "Failed to extract Supabase URL or anon key from bundle $BUNDLE_URL" >&2
  exit 1
fi

NODE_OUT_FILE="$(mktemp "${TMPDIR:-/tmp}/lead-capture-probe.XXXXXX.json")"
trap 'rm -f "$NODE_OUT_FILE"' EXIT

SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" EXECUTE_WRITE="$EXECUTE_WRITE" node >"$NODE_OUT_FILE" <<'NODE'
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const executeWrite = String(process.env.EXECUTE_WRITE || "0") === "1";
const stamp = new Date().toISOString();
const endpoint = `${supabaseUrl}/functions/v1/lead-capture`;

const payload = {
  fullName: "Smoke Probe",
  workEmail: `smoke+${Date.now()}@cityreport.io`,
  cityAgency: "CityReport Internal Validation",
  roleTitle: "QA Operator",
  priorityDomain: "potholes",
  notes: `[lead-capture probe ${stamp}]`,
  source: "homepage",
  website: "",
};

async function run() {
  const result = {
    generated_at_utc: stamp,
    execute_write: executeWrite,
    endpoint,
    payload_preview: {
      fullName: payload.fullName,
      workEmail: payload.workEmail,
      cityAgency: payload.cityAgency,
      roleTitle: payload.roleTitle,
      priorityDomain: payload.priorityDomain,
      notes: payload.notes,
      source: payload.source,
      website: payload.website,
    },
  };

  if (!executeWrite) {
    result.mode = "dry_run";
    result.note = "Set EXECUTE_WRITE=1 to submit a live probe payload.";
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    result.mode = "live_write";
    result.response = {
      status: res.status,
      body: data,
    };
  } catch (error) {
    result.mode = "live_write";
    result.response = {
      status: "request_error",
      error: String(error?.message || error),
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

run();
NODE

{
  echo "# Lead Capture Probe"
  echo
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "App URL: $APP_URL"
  echo "Bundle URL: $BUNDLE_URL"
  echo "Supabase URL: $SUPABASE_URL"
  echo "Mode: $( [[ "$EXECUTE_WRITE" == "1" ]] && echo "live_write" || echo "dry_run" )"
  echo
  echo "## Output"
  echo
  echo '```json'
  cat "$NODE_OUT_FILE"
  echo '```'
} >"$OUT_FILE"

echo "$OUT_FILE"
