# Discord 測試腳本

$ErrorActionPreference = "Stop"

# 載入環境變數
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

$workerUrl = $env:WORKER_URL
if (-not $workerUrl) {
    Write-Host "❌ 請在 .env 檔案中設定 WORKER_URL" -ForegroundColor Red
    exit 1
}

Write-Host "=== Discord 測試工具 ===" -ForegroundColor Cyan
Write-Host "Worker URL: $workerUrl" -ForegroundColor Yellow
Write-Host ""

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Description
    )
    
    Write-Host "測試: $Description" -ForegroundColor Yellow
    
    $url = "$workerUrl$Path"
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers -Body $jsonBody
        } else {
            $response = Invoke-RestMethod -Uri $url -Method $Method -Headers $headers
        }
        
        Write-Host "✅ 成功" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ 失敗: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 測試 1: Webhook PING
Write-Host "[測試 1] Webhook PING" -ForegroundColor Cyan
$result = Test-Endpoint -Method "POST" -Path "/discord/webhook" -Body @{type = 1} -Description "PING 驗證"
if ($result -and $result.type -eq 1) {
    Write-Host "   回應正確: $($result | ConvertTo-Json -Compress)" -ForegroundColor Green
}
Write-Host ""

# 測試 2: Webhook 狀態
Write-Host "[測試 2] Webhook 狀態" -ForegroundColor Cyan
$result = Test-Endpoint -Method "GET" -Path "/discord/webhook" -Description "Webhook 狀態檢查"
if ($result) {
    Write-Host "   狀態: $($result.status)" -ForegroundColor Green
}
Write-Host ""

# 測試 3: 發送訊息
$channelId = $env:DISCORD_TEST_CHANNEL_ID
if ($channelId) {
    Write-Host "[測試 3] 發送測試訊息" -ForegroundColor Cyan
    $body = @{
        channel_id = $channelId
        content = "這是一條測試訊息 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    $result = Test-Endpoint -Method "POST" -Path "/discord/send" -Body $body -Description "發送訊息到 Discord"
    if ($result -and $result.success) {
        Write-Host "   訊息 ID: $($result.result.messageId)" -ForegroundColor Green
    }
    Write-Host ""
    
    # 測試 4: 獲取歷史
    Write-Host "[測試 4] 獲取對話歷史" -ForegroundColor Cyan
    $result = Test-Endpoint -Method "GET" -Path "/discord/history?channel_id=$channelId&limit=5" -Description "獲取最近 5 條訊息"
    if ($result -and $result.success) {
        Write-Host "   找到 $($result.messages.Count) 條訊息" -ForegroundColor Green
        $result.messages | ForEach-Object {
            Write-Host "   - [$($_.author)]: $($_.content)" -ForegroundColor Gray
        }
    }
    Write-Host ""
} else {
    Write-Host "⚠️  跳過測試 3 和 4（未設定 DISCORD_TEST_CHANNEL_ID）" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "=== 測試完成 ===" -ForegroundColor Cyan
