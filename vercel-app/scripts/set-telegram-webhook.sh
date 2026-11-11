#!/usr/bin/env bash
# Register Telegram webhook for the Vercel deployment.
#
# Usage:
#   export TELEGRAM_BOT_TOKEN='...'
#   export VERCEL_URL='https://your-project.vercel.app'
#   ./scripts/set-telegram-webhook.sh
#
# Or pass the base URL explicitly:
#   ./scripts/set-telegram-webhook.sh https://your-project.vercel.app
set -euo pipefail

BASE_URL="${1:-${VERCEL_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: $0 [base-url]"
  echo "  Or set VERCEL_URL (e.g. https://indirim-takip.vercel.app)"
  exit 1
fi

BASE_URL="${BASE_URL%/}"
WEBHOOK_URL="${BASE_URL}/api/telegram"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "Set TELEGRAM_BOT_TOKEN in the environment."
  exit 1
fi

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"drop_pending_updates\": true}"

echo ""
echo "Webhook set to ${WEBHOOK_URL}"
