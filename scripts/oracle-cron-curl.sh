#!/usr/bin/env bash
# Call production Vercel cron endpoint (for systemd timer on Oracle or elsewhere).
# Requires CRON_SECRET (and optional CRON_URL) in the environment.

set -euo pipefail

CRON_URL="${CRON_URL:-https://indirim-takip-two.vercel.app/api/cron/check-prices}"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is not set" >&2
  exit 1
fi

curl -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${CRON_URL}"
