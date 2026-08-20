# 完成功能清單與實施計畫

基於 `docs/FEATURE_IMPLEMENTATION_PLAN.md` 和 `IMPROVEMENTS.md`，結合實際程式碼狀態分析。

## 狀況摘要

### 1. Wiki 應用程式改進 (IMPROVEMENTS.md 標示為已完成，但未測試)

| 功能 | 實作檔案 | 狀態 | 問題 |
|------|---------|------|------|
| Undo/Redo | `js/apps/personal-wiki/history-manager.js` | 程式碼存在 ✅ | `saveStateForUndo()` 從未被呼叫 |
| 編號列表優化 | `updateAllNumberedLists()` in `index.js:781` | 程式碼存在 ✅ | 僅在 focus 時部分更新 |
| 並發保護 | `js/apps/personal-wiki/operation-queue.js` | 程式碼存在 ✅ | `SaveManager` 從未被匯入或使用 |
| Notion 速率限制 | `notionRateLimiter` in `index.js:1306` | 程式碼存在 ✅ | 未測試 Notion 資料庫欄位結構 |

### 2. 記憶保存 (`saveInteractionMemory`) 未整合的應用程式

**已匯入但從未呼叫 (8 個應用):**
- `bubbles/index.js` — 匯入但從未呼叫 (`saveInteractionMemory`)
- `youtube/index.js` — 匯入但從未呼叫
- `ao3/index.js` — 匯入但從未呼叫
- `dating/index.js` — 匯入但從未呼叫
- `lofter/index.js` — 匯入但從未呼叫
- `weverse/index.js` — 匯入但從未呼叫
- `theater/index.js` — 匯入但從未呼叫
- `twitch/index.js` — 匯入但從未呼叫

**未匯入 (15+ 個應用):**
- `drift-bottle/index.js`, `exchange-diary/index.js`, `daily-recipe/index.js`, `timetree/index.js`
- `kakaopay/index.js`, `payment-code/index.js`, `widget/index.js`
- `health/index.js`, `mcp-market/index.js`, `memory/index.js`, `album/index.js`

### 3. 資料重新整理保護

`FEATURE_IMPLEMENTATION_PLAN.md` 階段 4 指出應該在 `init()` 前先讀取已存資料。目前個別應用程式的資料載入行為不一致，缺乏統一機制。

---

## 實施計劃 (按優先順序)

### 階段 1: Wiki 應用程式完善 (3 天)

#### 任務 1.1: 修正 Undo/Redo — `saveStateForUndo` 整合
- **檔案:** `js/apps/personal-wiki/index.js`
- **目標:** 在每次編輯操作後呼叫 `saveStateForUndo()`
- **修改:**
  - 在 `titleInput.oninput` 處理函數中添加 `saveStateForUndo(record, '標題修改')`
  - 在 `bindBlockEvents` 中的 `el.oninput` 添加 `saveStateForUndo(record, '編輯區塊')`
  - 在 `el.onkeydown` Enter 鍵 (新增區塊) 添加 `saveStateForUndo(record, '新增區塊')`
  - 在 `el.onkeydown` Backspace 鍵 (刪除區塊) 添加 `saveStateForUndo(record, '刪除區塊')`
  - 在 `applyBlockType` 添加 `saveStateForUndo(record, '變更區塊類型')`
  - 在 `startDrag` onMouseUp (如果有變動) 添加 `saveStateForUndo`

#### 任務 1.2: 整合 OperationQueue / SaveManager
- **檔案:** `js/apps/personal-wiki/index.js`
- **目標:** 使用 `SaveManager` 替代當前的簡單 `debouncedSaveRecord`
- **修改:**
  - 匯入 `SaveManager` from `./operation-queue.js`
  - 將 `debouncedSaveRecord` 替換為 `SaveManager` 實例
  - 確保 `cancelPendingSave` 調用 `saveManager.cancelPendingSave(record.id)`

