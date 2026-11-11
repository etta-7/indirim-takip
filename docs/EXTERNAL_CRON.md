# External cron (30-minute price checks on Vercel Hobby)

Vercel **Hobby** plans allow **at most one** [Vercel Cron](https://vercel.com/docs/cron-jobs) job per project. This repo keeps that single cron as a **daily backup** (`0 8 * * *` in `vercel-app/vercel.json`). **Regular 30-minute** price checks use an external scheduler that HTTP-calls the same endpoint Vercel Cron would hit.

**Production endpoint:** `https://indirim-takip-two.vercel.app/api/cron/check-prices`

## Authentication

The route accepts the shared secret in either form (see `vercel-app/app/api/cron/check-prices/route.ts`):

- `Authorization: Bearer <CRON_SECRET>`
- `X-Cron-Secret: <CRON_SECRET>`

`CRON_SECRET` must be set in **Vercel** (Production) and duplicated wherever the external scheduler runs.

## Recommended: GitHub Actions (every 30 minutes)

Workflow: [`.github/workflows/price-check-30m.yml`](../.github/workflows/price-check-30m.yml)

Schedule: `*/30 * * * *` (UTC). You can also run it manually from the **Actions** tab (**workflow_dispatch**).

### One-time: set `CRON_SECRET` on GitHub

The value must **exactly match** Vercel → Project → Settings → Environment Variables → `CRON_SECRET`.

**Dashboard:** Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → name `CRON_SECRET`, paste the same value as on Vercel.

**CLI (from a machine that knows the secret),** e.g. after `cd vercel-app && vercel env pull`:

```bash
# Example: read from pulled .env.local (never commit this file)
CRON_SECRET="$(grep '^CRON_SECRET=' vercel-app/.env.local | cut -d= -f2- | tr -d '\"')"
gh secret set CRON_SECRET --repo etta-7/indirim-takip --body "$CRON_SECRET"
```

Cloud agents cannot read Vercel secrets; a coordinator or your self-hosted runner must run the above if you use CLI.

### Manual test

```bash
curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://indirim-takip-two.vercel.app/api/cron/check-prices"
```

Expected: JSON with `ok_count`, `failed_count`, `last_run`.

## Optional backup: Oracle VM (systemd timer)

If you prefer not to rely on GitHub Actions, use [`scripts/oracle-cron-curl.sh`](../scripts/oracle-cron-curl.sh) on the Oracle host (or any Linux box with outbound HTTPS).

1. Put the secret in a root-only file, e.g. `/etc/indirim-takip/cron-secret` (mode `600`).
2. Export or pass env:

```bash
export CRON_SECRET="$(cat /etc/indirim-takip/cron-secret)"
export CRON_URL="https://indirim-takip-two.vercel.app/api/cron/check-prices"
/opt/indirim-takip/scripts/oracle-cron-curl.sh
```

**Example systemd user unit** (`/etc/systemd/system/indirim-takip-cron.service`):

```ini
[Unit]
Description=Indirim Takip Vercel price check (curl)

[Service]
Type=oneshot
EnvironmentFile=-/etc/indirim-takip/cron.env
ExecStart=/opt/indirim-takip/scripts/oracle-cron-curl.sh
```

`cron.env` (mode `600`):

```bash
CRON_SECRET=...
CRON_URL=https://indirim-takip-two.vercel.app/api/cron/check-prices
```

**Timer** (`/etc/systemd/system/indirim-takip-cron.timer`):

```ini
[Unit]
Description=Indirim Takip price check every 30 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now indirim-takip-cron.timer
```

You can run **both** GitHub Actions and the Oracle timer; the API is idempotent for scheduled runs (re-checks all products). Avoid hammering more often than every few minutes.

## Vercel-side cron (daily only)

`vercel-app/vercel.json` keeps one cron so Hobby deploys do not fail:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-prices",
      "schedule": "0 8 * * *"
    }
  ]
}
```

That run is optional redundancy if GitHub Actions is healthy.
