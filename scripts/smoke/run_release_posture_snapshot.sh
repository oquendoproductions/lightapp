#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT_DIR="$ROOT/docs/evidence/automation"
STAMP_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$OUT_DIR/release-posture-snapshot-${STAMP_UTC}.md"

mkdir -p "$OUT_DIR"

BUILD_LOG="$(mktemp "${TMPDIR:-/tmp}/release-build.XXXXXX.log")"
TEST_LOG="$(mktemp "${TMPDIR:-/tmp}/release-router-tests.XXXXXX.log")"
trap 'rm -f "$BUILD_LOG" "$TEST_LOG"' EXIT

set +e
(cd "$ROOT" && npm run build) >"$BUILD_LOG" 2>&1
BUILD_RC=$?

(cd "$ROOT" && node --test cloudflare/tenant-router/src/router.test.mjs cloudflare/tenant-router/src/index.test.mjs) >"$TEST_LOG" 2>&1
TEST_RC=$?
set -e

BUILD_STATUS="PASS"
[[ $BUILD_RC -ne 0 ]] && BUILD_STATUS="FAIL"

TEST_STATUS="PASS"
[[ $TEST_RC -ne 0 ]] && TEST_STATUS="FAIL"

{
  echo "# Release Posture Snapshot"
  echo
  echo "Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
  echo "Repo root: $ROOT"
  echo
  echo "## Summary"
  echo "- Build: \`$BUILD_STATUS\`"
  echo "- Tenant router tests: \`$TEST_STATUS\`"
  echo
  echo "## Build Output"
  echo '```text'
  cat "$BUILD_LOG"
  echo '```'
  echo
  echo "## Tenant Router Test Output"
  echo '```text'
  cat "$TEST_LOG"
  echo '```'
} >"$OUT_FILE"

echo "$OUT_FILE"

if [[ $BUILD_RC -ne 0 || $TEST_RC -ne 0 ]]; then
  exit 1
fi

