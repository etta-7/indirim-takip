# Trigger Vercel price check from Windows Task Scheduler (every 30 min).
# One-time: save CRON_SECRET (same as Vercel) to %USERPROFILE%\.indirim-takip-cron-secret (UTF-8, one line).

$ErrorActionPreference = "Stop"
$secretFile = Join-Path $env:USERPROFILE ".indirim-takip-cron-secret"
$url = "https://indirim-takip-two.vercel.app/api/cron/check-prices"

if (-not (Test-Path $secretFile)) {
    Write-Error "Missing $secretFile — paste your CRON_SECRET from Vercel (one line, no quotes)."
}

$secret = (Get-Content -Path $secretFile -Raw).Trim()
if (-not $secret) {
    Write-Error "CRON_SECRET file is empty."
}

try {
    $resp = Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $secret" } -Method Get -TimeoutSec 300
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Output "$ts ok_count=$($resp.ok_count) failed_count=$($resp.failed_count) last_run=$($resp.last_run)"
} catch {
    Write-Error $_
    exit 1
}
