# 聊天 MCP 自然整合指南

## 概述

MCP 工具現在會**自動**在聊天中被觸發，使用者不需要手動開啟，AI 會自然地用角色身分來協助和關心使用者。

## 自動觸發機制

### 1. 自動偵測需求

系統會在每次使用者發送訊息時自動分析：

```javascript
// 在 chat.js 中的整合
import { createChatMCPHandler } from '../../core/chat-mcp-handler.js';

let mcpHandler = null;

// 初始化聊天時
mcpHandler = await createChatMCPHandler(
    chatId, 
    characterId, 
    userId
);

// 每次使用者發送訊息時
const sendMessage = async () => {
    const content = textarea.value.trim();
    
    // 原有的訊息處理...
    await MessagesDB.create(chatId, 'user', content);
    
    // 自動觸發 MCP 分析（背景執行，不阻塞）
    const mcpResult = await mcpHandler.processUserMessage(content, messages);
    
    // 如果需要 MCP 回應
    if (mcpResult.characterResponse) {
        if (mcpResult.characterResponse.type === 'mcp_confirmation') {
            // AI 主動詢問
            displayCharacterMessage(mcpResult.characterResponse.message);
            showConfirmButtons(
                mcpResult.characterResponse.onConfirm,
                mcpResult.characterResponse.onDecline
            );
        } else if (mcpResult.characterResponse.type === 'mcp_executed') {
            // 已自動執行
            displayCharacterMessage(mcpResult.characterResponse.message);
        }
    }
    
    // 如果有重要資訊，自動存到 Wiki
    if (mcpResult.shouldAutoWiki) {
        console.log('已自動儲存重要資訊到 Wiki');
    }
};
```

### 2. 完整上下文閱讀

系統會閱讀最近 20-50 則對話：

```javascript
// IntelligentMCPInvoker 內部
async loadRecentMemories(limit = 50) {
    // 讀取最近 50 則記憶
    this.recentMemories = await MemoryDB.getByCharacter(this.characterId, limit);
}

// 分析時會使用
analyzeMemoryContext() {
    // 分析最近討論的話題
    // 分析提到的實體
    // 分析情感趨勢
}
```

### 3. 自動存到 Wiki

系統會偵測重要資訊並自動整理：

```javascript
// 偵測的重要資訊類型
const importantKeywords = [
    // 理財目標
    '想要', '希望', '目標', '計劃', '存錢', '買', '夢想',
    
    // 偏好禁忌
    '喜歡', '討厭', '愛吃', '不吃', '過敏',
    
    // 重要日期
    '生日', '紀念日', '重要', '日期',
    
    // 聯絡資訊
    '電話', '地址', '密碼', '帳號'
];
```

## 實際對話範例

### 範例 1：健康關懷（自然觸發）

```
使用者: 我肚子痛，不太舒服

【系統背景處理】
- 讀取最近 20 則對話上下文
- 分析：健康關鍵字「痛」「不舒服」
- 查詢健康數據：上次經期 27 天前
- 匹配世界書：經期相關知識
- 推測：可能是經期不適（信心度 82%）
- 查詢角色性格：溫柔、體貼

【AI 自然回應】
角色: ❤️ 我發現你最近身體不適，是不是經期來了？
      需要我幫你記錄經期呢？別擔心，我會陪著你的
      
      [幫我記錄] [不用了]
      
使用者: 點擊 [幫我記錄]

【系統執行】
- 調用 health_period_log
- 記錄經期資訊
- 學習此次推理成功

【AI 回應】
角色: ❤️ 已經幫你記錄下來了！要記得好好休息喔！
```

### 範例 2：自動購物（高信心度自動執行）

```
使用者: 我忘了買衛生棉，好煩惱

【系統背景處理】
- 讀取上下文：最近提到經期
- 分析：購物需求 + 經期快到
- 查詢歷史：上次買好自在日用
- 推測：需要購買衛生用品（信心度 88%）
- 信心度 > 85%，自動執行

【AI 自然回應】
角色: ✨ 沒問題！我已經幫你下單好自在日用衛生棉了！
      預計 3-5 天送到，就不用擔心啦！
      
【背景學習】
- 記錄：使用者偏好好自在品牌
- 記錄：自動購買成功率
```

### 範例 3：智能記錄到 Wiki

```
使用者: 我想要存錢買一台新電腦，大概需要三萬塊

【系統背景處理】
- 偵測關鍵字：想要、存錢
- 判斷：重要理財目標
- 觸發：自動存到 Wiki

【AI 自然回應】
角色: 好的！我幫你記下來了！
      目標：存三萬塊買電腦
      
【Wiki 自動建立】
標題：理財目標
內容：存錢買電腦，預算三萬
關鍵字：存錢、目標、電腦
類型：financial_goal

使用者之後可以查詢：
使用者: 我的理財目標是什麼？
角色: 你想要存三萬塊買一台新電腦！加油！
```

