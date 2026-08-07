# Discord 測試環境快速設定腳本

$ErrorActionPreference = "Stop"

Write-Host "=== Discord 測試環境設定 ===" -ForegroundColor Cyan
Write-Host ""

# 步驟 1: 檢查必要工具
Write-Host "[步驟 1/5] 檢查必要工具..." -ForegroundColor Yellow

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js 未安裝" -ForegroundColor Red
    Write-Host "請先安裝 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command "wrangler" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Wrangler 未安裝" -ForegroundColor Red
    Write-Host "請執行: npm install -g wrangler" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 所有工具已安裝" -ForegroundColor Green
Write-Host ""

# 步驟 2: 建立配置檔案
Write-Host "[步驟 2/5] 檢查配置檔案..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env 檔案不存在，從 .env.example 複製..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ 已建立 .env 檔案" -ForegroundColor Green
    Write-Host "📝 請編輯 .env 檔案並填入實際值" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env 檔案已存在" -ForegroundColor Green
}

Write-Host ""

# 步驟 3: 建立 D1 Database
Write-Host "[步驟 3/5] 設定 D1 Database..." -ForegroundColor Yellow

$dbName = "siios-discord-db"
$dbExists = wrangler d1 list 2>$null | Select-String $dbName

if ($dbExists) {
    Write-Host "✅ D1 Database 已存在: $dbName" -ForegroundColor Green
} else {
    Write-Host "建立 D1 Database..." -ForegroundColor Yellow
    $result = wrangler d1 create $dbName 2>&1
    
    if ($result -match "database_id\s*=\s*`"([^`"]+)`"") {
        $databaseId = $matches[1]
        Write-Host "✅ D1 Database 已建立" -ForegroundColor Green
        Write-Host "Database ID: $databaseId" -ForegroundColor Cyan
        
        # 更新 wrangler.toml
        $tomlContent = Get-Content "wrangler.toml" -Raw
        $tomlContent = $tomlContent -replace "YOUR_DATABASE_ID_HERE", $databaseId
        Set-Content "wrangler.toml" -Value $tomlContent -NoNewline
        
        Write-Host "✅ 已更新 wrangler.toml" -ForegroundColor Green
    } else {
        Write-Host "⚠️  無法解析 database_id，請手動更新 wrangler.toml" -ForegroundColor Yellow
    }
}

Write-Host ""

# 步驟 4: 初始化資料庫結構
Write-Host "[步驟 4/5] 初始化資料庫結構..." -ForegroundColor Yellow

Write-Host "執行 schema.sql..." -ForegroundColor Yellow
$result = wrangler d1 execute $dbName --file=./schema.sql 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 資料庫結構已初始化" -ForegroundColor Green
} else {
    Write-Host "⚠️  資料庫初始化失敗: $result" -ForegroundColor Yellow
}

Write-Host ""

# 步驟 5: 設定環境變數
Write-Host "[步驟 5/5] 設定環境變數..." -ForegroundColor Yellow
Write-Host ""
Write-Host "請手動執行以下命令來設定環境變數：" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 設定 Discord Bot Token:" -ForegroundColor White
Write-Host "   wrangler secret put DISCORD_BOT_TOKEN" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. 設定 AI API Key:" -ForegroundColor White
Write-Host "   wrangler secret put AI_API_KEY" -ForegroundColor Yellow
Write-Host ""

Write-Host "=== 設定完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步：" -ForegroundColor White
Write-Host "1. 編輯 .env 檔案，填入實際的配置值" -ForegroundColor Yellow
Write-Host "2. 執行 wrangler secret put 設定敏感資訊" -ForegroundColor Yellow
Write-Host "3. 執行 wrangler deploy 部署 Worker" -ForegroundColor Yellow
Write-Host "4. 設定 Discord Webhook URL" -ForegroundColor Yellow
Write-Host ""
Write-Host "詳細步驟請參考：DISCORD_TEST_SETUP.md" -ForegroundColor Cyan
