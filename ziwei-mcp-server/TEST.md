# 紫微斗數 MCP Server - 測試計劃

## 測試清單

### ✅ 階段 1: 本地開發測試

1. **安裝依賴**
   ```bash
   cd ziwei-mcp-server
   npm install
   ```

2. **啟動開發伺服器**
   ```bash
   npm run dev
   ```
   - 預期：伺服器啟動在 `http://localhost:8787`

3. **測試根端點**
   ```bash
   curl http://localhost:8787/
   ```
   - 預期：返回服務資訊 JSON

4. **測試工具列表**
   ```bash
   curl http://localhost:8787/tools
   ```
   - 預期：返回 `ziwei_analyze_birth` 工具定義

5. **測試排盤分析**
   ```bash
   curl -X POST http://localhost:8787/tools/call \
     -H "Content-Type: application/json" \
     -d '{
       "name": "ziwei_analyze_birth",
       "arguments": {
         "birth_date": "1990-05-15",
         "birth_time": "14:30",
         "birth_location": "台北市",
         "calendar_type": "solar",
         "gender": "male"
       }
     }'
   ```
   - 預期：返回命盤分析結果

### ✅ 階段 2: 部署測試

1. **部署到 Cloudflare Workers**
   ```bash
   npm run deploy
   ```
   - 預期：成功部署，獲得 Workers URL

2. **測試線上端點**
   - 重複階段 1 的步驟 3-5，但使用線上 URL

### ✅ 階段 3: 前端整合測試

1. **更新前端 endpoint**
   - 已更新 `js/core/ziwei-mcp-client.js` 的 endpoint

2. **測試角色設定**
   - 開啟 App，進入角色設定頁面
   - 填寫出生資訊（日期、時間、地點、性別）
   - 儲存角色
   - 預期：出生資訊正確儲存到 IndexedDB

3. **測試自動分析**
   - 啟動 App
   - 檢查 Console 日誌
   - 預期：看到「正在檢查命理快取」訊息
   - 若無快取，應自動調用 MCP Server

4. **測試 Wiki 顯示**
   - 開啟角色的 Wiki 頁面
   - 預期：看到「命理分析」區塊
   - 預期：顯示流年流月流日運勢

5. **測試 Chat 整合**
   - 開啟角色聊天
   - 預期：命理資訊注入到系統提示
   - 預期：AI 回應考慮運勢資訊

### ✅ 階段 4: 錯誤處理測試

1. **測試無法連線**
   - 暫停 Workers 或使用錯誤 URL
   - 預期：顯示「無法連線至分析服務」警告
   - 預期：使用過期快取（如果有）

2. **測試出生資訊不完整**
   - 建立缺少時間的角色
   - 預期：顯示提示訊息要求補充資訊

3. **測試性別缺失**
   - 建立沒有性別的角色
   - 預期：不執行分析，顯示提示

4. **測試跨日更新**
   - 模擬日期變更
   - 預期：自動重新分析

## 已知限制

### 目前使用模擬數據

`src/lib/ziwei-engine.ts` 中的排盤算法目前返回模擬結果。要使用真實排盤：

1. 安裝 `fortel-ziweidoushu` 和 `lunar-javascript`
2. 實作真實的農曆轉換
3. 實作真實的排盤邏輯
4. 實作四化飛星計算

參考 `.kilo/plans/1785847716490-ziwei-mcp-integration-plan.md` 第 273-300 行的實作範例。

## 測試日誌模板

```
日期：YYYY-MM-DD
測試項目：[項目名稱]
結果：✅ 通過 / ❌ 失敗
錯誤訊息：[如果有]
截圖：[選用]
備註：[其他觀察]
```