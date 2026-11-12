#!/usr/bin/env bash
# Trigger production price check via GitHub Actions (needs gh logged in as a user with workflow write).
set -euo pipefail
REPO="${REPO:-etta-7/indirim-takip}"
gh workflow run price-check-30m.yml --repo "$REPO"
echo "Triggered. Watch: https://github.com/${REPO}/actions/workflows/price-check-30m.yml"
