#!/usr/bin/env bash
# Helper script to add (or replace) production env vars in Vercel.
# Usage: ./scripts/add-prod-env.sh
# Will prompt for values if not passed inline. Safe for interview demo (no echo of secrets).

set -euo pipefail

VARS=(AWS_REGION AWS_S3_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY OPENAI_API_KEY LOCALE_DEFAULT LOCALE_SUPPORTED)

missing_cli() {
  if ! command -v vercel >/dev/null 2>&1; then
    echo "[error] vercel CLI not found. Install with: npm i -g vercel" >&2
    exit 1
  fi
}

add_or_update() {
  local name="$1"
  local current
  if vercel env ls 2>/dev/null | grep -q "^ *${name} "; then
    echo "[info] ${name} already exists in some environments. Re-adding for production (will create a new version)."
  fi
  local value
  if [[ -n "${!name:-}" ]]; then
    value="${!name}"
  else
    read -r -p "Enter value for ${name}: " value
  fi
  # Feed value non-interactively to avoid it appearing in shell history.
  printf "%s" "$value" | vercel env add "$name" production >/dev/null && echo "[ok] ${name} set for production" || echo "[fail] ${name}"
}

rotate_notice() {
  cat <<'EOF'
[notice] Remember: If any of these keys were exposed previously, rotate them after successful deploy.
  - AWS: create new access key -> update -> disable & delete old
  - OpenAI: create new key -> update -> delete old
EOF
}

main() {
  missing_cli
  echo "[step] Ensuring you're linked to the correct Vercel project..."
  vercel link --confirm >/dev/null 2>&1 || true
  echo "[step] Adding production env vars..."
  for v in "${VARS[@]}"; do
    add_or_update "$v"
  done
  rotate_notice
  echo "[done] Run: vercel env ls | grep -E 'AWS_|OPENAI_|LOCALE_' to verify."
}

main "$@"