### 範例 4：偏好記錄

```
使用者: 我超愛吃火鍋的，但我不吃香菜

【系統背景處理】
- 偵測：喜好資訊（愛吃、不吃）
- 觸發：自動存到 Wiki

【Wiki 自動建立】
標題：偏好與禁忌
內容：愛吃火鍋，不吃香菜
類型：preference

未來應用：
角色推薦餐廳時會自動避開香菜，
或特別推薦火鍋店
```

### 範例 5：上下文理解

```
【最近 10 則對話】
使用者: 最近天氣好熱
角色: 是啊，記得多喝水喔！
使用者: 我快沒水了
角色: 要不要我幫你訂水？  
使用者: 好啊
【系統理解上下文】
- 「快沒水」+ 「好啊」
- 理解：同意訂購水
- 調用購物工具

角色: 已經幫你訂一箱礦泉水了！
```

## 整合步驟

### 1. 在 chat.js 初始化

```javascript
import { createChatMCPHandler } from '../../core/chat-mcp-handler.js';

let mcpHandler = null;

async function renderChat(params) {
    // ... 原有代碼 ...
    
    // 初始化 MCP Handler
    mcpHandler = await createChatMCPHandler(
        chatId,
        currentChat.character_id,
        currentChat.user_id
    );
}
```

### 2. 在發送訊息時觸發

```javascript
const sendMessage = async () => {
    const content = textarea.value.trim();
    if (!content) return;
    
    // 原有發送邏輯
    await MessagesDB.create(chatId, 'user', content);
    displayUserMessage(content);
    
    // 自動觸發 MCP（異步，不阻塞）
    mcpHandler.processUserMessage(content, messages)
        .then(result => {
            if (result.characterResponse) {
                displayCharacterMessage(result.characterResponse.message);
            }
        })
        .catch(err => console.error('[MCP] 處理失敗:', err));
    
    // 原有 AI 回應生成
    await generateAIResponse(content);
};
```

### 3. 處理確認對話框

```javascript
function showConfirmButtons(onConfirm, onDecline) {
    const confirmBtn = createElement('button', '...確認按鈕樣式...');
    const declineBtn = createElement('button', '...取消按鈕樣式...');
    
    confirmBtn.onclick = async () => {
        const result = await onConfirm();
        if (result) {
            displayCharacterMessage(result.characterResponse);
        }
        removeButtons();
    };
    
    declineBtn.onclick = () => {
        displayCharacterMessage('好的，沒問題！');
        removeButtons();
    };
}
```

## 配置選項

### 開啟/關閉自動功能

```javascript
// 開啟/關閉自動 Wiki 記錄
mcpHandler.setAutoWiki(true);  // 預設開啟
mcpHandler.setAutoWiki(false); // 關閉

// 開啟/關閉自動 MCP 觸發
mcpHandler.setAutoMCP(true);  // 預設開啟
mcpHandler.setAutoMCP(false); // 關閉
```

### 自定義觸發條件

```javascript
// 在 ChatMCPHandler 中自定義
async shouldTriggerMCP(userMessage) {
    // 自定義邏輯
    const customKeywords = ['我的特殊關鍵字'];
    return customKeywords.some(kw => userMessage.includes(kw));
}
```

## 優勢

1. **完全自然**：使用者不需要知道背後有 MCP，就像和真人聊天
2. **上下文理解**：閱讀最近對話，真正理解需求
3. **角色扮演**：用角色的口吻和性格回應
4. **智能學習**：每次互動都會學習，越來越準確
5. **自動整理**：重要資訊自動存到 Wiki，方便查詢

## 資料流向

```
使用者訊息
    ↓
ChatMCPHandler.processUserMessage()
    ↓
IntelligentMCPInvoker.executeWithLearning()
    ├─ 讀取最近 50 則記憶
    ├─ 讀取健康數據
    ├─ 讀取世界書
    ├─ 讀取角色性格
    ↓
上下文分析 + 需求推測
    ↓
判斷是否需要 MCP 工具
    ├─ 是 → 用角色口吻詢問或執行
    └─ 否 → 不影響正常對話
    ↓
判斷是否需要存到 Wiki
    ├─ 是 → 自動建立 Wiki 條目
    └─ 否 → 跳過
    ↓
學習此次經驗 → 存入記憶系統
```

## 隱私保護

- 所有資料都在本地 IndexedDB
- MCP 工具調用需要使用者確認（除非信心度極高）
- 可以隨時關閉自動功能
- Wiki 條目標記為自動建立，可手動刪除