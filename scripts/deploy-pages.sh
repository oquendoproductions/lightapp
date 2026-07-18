#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache}"
export npm_config_cache="${NPM_CONFIG_CACHE}"

if [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.local"
  set +a
fi

if [[ -f "${ROOT_DIR}/.env.cloudflare.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.cloudflare.local"
  set +a
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN. Add it to .env.cloudflare.local or .env.local." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Missing CLOUDFLARE_ACCOUNT_ID. Add it to .env.cloudflare.local or .env.local." >&2
  exit 1
fi

PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT_NAME:-lightapp}"
DIST_DIR="${1:-dist}"
RUN_PAGES_STARTUP_SMOKE="${RUN_PAGES_STARTUP_SMOKE:-1}"
PAGES_STARTUP_SMOKE_URLS="${PAGES_STARTUP_SMOKE_URLS:-}"

cd "${ROOT_DIR}"
npm run build
DEPLOY_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "${DEPLOY_OUTPUT_FILE}"' EXIT

npx wrangler pages deploy "${DIST_DIR}" --project-name "${PROJECT_NAME}" 2>&1 | tee "${DEPLOY_OUTPUT_FILE}"

if [[ "${RUN_PAGES_STARTUP_SMOKE}" != "1" ]]; then
  exit 0
fi

PREVIEW_URL="$(perl -ne 'if (m{https://[A-Za-z0-9._-]+\.pages\.dev}) { print "$&\n"; exit 0 }' "${DEPLOY_OUTPUT_FILE}")"

SMOKE_TARGETS=()

if [[ -n "${PAGES_STARTUP_SMOKE_URLS}" ]]; then
  while IFS= read -r smoke_url; do
    smoke_url="$(printf '%s' "${smoke_url}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [[ -n "${smoke_url}" ]] && SMOKE_TARGETS+=("${smoke_url}")
  done < <(printf '%s' "${PAGES_STARTUP_SMOKE_URLS}" | tr ',' '\n')
elif [[ -n "${PREVIEW_URL}" ]]; then
  SMOKE_TARGETS+=("${PREVIEW_URL}")
fi

if [[ "${#SMOKE_TARGETS[@]}" -eq 0 ]]; then
  echo "Could not determine any startup smoke target URLs; skipping startup smoke." >&2
  exit 0
fi

for smoke_url in "${SMOKE_TARGETS[@]}"; do
  echo
  echo "Running startup smoke against ${smoke_url}"

  set +e
  node scripts/smoke/check_pages_startup.mjs "${smoke_url}"
  SMOKE_EXIT_CODE=$?
  set -e

  if [[ "${SMOKE_EXIT_CODE}" -eq 2 ]]; then
    echo "Startup smoke skipped for ${smoke_url}: no supported local browser executable found." >&2
    continue
  fi

  if [[ "${SMOKE_EXIT_CODE}" -ne 0 ]]; then
    echo "Startup smoke failed for ${smoke_url}" >&2
    exit "${SMOKE_EXIT_CODE}"
  fi
done
