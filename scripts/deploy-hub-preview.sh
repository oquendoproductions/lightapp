#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRODUCTION_ENV_FILE="${ROOT_DIR}/.env.local"
CLOUDFLARE_ENV_FILE="${ROOT_DIR}/.env.cloudflare.local"
PROJECT_NAME="${CLOUDFLARE_HUB_PREVIEW_PAGES_PROJECT_NAME:-cityreport-hub-staging}"
HUB_TENANT_KEY="${HUB_PREVIEW_TENANT_KEY:-testcity1}"

if [[ ! -f "${PRODUCTION_ENV_FILE}" ]]; then
  echo "Missing .env.local with the production application configuration." >&2
  exit 1
fi

if [[ ! -f "${CLOUDFLARE_ENV_FILE}" ]]; then
  echo "Missing .env.cloudflare.local with Cloudflare deployment credentials." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${PRODUCTION_ENV_FILE}"
# shellcheck disable=SC1090
source "${CLOUDFLARE_ENV_FILE}"
set +a

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Production Supabase variables are missing from .env.local." >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Cloudflare deployment credentials are missing from .env.cloudflare.local." >&2
  exit 1
fi

export VITE_HUB_PREVIEW_TENANT_KEY="${HUB_TENANT_KEY}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache}"
export npm_config_cache="${NPM_CONFIG_CACHE}"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-/tmp/cityreport-wrangler-config}"

cd "${ROOT_DIR}"
npm run build
npx wrangler pages deploy dist --project-name "${PROJECT_NAME}" --branch staging

echo
echo "Hub preview deployment complete. It uses the production backend and opens directly as the ${HUB_TENANT_KEY} hub."