#### 任務 1.3: 測試 Wiki 功能
- 測試 Undo/Redo: 編輯標題 → Ctrl+Z → Ctrl+Y
- 測試編號列表: 插入/刪除項目後編號自動更新
- 測試 Notion 同步: 連接 Notion → 推送 → 拉取

### 階段 2: 整合 `saveInteractionMemory` 到應用程式 (5 天)

#### 任務 2.1: 已匯入但未呼叫的 8 個應用 (2 天)

對於每個應用程式，在適當的互動點添加 `saveInteractionMemory()` 呼叫：

**日期時間互動點 (示例):**
- **bubbles:** 發送氣泡訊息後
- **youtube:** 觀看影片後、按讚/留言後
- **ao3:** 閱讀同人作品後
- **dating:** 約會對話互動後
- **lofter:** 發布/閱讀文章後
- **weverse:** 社群發文/留言後
- **theater:** 生成劇本後
- **twitch:** 直播聊天互動後

**實施模式 (針對每個應用):**
```javascript
// 在互動完成後：
if (typeof saveInteractionMemory === 'function' && characterId) {
    await saveInteractionMemory({
        characterId: characterId,
        userId: userId || '',
        chatId: chatId || '',
        sourceApp: 'appName',
        sourceType: 'interaction',
        sourceSubtype: 'actionType',
        content: summaryContent,
        importance: 0.5
    });
}
```

#### 任務 2.2: 未匯入的應用程式 (3 天)

為以下應用程式添加 `saveInteractionMemory` 匯入和呼叫：
1. `drift-bottle` (漂流瓶發送/接收)
2. `exchange-diary` (日記交換)
3. `daily-recipe` (食譜生成)
4. `timetree` (日曆事件)
5. `kakaopay` / `payment-code` (付款互動)
6. `health` (健康記錄 — 可選，敏感資料)
7. `widget` (小工具互動)
8. `mcp-market` (MCP 工具使用)
9. `album` (相簿查看)

> **注意:** `health` 應用程式的敏感性資料需要特別審慎，只在使用者明確同意時保存。

### 階段 3: 跨裝置同步完善與測試 (4 天)

#### 任務 3.1: Cross-Device Sync 測試
- **檔案:** `js/core/cross-device/sync-manager.js`, `js/core/cross-device/github-sync.js`, `js/core/cross-device/encryption.js`
- **目標:** 驗證端對端加密流程
- **步驟:**
  1. 測試加密/解密循環 (生成金鑰 → 加密資料 → 解密驗證)
  2. 測試 GitHub Token 驗證功能
  3. 測試手動同步流程 (上傳 → 下載 → 合併)

#### 任務 3.2: 自動同步功能
- **目標:** 添加 `syncManager` 自動同步間隔機制
- **修改:**
  - 在 `sync-manager.js` 添加 `startAutoSync(interval)` 方法
  - 在 `cross-device-settings.js` 添加自動同步開關
  - 添加 `stopAutoSync()` 方法

### 階段 4: 備份系統測試與完善 (3 天)

#### 任務 4.1: 測試 BackupManager
- **檔案:** `js/core/backup-manager.js`
- **測試項目:**
  1. `exportAllData()` — 驗證所有資料庫資料被匯出
  2. `importAllData()` — 測試從 JSON 檔案還原
  3. `pushToGitHub()` — 測試 GitHub 備份推送
  4. `pullFromGitHub()` — 測試 GitHub 備份還原
  5. `uploadToGoogleDrive()` / `downloadFromGoogleDrive()` — 測試 Google Drive 同步

#### 任務 4.2: 修復潛在問題
- **檢查:** `getAllHealthRecords()` 使用 `database.getAll('health')` — 驗證資料庫 store 名稱
- **檢查:** `importAllData()` 中的資料合併邏輯
- **檢查:** 自動備份 (`checkAndAutoBackup`) 的觸發機制

### 階段 5: App Context 一致性 (2 天)

