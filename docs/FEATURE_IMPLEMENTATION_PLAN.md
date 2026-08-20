# 功能實現計畫 (按 Karpathy 指南)

此文檔按下列章節記錄本次功能實做路線圖：

1. **統一設定、世界書與記憶載入**
   - 讀取 `SettingsDB`, `WorldBookDB`, `MemoryDB`，放入 `AppContext`。
   - 所有子模組在 `init()` 時使用 `AppContext` 而非硬編碼。

2. **內容生成服務**
   - 在每個子模組 `generateX()` 內部呼叫 Server API，傳入 `AppContext`，回傳資料更新至 IndexedDB。
   - 未生成時先從本地資料庫讀取，如果不足則重新生成。

3. **記錄與備份**
   - 所有交互（like、comment、story）透過 `saveInteractionMemory()` 寫入 `memorystore`。
   - 建立 `BackupManager` 提供 `exportAll()` / `importAll()` 功能。

4. **防止刷新遺失**
   - `init()` 先讀取已存資料，若有即渲染；無則自動生成。
   - 每次更新時判斷 `hasChanges`，如有則自動執行備份。

5. **測試驗證**
   - Jest 單元測試：測試從 worldBook 讀取、內容生成、持久化。<br>
   - Playwright end‑to‑end：載入設定 → 產生內容 → 刷頁 -> 再次載入 -> 資料完整。

6. **UI – 備份/還原**
   - 在 `settings/mcp-settings.js` 加入「備份」頁面，導出 JSON；「還原」頁面上傳 JSON 並寫入 DB。

以上作為三個階段的執行順序：

- **階段 1**：實作統一載入與內容生成，並存檔至 IndexedDB。<br>
- **階段 2**：加上備份 / 還原 UI，確保刷新保留。<br>
- **階段 3**：完善測試並執行 CI 複合檢查。

---

## 參考設計文件
- [MCP Worker Template](docs/MCP_WORKER_TEMPLATE.md)
- [Karpathy Guidelines](https://github.com/???)

此計畫將在 GitHub 上下傳後供團隊參考。
