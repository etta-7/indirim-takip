# Register scheduled task: Indirim Takip price check every 30 minutes (current user).
# Requires scripts\windows-price-check.ps1 and ~/.indirim-takip-cron-secret

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent
$script = Join-Path $repo "scripts\windows-price-check.ps1"
if (-not (Test-Path $script)) {
    Write-Error "Cannot find windows-price-check.ps1 under $repo"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "IndirimTakipPriceCheck" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Scheduled task IndirimTakipPriceCheck registered (every 30 min, starts in ~2 min)."
