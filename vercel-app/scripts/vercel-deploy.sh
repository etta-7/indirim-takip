#!/usr/bin/env bash
# Production deploy from vercel-app (requires Vercel CLI: npm i -g vercel, vercel login).
# GitHub-linked projects usually auto-deploy on push to main — use this for manual/coordinator runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel && vercel login"
  exit 1
fi

vercel deploy --prod "$@"
