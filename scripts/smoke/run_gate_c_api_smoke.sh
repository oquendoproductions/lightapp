#!/usr/bin/env bash
set -euo pipefail

ROOT='/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web'
OUT_DIR="$ROOT/docs/evidence/automation"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/gate-c-api-smoke-${STAMP_UTC}.md"

mkdir -p "$OUT_DIR"

TENANT='ashtabulacity'
APP_URL='https://ashtabulacity.cityreport.io/'

BUNDLE_PATH="$(curl -sL "$APP_URL" | rg -o 'assets/index-[^"]+\.js' -m1 || true)"
if [[ -z "${BUNDLE_PATH:-}" ]]; then
  echo "Failed to resolve production bundle from $APP_URL" >&2
  exit 1
fi

BUNDLE_URL="https://ashtabulacity.cityreport.io/${BUNDLE_PATH}"
BUNDLE_TEXT="$(curl -sL "$BUNDLE_URL")"
SUPABASE_URL="$(printf '%s' "$BUNDLE_TEXT" | rg -o 'https://[a-z0-9]+\.supabase\.co' -m1 || true)"
SUPABASE_KEY="$(printf '%s' "$BUNDLE_TEXT" | rg -o 'sb_publishable_[A-Za-z0-9._-]+' -m1 || true)"

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_KEY:-}" ]]; then
  echo "Failed to extract SUPABASE_URL or SUPABASE_KEY from bundle $BUNDLE_URL" >&2
  exit 1
fi

NODE_OUT_FILE="/tmp/gate-c-api-smoke-${STAMP_UTC}.json"

SUPABASE_URL="$SUPABASE_URL" SUPABASE_KEY="$SUPABASE_KEY" TENANT="$TENANT" BUNDLE_URL="$BUNDLE_URL" node > "$NODE_OUT_FILE" <<'NODE'
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const TENANT = process.env.TENANT || "ashtabulacity";

async function req(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "x-tenant-key": TENANT,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function headStatus(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch (e) {
    return `error:${e?.message || e}`;
  }
}

(async () => {
  const stamp = new Date().toISOString();

  const endpointChecks = {
    apex: await headStatus("https://cityreport.io"),
    tenant: await headStatus("https://ashtabulacity.cityreport.io"),
    gmaps: await fetch("https://cityreport.io/gmaps", { method: "HEAD", redirect: "manual" })
      .then((r) => ({ status: r.status, location: r.headers.get("location") }))
      .catch((e) => `error:${e?.message || e}`),
  };

  const potholeSeedRes = await req("GET", "/rest/v1/potholes?select=id,lat,lng,ph_id&limit=1");
  const waterSeedRes = await req("GET", "/rest/v1/water_drain_incidents?select=incident_id,lat,lng,issue_type&limit=1");
  const potholeSeed = Array.isArray(potholeSeedRes.data) ? potholeSeedRes.data[0] : null;
  const waterSeed = Array.isArray(waterSeedRes.data) ? waterSeedRes.data[0] : null;

  let potholeInsert = { status: 0, data: { error: "no_seed" } };
  if (potholeSeed) {
    potholeInsert = await req(
      "POST",
      "/rest/v1/pothole_reports?select=*",
      [{
        pothole_id: potholeSeed.id,
        lat: Number(potholeSeed.lat),
        lng: Number(potholeSeed.lng),
        note: `[SMOKE_GATE_C_AUTOMATION ${stamp}] guest pothole submit probe`,
        reporter_user_id: null,
        reporter_name: "Smoke Test",
        reporter_email: "cityreport.io@gmail.com",
        reporter_phone: "555-010-2026",
      }],
      { Prefer: "return=representation" },
    );
  }

  let waterInsert = { status: 0, data: { error: "no_seed" } };
  if (waterSeed) {
    waterInsert = await req(
      "POST",
      "/rest/v1/reports",
      [{
        lat: Number(waterSeed.lat),
        lng: Number(waterSeed.lng),
        report_type: "other",
        report_quality: "bad",
        note: `[SMOKE_GATE_C_AUTOMATION ${stamp}] guest water/drain submit probe`,
        light_id: String(waterSeed.incident_id || ""),
        reporter_user_id: null,
        reporter_name: "Smoke Test",
        reporter_email: "cityreport.io@gmail.com",
        reporter_phone: "555-010-2026",
      }],
      { Prefer: "return=minimal" },
    );
  }

  const exportDetail = await req(
    "GET",
    "/rest/v1/export_incident_detail_v1?select=incident_id,domain,current_state,submitted_at,report_number&order=submitted_at.desc&limit=5",
  );

  const legalChecks = {
    terms: await headStatus("https://cityreport.io/legal/terms.html"),
    privacy: await headStatus("https://cityreport.io/legal/privacy.html"),
    governance: await headStatus("https://cityreport.io/legal/governance.html"),
  };

  const result = {
    generated_at_utc: stamp,
    tenant: TENANT,
    bundle_url: process.env.BUNDLE_URL || "",
    supabase_url: SUPABASE_URL,
    endpoint_checks: endpointChecks,
    legal_checks: legalChecks,
    seed_rows: {
      pothole: potholeSeed,
      water_drain: waterSeed,
    },
    guest_submit_checks: {
      pothole_insert: potholeInsert,
      water_drain_insert: waterInsert,
    },
    export_detail_check: exportDetail,
  };

  console.log(JSON.stringify(result, null, 2));
})();
NODE

{
  echo "# Gate C API Smoke"
  echo
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "App URL: $APP_URL"
  echo "Bundle URL: $BUNDLE_URL"
  echo "Supabase URL: $SUPABASE_URL"
  echo "Tenant key: $TENANT"
  echo
  echo "## Output"
  echo
  echo '```json'
  cat "$NODE_OUT_FILE"
  echo '```'
} > "$OUT_FILE"

echo "$OUT_FILE"
