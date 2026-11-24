# Hachi Tech POS - Automated ADB Setup for Windows
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   HACHI TECH POS - ANDROID USB REAL-TIME PAYMENT SETUP   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ToolsDir = Join-Path $PSScriptRoot "..\tools"
$PlatformToolsDir = Join-Path $ToolsDir "platform-tools"
$AdbExe = Join-Path $PlatformToolsDir "adb.exe"

# 1. Check if ADB already in PATH or in local folder
$HasAdb = $false
try {
    $null = Get-Command adb -ErrorAction Stop
    $HasAdb = $true
    Write-Host "[✓] Found system ADB in PATH." -ForegroundColor Green
} catch {
    if (Test-Path $AdbExe) {
        $HasAdb = $true
        Write-Host "[✓] Found local ADB at $AdbExe." -ForegroundColor Green
    }
}

# 2. Download standalone Google Platform Tools if needed
if (-not $HasAdb) {
    Write-Host "[i] ADB not found. Downloading official Google Android Platform Tools (~10MB)..." -ForegroundColor Yellow
    if (-not (Test-Path $ToolsDir)) {
        New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
    }
    
    $ZipPath = Join-Path $ToolsDir "platform-tools.zip"
    $Url = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
    
    Invoke-WebRequest -Uri $Url -OutFile $ZipPath
    Write-Host "[✓] Download complete. Extracting..." -ForegroundColor Green
    
    Expand-Archive -Path $ZipPath -DestinationPath $ToolsDir -Force
    Remove-Item $ZipPath -Force
    Write-Host "[✓] Extracted to $PlatformToolsDir" -ForegroundColor Green
}

# 3. Check Phone Connection
Write-Host "`n[i] Checking connected Android devices via USB..." -ForegroundColor Cyan
$AdbCmd = if (Test-Path $AdbExe) { $AdbExe } else { "adb" }

& $AdbCmd devices

Write-Host "`n----------------------------------------------------------" -ForegroundColor Yellow
Write-Host "👉 IMPORTANT ON YOUR PHONE:" -ForegroundColor White
Write-Host "1. Enable 'Developer Options' on your Android Phone (Settings > About Phone > Tap 'Build Number' 7 times)." -ForegroundColor Gray
Write-Host "2. Turn on 'USB Debugging' in Settings > Developer Options." -ForegroundColor Gray
Write-Host "3. When connected to this laptop, a popup will appear: Tap 'ALWAYS ALLOW FROM THIS COMPUTER'." -ForegroundColor Gray
Write-Host "----------------------------------------------------------`n" -ForegroundColor Yellow

# 4. Launch Listener
Write-Host "[⚡] Starting Real-Time USB Payment Listener..." -ForegroundColor Green
node (Join-Path $PSScriptRoot "adb-payment-listener.js")
