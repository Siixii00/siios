# Discord Bot 自動讀取 PWA 設定說明

## 📋 總結

**好消息！你的 Discord 機器人不需要額外設定，它會自動讀取 PWA 中的所有設定！**

## ✅ 自動整合的內容

### 1. 世界書（World Info）
- ✅ **全局設定** - GlobalSettings 表中的所有條目
- ✅ **全局禁用詞** - GlobalForbidden 表中的禁用內容
- ✅ **角色特定設定** - 針對特定角色的世界書條目
- ✅ **關鍵詞觸發** - 根據關鍵詞自動插入相關內容
- ✅ **優先級系統** - front/middle/back 三個位置正確應用

### 2. 角色設定（Character）
- ✅ **人格設定** - character.personality 欄位
- ✅ **場景設定** - character.scenario 欄位
- ✅ **角色綁定** - 通過頻道映射自動使用對應角色

### 3. 對話上下文
- ✅ **統一對話歷史** - PWA 和 Discord 共享同一個對話
- ✅ **上下文連續性** - 在 Discord 中可以看到 PWA 的對話，反之亦然

## 🔧 工作原理

### Discord Bot Worker 的處理流程

```
接收 Discord 訊息
  ↓
查詢頻道映射（獲取角色 ID）
  ↓
從 D1 Database 讀取：
  - 角色設定（personality, scenario）
  - 世界書條目（globalSettings, globalForbidden, worldInfo）
  - 對話歷史（最近 10 條訊息）
  ↓
構建完整的 AI 請求：
  1. 添加世界書 front 優先級內容
  2. 添加角色人格設定
  3. 添加世界書 middle 優先級內容
  4. 添加對話歷史
  5. 添加用戶訊息
  6. 添加世界書 back 優先級內容
  ↓
調用 AI API 生成回覆
  ↓
發送到 Discord 並存儲到 D1
```

### 與 PWA 完全一致的邏輯

Discord Bot Worker 使用了與 PWA `api.js` 中的 `buildMessages()` 函數相同的邏輯：

```javascript
// Discord Bot Worker 中的代碼
async function generateAIResponseWithContext(message, characterId, env) {
    // 1. 獲取角色設定
    let characterData = await env.DB.prepare(`
        SELECT * FROM characters WHERE id = ?
    `).bind(characterId).first();

    // 2. 獲取世界書設定
    const worldInfoEntries = await loadWorldInfoContext(chatId, message.content, characterId, env);

    // 3. 構建系統訊息（與 PWA 一致）
    // - 世界書 front 優先級
    // - 角色人格設定
    // - 世界書 middle 優先級
    // - 對話歷史
    // - 世界書 back 優先級
    
    // 4. 調用 AI API
    // ...
}
```

## 📊 數據庫共享架構

```
┌─────────────────────────────────────────────────┐
│            D1 Database (Cloudflare)              │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │  characters  │  │ globalSettings │           │
│  │  - id        │  │ - name        │            │
│  │  - name      │  │ - content     │            │
│  │  - personality│  │ - priority    │            │
│  │  - scenario  │  │ - keys        │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │globalForbidden│  │   messages   │            │
│  │ - name       │  │ - chat_id    │            │
│  │ - content    │  │ - role       │            │
│  │ - enabled    │  │ - content    │            │
│  └──────────────┘  │ - metadata   │            │
│                    │   (source: discord/pwa)    │
│  ┌──────────────┐  └──────────────┘            │
│  │discord_channel│                             │
│  │   _mappings  │                              │
│  │ - channel_id │                              │
│  │ - character_id│                             │
│  └──────────────┘                              │
└─────────────────────────────────────────────────┘
         ↑                        ↑
         │                        │
    ┌────┴────┐              ┌────┴────┐
    │   PWA   │              │ Discord │
    │  (讀取)  │              │  Bot    │
    └─────────┘              │ (讀取)  │
                             └─────────┘
```

## 🎯 使用範例

### 場景 1：使用世界書設定

