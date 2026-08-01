# Discord 整合功能說明

## 功能概述

這個 Discord 整合功能實現了 PWA 與 Discord 的雙向同步，讓 AI 角色可以在 Discord 上與你和你的朋友即時對話，所有對話內容會自動同步到 PWA 中。

## ⭐ 重要特性：完全整合 PWA 設定

**Discord Bot 會自動讀取並使用 PWA 中的所有設定，無需額外配置！**

✅ **自動讀取世界書** - 所有在世界書中的設定都會自動應用
✅ **自動讀取角色設定** - 角色的人格、場景設定都會被使用
✅ **關鍵詞觸發** - 世界書的關鍵詞觸發邏輯完全一致
✅ **優先級系統** - front/middle/back 優先級正確應用
✅ **禁用詞過濾** - 全局禁用詞會自動生效

## 核心特性

✅ **公開頻道對話** - AI 角色可以在指定的 Discord 頻道中回覆訊息
✅ **對話歷史記錄** - 所有對話都會存儲到統一的數據庫，PWA 和 Discord 共享同一個對話歷史
✅ **Slash Commands** - 支持 Discord 斜線命令進行各種操作
✅ **角色映射** - 不同的頻道可以映射到不同的 AI 角色
✅ **即時同步** - Discord 和 PWA 的對話實時同步

## 架構說明

```
用戶在 Discord 發送訊息
  ↓
Discord Bot Worker 接收
  ↓
存儲到 D1 Database（與 PWA 共享）
  ↓
調用 AI API 生成回覆
  ↓
發送回覆到 Discord
  ↓
PWA 可以查看完整的對話歷史
```

## 設置步驟

### 1. 創建 Discord Bot

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊 "New Application" 創建新應用
3. 在應用設置中：
   - 記下 **Application ID**
   - 在 "Bot" 頁面創建 Bot 並記下 **Token**
4. 在 "OAuth2" 頁面：
   - 勾選 `bot` 和 `applications.commands` 權限
   - 在 Bot 權限中勾選：
     - Send Messages
     - Read Messages
     - Read Message History
     - Use Slash Commands
   - 複製邀請鏈接並邀請 Bot 到你的伺服器

### 2. 生成 Discord Bot Worker

1. 在 Siios PWA 中打開「神秘門」應用
2. 選擇「Discord 整合」分類
3. 選擇以下工具：
   - 發送 Discord 訊息
   - 獲取 Discord 對話歷史
   - 獲取 Discord 用戶資訊
   - 列出 Discord 頻道
4. 點擊「生成程式碼」
5. 下載生成的 Worker 代碼

### 3. 部署到 Cloudflare

```bash
# 解壓下載的 ZIP 檔案
cd siios-mcp-worker

# 安裝依賴
npm install

# 登入 Cloudflare
wrangler login

# 設置環境變數
wrangler secret put DISCORD_BOT_TOKEN
# 輸入你的 Discord Bot Token

wrangler secret put AI_API_URL
# 輸入你的 AI API URL（如 https://api.openai.com）

wrangler secret put AI_API_KEY
# 輸入你的 AI API Key

# 創建 D1 Database
wrangler d1 create siios-discord-db

# 部署
npm run deploy
```

### 4. 配置 Discord Webhooks（可選）

如果要實現實時接收 Discord 事件：

1. 在 Discord Developer Portal 中找到你的應用
2. 在 "General Information" 頁面設置 **Interactions Endpoint URL**
   - 填入你的 Worker URL + `/discord/webhook`
   - 例如：`https://your-worker.workers.dev/discord/webhook`
3. 在 "Interactions" 頁面設置 Slash Commands

### 5. 在 PWA 中配置

1. 打開 Siios PWA
2. 進入「設定」→「Discord 整合」
3. 填入：
   - Discord Bot Token
   - Worker URL
   - 頻道映射（選填）
4. 點擊「測試連接」確認設置正確
5. 點擊「保存設定」

## 使用方式

### 在 Discord 中使用

**普通對話：**
```
用戶：今天天氣如何？
AI：(自動回覆) 台北現在天氣晴朗，氣溫 25°C...
```

**Slash Commands：**
```
/history - 查看對話歷史
/switch [角色名] - 切換 AI 角色
/help - 查看幫助信息
```

### 在 PWA 中查看

所有在 Discord 中的對話都會自動同步到 PWA：

1. 打開「聊天」應用
2. 找到對應的對話（頻道名作為對話名稱）
3. 可以看到完整的對話歷史，包括 Discord 用戶的訊息和 AI 的回覆

## 數據結構

### Messages 表
```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT,  -- Discord channel_id
    role TEXT,     -- 'user' or 'assistant'
    content TEXT,
    timestamp TEXT,
    metadata TEXT  -- JSON: { source: 'discord', author: 'username', ... }
);
```

## API 端點

Worker 提供以下 API 端點：

### POST /discord/send
發送訊息到 Discord 頻道
```json
{
    "channel_id": "1234567890",
    "content": "Hello from PWA!",
    "character_id": "char-001"
}
```

### GET /discord/history
獲取頻道的對話歷史
```
GET /discord/history?channel_id=1234567890&limit=50
```

### POST /discord/webhook
接收 Discord 事件（由 Discord 自動調用）

### POST /sync/pwa
從 PWA 同步訊息到 Discord
```json
{
    "chat_id": "chat-001",
    "message": "用戶在 PWA 發送的訊息",
    "role": "user",
    "discord_user_id": "1234567890"
}
```

## 安全性考慮

1. **驗證 Discord 簽名** - Worker 會驗證來自 Discord 的請求簽名
2. **環境變數加密** - Bot Token 和 API Key 存儲在 Cloudflare Secrets
3. **權限控制** - Bot 只具有必要的最小權限

## 故障排除

### Bot 沒有回覆
- 檢查 Bot 是否在線（在 Discord 中查看）
- 確認 Bot 有正確的權限
- 檢查 Worker 日誌：`npm run tail`

### 無法發送訊息
- 確認 Bot Token 正確
- 確認頻道 ID 正確
- 檢查 Bot 是否在該頻道中

### 對話歷史不同步
- 檢查 D1 Database 連接
- 確認 Worker URL 正確
- 查看 Worker 日誌錯誤信息

## 未來功能

- [ ] 私訊支持
- [ ] 多角色自由切換
- [ ] 豐富訊息格式（Embed、附件等）
- [ ] 語音頻道支持
- [ ] 權限精細控制
- [ ] Web Dashboard

## 技術支持

如有問題，請查看：
- Worker 日誌：`wrangler tail`
- Discord Developer Portal 文檔
- Cloudflare Workers 文檔