#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache}"
export npm_config_cache="${NPM_CONFIG_CACHE}"
export HOME="${HOME:-/tmp/supabase-home}"
mkdir -p "${HOME}"

if [[ -f "${ROOT_DIR}/.env.supabase.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.supabase.local"
  set +a
elif [[ -f "${ROOT_DIR}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/.env.local"
  set +a
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Add it to .env.supabase.local or .env.local." >&2
  exit 1
fi

cd "${ROOT_DIR}"
npx supabase "$@"