#### 任務 5.1: Apps not using `buildAppContext`
- **目標:** 確保所有生成內容的應用程式使用統一的 `buildAppContext`
- **檢查應用:** `exchange-diary`, `drift-bottle`(已有), `daily-recipe`, `timetree`, `kakaopay`, `payment-code`, `widget`, `health`, `mcp-market`, `memory`, `album`, `guzi-guide`, `theme-shop`, `emoji-shop`, `gift-shop`, `passkey`, `touch`
- **結果:** 以上 16 個應用均不生成 AI 文本內容，無需整合 `buildAppContext`。
  - 發現額外應用: `pomodoro` 生成 AI 鼓勵訊息和聊天回應，但使用自建 `getCharConfig()` + 手動 systemPrompt，**不使用** `buildAppContext`。整合時需注意: (1) pomodoro 使用 `SettingsDB` 存儲用戶名，與 `UsersDB` 不同； (2) fallback 角色 'default' 不存在於 CharactersDB； (3) 欄位映射差異 (`char.description` vs `char.scenario`)。待設計確認後再進行遷移。
  - `music` 應用: 匯入 `buildAppContext` 但從未呼叫，僅使用 Web Audio API 生成旋律，為 dead import。**已移除**。

  - **pomodoro 遷移已完成** (`js/apps/pomodoro/index.js`):
    - 匯入 `buildAppContext`
    - `generateAIEncouragement` 與 `generateAIResponse` 改用 `buildAppContext({ characterId: charConfig.id })` 构建 systemPrompt，並追加番茄鐘特定指令
    - 處理 fallback 角色 ('default' 不存在於 CharactersDB)：`buildAppContext` 產生空 systemPrompt，番茄鐘指令仍提供角色資訊
    - 移除不再使用的 `charPersonality`、`charBackground` 變數

#### 任務 5.2: 刷新保護
- **目標:** 確保所有應用程式在初始化時先從本地資料庫載入已存資料
- **檢查方式:** 逐一檢查各應用 `init()` 或 `render()` 函數，確保先載入本地資料
- **結果:** 待執行。需要逐一檢查各應用的 `render()` 是否在 UI 初始化前先載入本地資料。

---

## 檔案變更清單

### 新增/修改 (階段 1)
- `js/apps/personal-wiki/index.js` — 整合 `saveStateForUndo` 和 `SaveManager`

### 新增/修改 (階段 2)
- 8 個應用的 `index.js` — 添加 `saveInteractionMemory` 呼叫
- 9 個應用的 `index.js` — 添加 `saveInteractionMemory` 匯入和呼叫

### 新增/修改 (階段 3)
- `js/core/cross-device/sync-manager.js` — 添加自動同步
- `js/apps/settings/cross-device-settings.js` — 添加自動同步 UI

### 新增/修改 (階段 4)
- `js/core/backup-manager.js` — 根據測試結果修正

---

## 驗證清單

### Wiki 功能
- [x] Undo/Redo 正常工作 (Ctrl+Z / Ctrl+Y) — `saveStateForUndo` 已整合到 16 編輯操作
- [ ] 編號列表在插入/刪除後正確更新 — `updateAllNumberedLists()` 存在但未驗證行為
- [x] OperationQueue 防止並發寫入 — `SaveManager` + `OperationQueue` 已匯入使用
- [ ] Notion 同步不觸發 429 錯誤 — 未測試

### Memory 保存
- [x] 每個已整合的應用在互動後保存記憶 (8 個應用 + drift-bottle)
- [ ] 記憶可以在 Character Context 中檢索到 — 未測試

### 跨裝置同步
- [ ] 加密/解密流程測試
- [ ] GitHub Gist 上傳/下載測試
- [ ] 衝突解決 (Last-Write-Wins) 測試

### 備份系統
- [ ] 本地 JSON 匯出/匯入測試
- [ ] GitHub 備份/還原測試
- [ ] Google Drive 備份/還原測試
