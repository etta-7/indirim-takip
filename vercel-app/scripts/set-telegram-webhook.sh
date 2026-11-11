#!/usr/bin/env bash
# Register Telegram webhook for the Vercel deployment.
# Usage: ./scripts/set-telegram-webhook.sh https://YOUR_DOMAIN.vercel.app
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <vercel-app-base-url>"
  exit 1
fi

BASE_URL="${1%/}"
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
