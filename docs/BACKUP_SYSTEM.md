# SXIOS 資料備份與還原系統

## 概述

SXIOS 提供完整的資料備份與還原功能，支援三種備份方式：

1. **本地 JSON 備份** - 直接下載 JSON 檔案到手機/電腦
2. **GitHub 雲端備份** - 自動上傳到私人 GitHub 倉庫
3. **Google Drive 備份** - 保存到 Google Drive 應用程式專用資料夾

## 功能特點

### 🔄 完整資料匯出

備份包含以下所有資料：

- 聊天室設定 (chats)
- 聊天訊息 (messages)
- 角色設定 (characters)
- 用戶面具 (users)
- 世界書設定 (globalSettings, globalForbidden, theaterSettings, keywordSettings)
- 記憶系統資料 (memories)
- Wiki 記錄 (wikiRecords)
- 健康記錄 (health)
- MCP 工具設定 (mcpConfigs)
- 活動記錄 (activities)
- 應用程式設定 (settings)

### 📥 本地 JSON 備份

最基礎、最可靠的備份方式：

1. 進入「設定」→「資料備份與還原」
2. 點擊「下載備份檔案 (JSON)」
3. 檔案會自動下載為 `siios-backup-YYYY-MM-DD.json`

**優點**：
- 不需要任何網路服務
- 完全離線可用
- 可以手動傳輸到任何裝置

### 🔐 GitHub 雲端備份

使用 GitHub 私人倉庫作為雲端儲存：

#### 設定步驟

1. 前往 [GitHub Settings](https://github.com/settings/tokens)
2. 建立 Personal Access Token
   - 勾選 `repo` 權限
3. 在 SXIOS 中輸入 Token
4. 系統會自動建立 `siios-backup` 私人倉庫

#### 備份內容

- 檔案名稱：`siios-backup.json`
- 儲存位置：私人倉庫根目錄
- 每次備份會更新同一個檔案（保留歷史版本）

### ☁️ Google Drive 備份

使用 Google Drive 作為備份儲存：

#### 設定步驟

1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 建立 OAuth 2.0 用戶端 ID
   - 應用程式類型：Web 應用程式
   - 已授權的重新導向 URI：你的 PWA 網址
3. 在 SXIOS 中使用 Google 帳戶登入或手動輸入 Access Token

#### 儲存位置

- 檔案名稱：`siios-backup.json`
- 儲存位置：應用程式專用資料夾 (`appDataFolder`)
- 使用者無法直接在 Google Drive 介面看到，但可透過 API 存取

## 還原流程

### 從本地檔案還原

1. 進入「設定」→「資料備份與還原」
2. 點擊「從檔案還原」
3. 選擇之前下載的 JSON 備份檔案
4. 確認還原

### 從 GitHub 還原

1. 確保已連接 GitHub
2. 點擊「從 GitHub 還原」
3. 確認還原

### 從 Google Drive 還原

1. 確保已連接 Google Drive
2. 點擊「從 Google Drive 還原」
3. 確認還原

## 自動備份

啟用自動備份後，系統會定期自動執行備份：

1. 進入「設定」→「資料備份與還原」
2. 開啟「啟用自動備份」
3. 預設每 24 小時執行一次

自動備份會同時執行：
- 本地 JSON 下載（如果瀏覽器支援）
- GitHub 上傳（如果已連接）
- Google Drive 上傳（如果已連接）

## 資料合併策略

還原時採用**合併策略**，不會刪除現有資料：

- **新資料**：直接新增
- **現有資料**：合併更新（優先保留較新的版本）
- **衝突處理**：以備份資料為主，但保留本地 ID

## 安全性

### GitHub 備份

- 使用私人倉庫，只有你看得見
- Token 儲存在瀏覽器 IndexedDB，不會上傳到任何地方
- 建議定期更新 Token

### Google Drive 備份

- 使用應用程式專用資料夾，其他應用程式無法存取
- 需要 OAuth 授權，你隨時可以撤銷
- Access Token 有有效期限，過期需重新授權

## 最佳實踐

1. **三重備份**：同時啟用本地、GitHub、Google Drive 三種備份
2. **定期手動備份**：在重要對話結束後手動執行一次備份
3. **驗證備份**：偶爾下載 JSON 檔案檢查內容是否正確
4. **多裝置同步**：在新裝置登入後立即從雲端還原

## 疑難排解

### GitHub 連接失敗

- 確認 Token 有 `repo` 權限
- 確認 Token 未過期
- 嘗試重新建立 Token

### Google Drive 連接失敗

- 確認 OAuth 用戶端 ID 正確
- 確認重新導向 URI 設定正確
- 清除瀏覽器快取後重試

### 還原失敗

- 確認 JSON 檔案格式正確
- 確認檔案完整（沒有截斷）
- 查看瀏覽器 Console 錯誤訊息

## 技術實現

- **備份管理器**：`js/core/backup-manager.js`
- **設定頁面**：`js/apps/settings/backup-settings.js`
- **資料庫**：IndexedDB (idb 套件)
- **API**：GitHub REST API v3、Google Drive API v3

## 版本相容性

- 備份檔案包含版本號碼
- 未來版本升級時會自動轉換格式
- 建議每次大版本更新後重新建立備份