**在 PWA 中設定世界書：**
```
名稱：天氣資訊
內容：現在是冬天，天氣寒冷
關鍵詞：天氣, 冷, 熱
優先級：front
```

**在 Discord 中對話：**
```
用戶：今天天氣如何？
AI：(自動讀取世界書) 現在是冬天，天氣寒冷呢！記得多穿點衣服...
```

### 場景 2：使用角色人格

**在 PWA 中設定角色：**
```
角色名：櫻花
人格：溫柔體貼的日本女孩，說話時會使用敬語
場景：在東京的咖啡廳工作
```

**在 Discord 中映射頻道：**
```
頻道 ID: 1234567890 → 角色: 櫻花
```

**在 Discord 中對話：**
```
用戶：你好
櫻花：(使用角色人格) 您好！歡迎光臨咖啡廳，請問需要什麼呢？
```

### 場景 3：使用禁用詞

**在 PWA 中設定禁用詞：**
```
名稱：暴力內容
內容：不應該描述暴力或血腥場面
```

**在 Discord 中：**
```
用戶：描述一個戰鬥場面
AI：(自動應用禁用詞規則) 很抱歉，我不適合描述這類內容...
```

## 🔍 關鍵詞觸發機制

Discord Bot 完全支持世界書的關鍵詞觸發：

```javascript
// 檢查關鍵詞匹配
if (!entry.keys || entry.keys.split(',').some(key => 
    userMessage.toLowerCase().includes(key.trim().toLowerCase())
)) {
    // 匹配成功，添加到系統訊息
    entries.push({
        name: entry.name,
        content: entry.content,
        priority: entry.priority || 'middle',
        isForbidden: false
    });
}
```

### 觸發範例：

**世界書設定：**
```
名稱：貓咪資訊
內容：用戶養了一隻橘色的貓
關鍵詞：貓, 喵, kitty
```

**Discord 對話：**
```
用戶：我家的喵喵很可愛
AI：(觸發"貓咪資訊") 你的橘色貓咪真的很可愛呢！
```

## 🚀 部署步驟（無需額外設定）

### 1. 在 PWA 中配置世界書和角色
- 設定世界書條目
- 設定角色人格
- 設定禁用詞

### 2. 部署 Discord Bot Worker
```bash
# 無需額外設定，Worker 會自動讀取 D1 Database
wrangler deploy
```

### 3. 在 PWA 中配置頻道映射
- 打開「設定」→「Discord 整合」
- 設定頻道對應的角色
- 保存

### 4. 完成！
- 在 Discord 中對話時，AI 會自動使用所有 PWA 的設定
- 無需重複配置，完全自動同步

## 💡 重要提醒

### ✅ 優點
1. **無需重複設定** - 在 PWA 設定一次，Discord 自動使用
2. **統一管理** - 所有設定集中在 PWA，方便維護
3. **即時生效** - 修改 PWA 設定後，Discord 立即應用新設定
4. **跨平台一致** - 無論在哪個平台，AI 的表現都一致

### ⚠️ 注意事項
1. **數據庫必須共享** - Worker 必須連接到同一個 D1 Database
2. **環境變數** - 需要設置 AI_API_URL 和 AI_API_KEY
3. **頻道映射** - 如果要使用特定角色，需要配置頻道映射

## 📚 相關代碼位置

- **PWA 上下文構建**: `js/api.js` → `buildMessages()`
- **Discord 上下文構建**: `discord-bot-worker.js` → `generateAIResponseWithContext()`
- **世界書載入**: `discord-bot-worker.js` → `loadWorldInfoContext()`
- **數據庫結構**: `js/db.js` → `initDB()`

## 🎊 結論

**你的 Discord 機器人不需要任何額外設定！**

只要在 PWA 中設定好：
- ✅ 世界書（全局設定、禁用詞）
- ✅ 角色人格和場景
- ✅ 頻道映射（可選）

Discord Bot 就會自動讀取並使用這些設定，完全與 PWA 保持一致！