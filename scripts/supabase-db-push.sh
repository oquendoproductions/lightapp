#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="${ROOT_DIR}/scripts/run-supabase.sh"

load_env_file() {
  local env_file="$1"
  local line key value

  [[ -f "${env_file}" ]] || return 0

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue

    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

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

ARGS=(db push --workdir "${ROOT_DIR}" --linked --include-all --yes)

if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  ARGS+=(-p "${SUPABASE_DB_PASSWORD}")
fi

bash "${RUNNER}" "${ARGS[@]}"
