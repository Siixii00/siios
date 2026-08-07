# Discord 測試環境設定指南

本指南將帶你從零開始建立完整的 Discord 測試環境。

## 第一階段：建立 Discord 測試伺服器

### 1. 建立測試伺服器

1. 開啟 Discord 應用程式
2. 左側伺服器列表點擊 `+` 按鈕
3. 選擇「建立」
4. 輸入伺服器名稱（建議：`Siios 測試伺服器`）
5. 選擇「建立伺服器」

### 2. 建立測試頻道

建立以下頻道結構：

```
📁 測試頻道
  💬 #一般測試          (預設頻道)
  💬 #ai-chat           (AI 對話測試)
  💬 #角色扮演          (角色扮演測試)
📁 管理
  🔒 #bot-日誌          (Bot 日誌)
  🔒 #綁定管理          (用戶綁定管理)
```

## 第二階段：建立 Discord Bot

### 1. 前往 Discord Developer Portal

1. 訪問：https://discord.com/developers/applications
2. 登入你的 Discord 帳號
3. 點擊右上角「New Application」

### 2. 建立應用程式

1. **Application Name**: `Siios Test Bot`
2. **Team**: 選擇個人帳號或團隊
3. 點擊「Create」

### 3. 建立 Bot 用戶

1. 左側選單選擇「Bot」
2. 點擊「Add Bot」
3. 確認建立

### 4. 取得 Bot Token

1. 在 Bot 頁面
2. 點擊「Reset Token」取得新的 Token
3. **⚠️ 重要：立即複製並安全保存 Token**（只會顯示一次）
   ```
   範例：MTk5NjI5MDkzODMxNjQ0Nzg0.Gk3mZQ.abc123...
   ```

### 5. 設定 Bot 權限

在 Bot 頁面，啟用以下 Intents：

**Privileged Gateway Intents:**
- ✅ PRESENCE INTENT
- ✅ SERVER MEMBERS INTENT  
- ✅ MESSAGE CONTENT INTENT

在「Bot Permissions」區域，確認 Bot 擁有：
- ✅ Read Messages/View Channels
- ✅ Send Messages
- ✅ Manage Messages
- ✅ Read Message History

### 6. 產生邀請連結

1. 左側選單選擇「OAuth2」→「URL Generator」
2. 選擇 Scopes：
   - ✅ bot
3. Bot Permissions 選擇：
   - ✅ Administrator（或自訂權限）
4. 複製底部的邀請連結

### 7. 將 Bot 加入測試伺服器

1. 在瀏覽器開啟剛才的邀請連結
2. 選擇你的測試伺服器
3. 點擊「Continue」→「Authorize」
4. 完成驗證

## 第三階段：取得必要資訊

### 1. 取得頻道 ID

在 Discord 中：

1. 前往「設定」→「進階」→啟用「開發者模式」
2. 右鍵點擊頻道 →「Copy ID」

記錄以下頻道 ID：

```
#一般測試:     123456789012345678
#ai-chat:      123456789012345679
#角色扮演:     123456789012345680
```

### 2. 取得伺服器 ID

右鍵點擊伺服器圖示 →「Copy ID」

```
伺服器 ID:     123456789012345677
```

### 3. 取得你的 Discord User ID

1. 右鍵點擊自己的頭像
2. 選擇「Copy User ID」

```
你的 User ID:  123456789012345681
```

## 第四階段：設定 Cloudflare Worker

### 1. 建立專案結構

```bash
# 在專案根目錄
mkdir -p tests/discord-test
cd tests/discord-test
```

### 2. 建立 wrangler.toml

```toml
name = "siios-discord-bot"
main = "../../scripts/discord-bot-worker.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "siios-discord-db"
database_id = "your-database-id"

[vars]
AI_API_URL = "https://your-ai-api.com"
AI_MODEL = "gpt-3.5-turbo"
```

### 3. 部署 D1 Database

```bash
# 建立 D1 資料庫
wrangler d1 create siios-discord-db

# 記錄返回的 database_id
# 範例：database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 更新 wrangler.toml 中的 database_id
```

### 4. 設定環境變數

```bash
# 設定 Discord Bot Token
wrangler secret put DISCORD_BOT_TOKEN
# 輸入你的 Bot Token

# 設定 AI API Key
wrangler secret put AI_API_KEY
# 輸入你的 AI API Key
```

### 5. 初始化資料庫結構

建立 `schema.sql`：

