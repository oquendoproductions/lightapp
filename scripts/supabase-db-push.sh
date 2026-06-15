#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="${ROOT_DIR}/scripts/run-supabase.sh"

ARGS=(db push --workdir "${ROOT_DIR}" --linked --include-all --yes)

if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  ARGS+=(-p "${SUPABASE_DB_PASSWORD}")
fi

"${RUNNER}" "${ARGS[@]}"
