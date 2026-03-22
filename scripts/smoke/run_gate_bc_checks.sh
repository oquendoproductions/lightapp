#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web"
OUT_DIR="$REPO_ROOT/docs/evidence/automation"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/gate-bc-checks-$STAMP_UTC.md"

mkdir -p "$OUT_DIR"

{
  echo "# Automated Gate B/C Checks"
  echo
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo
  echo "## Gate B - Tenant Router Tests"
  echo
  echo '```text'
  node --test "$REPO_ROOT/cloudflare/tenant-router/src/router.test.mjs"
  echo '```'
  echo
  echo "## Gate C - Live Endpoint HTTP Checks"
  echo
  for url in \
    "https://cityreport.io" \
    "https://ashtabulacity.cityreport.io" \
    "https://cityreport.io/gmaps" \
    "https://cityreport.io/legal/terms.html" \
    "https://cityreport.io/legal/privacy.html" \
    "https://cityreport.io/legal/governance.html" \
    "https://legal.cityreport.io/terms.html" \
    "https://legal.cityreport.io/privacy.html" \
    "https://legal.cityreport.io/governance.html"; do
    echo "### $url"
    echo
    echo '```text'
    /usr/bin/curl -sSI "$url" | /usr/bin/sed -n '1,8p'
    echo '```'
    echo
  done

  echo "## Gate C - Local Legal Link Integrity"
  echo
  echo '```text'
  rg -n "href=\"/legal/(terms|privacy|governance|pilot-overview)\\.html\"" \
    "$REPO_ROOT/src/components/homepage" \
    "$REPO_ROOT/src/App.jsx"
  echo
  for f in terms privacy governance pilot-overview; do
    [ -f "$REPO_ROOT/public/legal/${f}.html" ] && echo "public/legal/${f}.html OK" || echo "public/legal/${f}.html MISSING"
    [ -f "$REPO_ROOT/dist/legal/${f}.html" ] && echo "dist/legal/${f}.html OK" || echo "dist/legal/${f}.html MISSING"
  done
  echo '```'
} > "$OUT_FILE"

echo "$OUT_FILE"
