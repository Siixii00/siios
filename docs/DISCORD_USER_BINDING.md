# Discord 用戶身份綁定功能

## 📋 功能概述

這個功能讓 AI 角色能夠識別 Discord 用戶的身份，實現：
- ✅ 跨平台身份一致性
- ✅ 多機器人環境正確識別
- ✅ 個性化對話體驗
- ✅ 用戶特定的世界書和設定

## 🎯 解決的問題

### 問題場景
在 Discord 中：
- 一個頻道可能有多個機器人
- 不同機器人可能代表不同的 AI 角色
- 需要正確識別哪個用戶是誰

### 解決方案
通過用戶身份綁定：
```
Discord User ID (123456789) → PWA User (user-001)
```
AI 角色可以：
1. 知道這個 Discord 用戶對應 PWA 中的哪個用戶
2. 使用該用戶的特定設定和世界書
3. 在不同機器人之間保持身份一致

## 🔧 工作原理

### 1. 用戶綁定流程

```
PWA 中創建綁定
  ↓
存儲到 discordUserBindings 表
  {
    discord_user_id: "123456789",
    user_id: "user-001",
    character_id: "char-001", // 可選
    discord_username: "Alice",
    user_display_name: "愛麗絲"
  }
  ↓
Discord Bot Worker 接收訊息時查詢綁定
  ↓
根據綁定的 user_id 獲取用戶設定
  ↓
AI 生成個性化的回覆
```

### 2. 訊息處理流程

```javascript
// Discord Bot Worker 中的處理邏輯
async function handleDiscordEvent(event, env) {
    const message = event.d;
    
    // 🎯 核心功能：識別用戶身份
    const userBinding = await env.DB.prepare(`
        SELECT * FROM discordUserBindings
        WHERE discord_user_id = ?
    `).bind(message.author.id).first();

    let userId = null;
    let userDisplayName = message.author.username;

    if (userBinding) {
        // 用戶已綁定
        userId = userBinding.user_id;
        userDisplayName = userBinding.user_display_name;
        
        // AI 知道：這是 "愛麗絲" (user-001)
    } else {
        // 用戶未綁定，使用默認邏輯
    }

    // 生成回覆時包含用戶身份信息
    const aiResponse = await generateAIResponseWithContext(
        message, 
        characterId, 
        userId,      // 傳遞用戶 ID
        userDisplayName, // 傳遞用戶顯示名
        env
    );
}
```

### 3. 上下文構建

AI 會收到完整的用戶信息：

```javascript
// 系統訊息中包含用戶身份
{
    role: 'system',
    content: `[User Identity]
This user is identified as "愛麗絲" (User ID: user-001) from Discord.
Treat them consistently across all platforms.`
}

// 加載用戶特定的世界書
if (userId) {
    const userWorldInfo = await env.DB.prepare(`
        SELECT * FROM worldInfo
        WHERE user_id = ? AND enabled = 1
    `).bind(userId).all();
}

// 加載用戶的 User Mask（如果有）
if (userData && userData.mask) {
    systemMessages.push({
        role: 'system',
        content: `[User Mask]\n${userData.mask}`
    });
}
```

## 📊 數據結構

### discordUserBindings 表

```javascript
{
    discord_user_id: "123456789",  // Discord 用戶 ID（主鍵）
    user_id: "user-001",           // 對應的 PWA 用戶 ID
    character_id: "char-001",      // 可選：綁定的角色 ID
    discord_username: "Alice",     // Discord 用戶名
    user_display_name: "愛麗絲",    // 顯示名稱
    created_at: 1722508800000,
    updated_at: 1722508800000
}
```

### 索引
- `discord_user_id` (主鍵)
- `user_id` (索引)
- `character_id` (索引)

## 🎯 使用場景

### 場景 1：多機器人環境

**情況：**
- 頻道中有 3 個機器人：櫻花、小櫻、月光
- 用戶 Alice 發送訊息

**沒有綁定：**
```
Alice: 大家好
櫻花: 你好！
小櫻: 你好！
月光: 你好！
// 三個機器人都不知道 Alice 是誰
```

