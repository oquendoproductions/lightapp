#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache}"
export npm_config_cache="${NPM_CONFIG_CACHE}"

if [[ -f "${ROOT_DIR}/.env.cloudflare.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.cloudflare.local"
  set +a
elif [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.local"
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

cd "${ROOT_DIR}"
npm run build
npx wrangler pages deploy "${DIST_DIR}" --project-name "${PROJECT_NAME}"
