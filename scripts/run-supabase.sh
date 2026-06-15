#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache}"
export npm_config_cache="${NPM_CONFIG_CACHE}"
export HOME="${SUPABASE_CLI_HOME:-${ROOT_DIR}/.tmp/supabase-home}"
export XDG_CONFIG_HOME="${HOME}/.config"
mkdir -p "${HOME}" "${XDG_CONFIG_HOME}"

load_env_file() {
  local env_file="$1"
  local line key value

  [[ -f "${env_file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # Trim surrounding quotes if the whole value was quoted intentionally.
    if [[ "${value}" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "${value}" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    export "${key}=${value}"
  done < "${env_file}"
}

if [[ -f "${ROOT_DIR}/.env.supabase.local" ]]; then
  load_env_file "${ROOT_DIR}/.env.supabase.local"
elif [[ -f "${ROOT_DIR}/.env.local" ]]; then
  load_env_file "${ROOT_DIR}/.env.local"
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN. Add it to .env.supabase.local or .env.local." >&2
  exit 1
fi

cd "${ROOT_DIR}"
npx supabase "$@"