**有綁定：**
```
Alice: 大家好
櫻花: 愛麗絲，你好啊！今天過得怎麼樣？
小櫻: 愛麗絲姐姐好！
月光: 愛麗絲，歡迎回來～
// 所有機器人都認得愛麗絲，提供個性化的回覆
```

### 場景 2：用戶特定的世界書

**設定：**
```
用戶: 愛麗絲 (user-001)
世界書:
  - 名稱: 愛麗絲的喜好
  - 內容: 愛麗絲喜歡喝咖啡，最喜歡拿鐵
  - 關鍵詞: 喝, 飲料, 咖啡
```

**對話：**
```
愛麗絲: 我想喝東西
AI: (讀取用戶世界書) 愛麗絲，要不要喝拿鐵？我知道你最喜歡了！
```

### 場景 3：User Mask

**設定：**
```
User Mask: 我是愛麗絲，25 歲，軟體工程師，喜歡貓和咖啡
```

**對話：**
```
Discord 愛麗絲: 你還記得我嗎？
AI: 當然記得！你是愛麗絲，一位軟體工程師，最喜歡貓和咖啡對吧？
```

## 🚀 使用步驟

### 1. 在 PWA 中配置綁定

1. 打開「設定」→「Discord 整合」
2. 點擊「用戶身份綁定」
3. 點擊「新增綁定」
4. 填寫：
   - Discord User ID（右鍵用戶 → 複製 ID）
   - Discord 用戶名
   - 選擇對應的 PWA 用戶
   - 顯示名稱（選填）
5. 保存

### 2. 配置用戶特定的世界書（可選）

在「世界書」中：
1. 創建新的條目
2. 設定 user_id 為綁定的用戶 ID
3. 添加個性化的內容

### 3. 配置 User Mask（可選）

在「User 面具設定」中：
1. 創建或編輯用戶
2. 設定 User Mask（個人信息描述）

### 4. 開始使用

在 Discord 中：
- 綁定的用戶發送訊息
- AI 自動識別身份
- 提供個性化的回覆

## 💡 重要特性

### 1. 跨平台一致性

無論在哪裡對話：
- Discord
- PWA
- 其他平台（未來）

AI 都知道你是同一個人。

### 2. 多機器人支持

即使同一個頻道有多個機器人：
- 每個機器人都能正確識別用戶
- 不會混淆不同用戶
- 各自提供個性化的回覆

### 3. 優先級系統

用戶綁定的優先級：
```
1. 用戶特定的世界書（最高）
2. 角色特定的世界書
3. 全局世界書（最低）
```

### 4. 靈活配置

- 一個 Discord 用戶可以綁定一個 PWA 用戶
- 可以選擇綁定到特定角色（可選）
- 可以配置顯示名稱

## 🔍 如何獲取 Discord User ID

### 方法 1：開發者模式
1. Discord 設定 → 進階 → 開啟開發者模式
2. 右鍵點擊用戶 → 複製 ID

### 方法 2：使用機器人
```
!myid
機器人: 你的 Discord ID 是：123456789
```

## 📚 API 端點

### 查詢用戶綁定
```javascript
// Worker 中查詢
const binding = await env.DB.prepare(`
    SELECT * FROM discordUserBindings
    WHERE discord_user_id = ?
`).bind(discordUserId).first();
```

### 創建綁定
```javascript
await DiscordUserBindingDB.create({
    discord_user_id: "123456789",
    user_id: "user-001",
    discord_username: "Alice",
    user_display_name: "愛麗絲"
});
```

## 🎊 總結

用戶身份綁定功能讓你的 Discord Bot 變得更智能：

✅ **身份識別** - 正確識別 Discord 用戶對應的 PWA 用戶
✅ **個性化體驗** - 基於用戶設定提供定制化的回覆
✅ **多機器人支持** - 在多機器人環境中正確識別
✅ **跨平台一致** - 無論在哪裡，AI 都知道你是誰

**現在，你的 Discord Bot 可以真正"認識"用戶了！** 🚀