```sql
-- 訊息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT,
    role TEXT,
    content TEXT,
    timestamp TEXT,
    metadata TEXT
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT,
    personality TEXT,
    scenario TEXT
);

-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    mask TEXT
);

-- 世界書表
CREATE TABLE IF NOT EXISTS worldInfo (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    keys TEXT,
    priority TEXT,
    enabled INTEGER DEFAULT 1,
    user_id TEXT,
    character_id TEXT
);

-- 全局設定表
CREATE TABLE IF NOT EXISTS globalSettings (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    keys TEXT,
    priority TEXT,
    enabled INTEGER DEFAULT 1
);

-- 全局禁用詞表
CREATE TABLE IF NOT EXISTS globalForbidden (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT,
    enabled INTEGER DEFAULT 1
);

-- Discord 用戶綁定表
CREATE TABLE IF NOT EXISTS discordUserBindings (
    discord_user_id TEXT PRIMARY KEY,
    user_id TEXT,
    character_id TEXT,
    user_display_name TEXT
);

-- Discord 頻道映射表
CREATE TABLE IF NOT EXISTS discord_channel_mappings (
    channel_id TEXT PRIMARY KEY,
    character_id TEXT
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_worldinfo_user ON worldInfo(user_id);
CREATE INDEX IF NOT EXISTS idx_worldinfo_character ON worldInfo(character_id);
```

執行遷移：

```bash
wrangler d1 execute siios-discord-db --file=./schema.sql
```

### 6. 部署 Worker

```bash
wrangler deploy
```

記錄部署後的 Worker URL：

```
https://siios-discord-bot.你的帳號.workers.dev
```

## 第五階段：設定 Webhook

### 1. 在 Discord Developer Portal 設定

1. 前往你的應用程式 →「General Information」
2. 複製「Application ID」
3. 前往「Interactions」→「Webhooks」
4. 設定 Webhook URL：
   ```
   https://siios-discord-bot.你的帳號.workers.dev/discord/webhook
   ```
5. 儲存變更

### 2. 驗證 Webhook

使用 curl 測試：

```bash
# 測試 PING 事件
curl -X POST https://siios-discord-bot.你的帳號.workers.dev/discord/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": 1
  }'
# 應該返回：{"type":1}

# 測試連接
curl https://siios-discord-bot.你的帳號.workers.dev/discord/webhook
# 應該返回：{"status":"ok"}
```

## 第六階段：測試功能

### 1. 測試基本對話

在 Discord 測試伺服器的 `#ai-chat` 頻道輸入：

```
你好！
```

Bot 應該會回應。

### 2. 測試角色扮演

在 PWA 中建立一個角色：

```javascript
// 在瀏覽器 Console 中執行
const db = await initDB();
await db.put('characters', {
    id: 'char-001',
    name: '測試角色',
    personality: '你是一個友善的助手。',
    scenario: '這是一個測試場景。'
});
```

### 3. 測試頻道映射

使用 API 設定頻道映射：

```bash
curl -X POST https://your-worker-url/discord/bind \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "YOUR_CHANNEL_ID",
    "character_id": "char-001"
  }'
```

### 4. 測試用戶綁定

在 Discord 中發送：

```
!bind char-001
```

Bot 會綁定你的 Discord 帳號到指定角色。

### 5. 查看對話歷史

```bash
curl "https://your-worker-url/discord/history?channel_id=YOUR_CHANNEL_ID&limit=10"
```

## 第七階段：監控和除錯

### 1. 查看即時日誌

```bash
wrangler tail
```

### 2. 查看 D1 Database

```bash
# 查看所有訊息
wrangler d1 execute siios-discord-db --command="SELECT * FROM messages LIMIT 10"

# 查看用戶綁定
wrangler d1 execute siios-discord-db --command="SELECT * FROM discordUserBindings"
```

### 3. 常見問題排除

**問題：Bot 沒有回應**

1. 檢查 Webhook 是否正確設定
2. 檢查 Bot Token 是否有效
3. 查看 Worker 日誌：`wrangler tail`
4. 檢查 Bot 權限是否足夠

**問題：AI 沒有回應**

1. 檢查 AI API URL 和 Key 是否正確
2. 檢查 API 配額是否用盡
3. 查看 Worker 錯誤日誌

**問題：資料庫連線失敗**

1. 檢查 D1 Database ID 是否正確
2. 確認 Schema 已正確執行
3. 檢查 Worker binding 名稱是否為 `DB`

## 測試清單

- [ ] Discord 測試伺服器已建立
- [ ] Bot 已建立並加入伺服器
- [ ] Bot Token 已安全保存
- [ ] 頻道 ID 已記錄
- [ ] Worker 已部署
- [ ] D1 Database 已建立
- [ ] Webhook 已設定
- [ ] 基本對話測試成功
- [ ] 角色映射測試成功
- [ ] 用戶綁定測試成功
- [ ] 日誌監控正常

## 下一步

測試完成後，你可以：

1. 將測試環境的設定遷移到生產環境
2. 在 PWA 的「Discord 整合」設定頁面配置連線
3. 開始使用完整的跨平台 AI 對話功能

## 安全提醒

⚠️ **重要安全事項：**

1. **永遠不要**將 Bot Token 提交到 Git
2. **永遠不要**在公開場合分享 Token
3. 定期重置 Token（建議每 90 天）
4. 使用環境變數儲存敏感資訊
5. 限制 Bot 權限至最低必要
6. 生產環境使用專用的 Discord Bot
