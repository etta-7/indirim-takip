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

Schedule: UTC **:05** and **:35** each hour (→ **:08** and **:38** Europe/Istanbul, UTC+3). You can also run it manually from the **Actions** tab (**workflow_dispatch**) or:

```bash
gh workflow run price-check-30m.yml --repo etta-7/indirim-takip
```

### Troubleshooting: no `schedule` runs (only manual runs)

1. **Confirm events:** Actions → *Price check (30m)* → filter runs by *Event: schedule*. Zero schedule runs after several hours usually means GitHub is not firing cron, not a bad `CRON_SECRET`.
2. **Enable the workflow:** Actions → *Price check (30m)* → if you see *This scheduled workflow is disabled*, click **Enable workflow**. Public repos auto-disable schedules after **60 days** without repo activity.
3. **Schedule actor:** GitHub ties scheduled runs to the user who last **pushed** an edit to the `schedule` / `cron` block. If only a bot (e.g. Cursor Agent) pushed that change, cron may not run until a human with write access merges or commits a cron edit. **Merge a small workflow change as the repo owner** to reset the actor.
4. **Repo settings:** Settings → Actions → General → allow Actions and this workflow; workflow file must be on the default branch (`main`).
5. **Immediate check (prod):** Run the workflow manually (step above) or `curl` the prod endpoint with `CRON_SECRET` (see Manual test).
6. **Cloud agent limits:** The Cursor GitHub integration can list runs but typically cannot `workflow run` or enable workflows (HTTP 403); use the owner account or Actions UI.

**Windows `IndirimTakipPriceCheck` task:** Disabling it only stops the local duplicate curl; it does **not** affect GitHub or Vercel cron.

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
