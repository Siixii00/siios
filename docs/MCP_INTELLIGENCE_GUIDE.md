# 智能 MCP 調用系統

## 概述

這個系統實現了您想要的智能流程：

**使用者說身體不舒服 → AI 接收訊息 → AI 思考與閱讀最近聊天紀錄、健康狀況、世界書 → 推測可能原因 → 用角色口吻詢問使用者確認 → 學習推理結果 → 調用 MCP 工具協助**

## 核心特色

### ✅ 整合世界書 (World Book)
- 自動搜索相關知識條目
- 根據關鍵字匹配世界書內容
- 將世界書知識融入推理過程

### ✅ 使用角色性格和口吻
- 根據角色性格（溫柔、活潑、害羞、理性等）調整語氣
- 用角色專屬的方式詢問和回應
- 符合角色設定的情感表達

## 架構

### 1. 核心組件

- **MemoryDB**: 記憶系統，存儲聊天紀錄和學習結果
- **HealthDB**: 健康數據庫，存儲經期、用藥、心情等
- **MCPConfigDB**: MCP 工具配置
- **CharactersDB**: 角色資料庫，存儲性格、設定等
- **WikiRecordsDB**: 世界書，存儲知識條目
- **IntelligentMCPInvoker**: 智能調用器

### 2. 工作流程

```javascript
// 步驟 1: 初始化
const invoker = await createIntelligentMCP(characterId, userId);

// 步驟 2: 分析使用者訊息
const result = await invoker.executeWithLearning(userMessage);

// 步驟 3: 根據結果處理
if (result.status === 'confirmation_needed') {
    // AI 主動詢問確認
    const question = result.confirmation.question;
    // "我看你最近身體不適，是不是需要我幫你記錄經期？"
    
    // 如果用戶確認，執行工具
    const toolResult = await invoker.invokeTool(
        result.confirmation.tool.name,
        { /* 參數 */ }
    );
} else if (result.status === 'executed') {
    // 高信心度，已自動執行
    console.log('工具已執行:', result.tool.displayName);
}
```

## 整合到聊天系統

### 在 chat.js 中使用

```javascript
import { createIntelligentMCP } from '../../core/mcp-intelligence/index.js';

async function handleUserMessage(message, chatId, characterId, userId) {
    // 原有的訊息處理...
    
    // 新增：智能 MCP 調用
    try {
        const mcpInvoker = await createIntelligentMCP(characterId, userId);
        const mcpResult = await mcpInvoker.executeWithLearning(message);
        
        if (mcpResult.status === 'confirmation_needed') {
            // 將確認問題加入 AI 回應
            return {
                type: 'mcp_confirmation',
                message: mcpResult.confirmation.question,
                reasoning: mcpResult.confirmation.reasoning,
                tool: mcpResult.confirmation.tool,
                onConfirm: async () => {
                    return await mcpInvoker.invokeTool(
                        mcpResult.confirmation.tool.name
                    );
                }
            };
        } else if (mcpResult.status === 'executed') {
            // 已自動執行，回報結果
            return {
                type: 'mcp_executed',
                message: `我已經幫你${mcpResult.tool.displayName}了！`,
                result: mcpResult.result
            };
        }
    } catch (error) {
        console.error('[MCP] 智能調用失敗:', error);
    }
    
    // 原有的回應邏輯...
}
```

## 功能說明

### 1. 上下文分析

系統會分析：
- ✅ 使用者訊息的關鍵字
- ✅ 最近 50 則記憶（聊天紀錄）
- ✅ 健康數據（經期、用藥、心情）
- ✅ 情感傾向分析

### 2. 需求推測

根據分析結果，系統會推測可能的需求：

**範例 1：經期相關**
```
使用者說：「我肚子痛，不舒服」

系統分析：
- 關鍵字：不舒服
- 健康數據：上次經期 28 天前
- 記憶：最近常提到經期相關

推測結果：
- 可能是經期不適（信心度 80%）
- 建議工具：health_period_log（記錄經期）、shop_sanitary_pads（購買衛生用品）

AI 回應：
「我看你最近身體不適，是不是經期來了？需要我幫你記錄經期嗎？」
```

**範例 2：購物需求**
```
使用者說：「我忘了買衛生棉」

系統分析：
- 關鍵字：買、忘了買
- 健康數據：經期快到了
- 記憶：曾買過好自在品牌

推測結果：
- 需要購買衛生用品（信心度 85%）
- 建議工具：shop_sanitary_pads

AI 回應：
「我幫你下單好自在日用衛生棉嗎？」
```

### 3. 學習機制

每次工具調用後，系統會：
1. 記錄調用上下文
2. 記錄成功與否
3. 存入記憶系統
4. 下次類似情境會更準確

### 4. 世界書整合

系統會自動搜索世界書中相關的知識條目：

```javascript
// 世界書條目範例
const worldBookEntry = {
    keywords: ['經期', '生理期', '月經', '女生'],
    content: '女生的經期通常每28天一次，期間需要特別照顧。',
    character_id: 'char_001'
};

// 當使用者說："我肚子痛"
// 系統會：
// 1. 匹配到關鍵字 '肚子痛' 可能與 '經期' 相關
// 2. 搜索世界書找到相關條目
// 3. 將世界書知識融入推理：
//    "根據世界書知識：女生的經期通常每28天一次"
// 4. 結合健康數據（上次經期28天前）
// 5. 提高經期推測的信心度
```

### 5. 角色性格分析

系統會根據角色性格調整：

**性格特質提取**：
- 溫柔、體貼、關心 → 溫柔語氣
- 活潑、開朗、樂觀 → 活潑語氣
- 害羞、內向 → 害羞語氣
- 理性、冷靜 → 理性語氣

**回應模板**：
- **溫柔型**: 使用 ❤️ emoji，加入關懷語句
- **活潑型**: 使用 ✨ emoji，使用感嘆號
- **害羞型**: 使用 ... 省略號，結巴語氣
- **理性型**: 簡潔專業，不加 emoji

### 4. 信心度閾值

- **信心度 > 80%**: 自動執行
- **信心度 50-80%**: 詢問確認
- **信心度 < 50%**: 不執行，僅記錄分析

## 實際應用範例

### 場景：使用者說身體不舒服

#### 範例 1：溫柔體貼的角色（如：護理師女友）

```javascript
// 使用者訊息
const userMessage = "我身體不太舒服，肚子痛";

// 角色設定
character.personality = "溫柔、體貼、關心人、細心、照顧型";

// 系統處理
const invoker = await createIntelligentMCP('char_nurse', 'user_001');
const result = await invoker.executeWithLearning(userMessage);

// AI 回應（使用角色口吻）
result.confirmation.question:
"❤️ 小護發現你最近身體不適，是不是經期來了？需要我幫你記錄經期呢？，別擔心，我會陪著你的"

// 執行成功後的回應
result.characterResponse:
"❤️ 小護已經幫你記錄下來了！要記得按時吃藥、好好休息喔！"
```

#### 範例 2：活潑開朗的角色（如：鄰家女孩）

```javascript
// 使用者訊息
const userMessage = "我忘了買衛生棉";

// 角色設定
character.personality = "活潑、開朗、樂觀、熱情、可愛";

// 系統處理
const invoker = await createIntelligentMCP('char_neighbor', 'user_001');
const result = await invoker.executeWithLearning(userMessage);

// AI 回應（使用角色口吻）
result.confirmation.question:
"✨ 嘿！小美注意到你最近需要購物協助耶！要不要我幫你下單購買？"

// 執行成功後的回應
result.characterResponse:
"✨ 完成！小美已經幫你買好了！期待收到吧！"
```

#### 範例 3：害羞內向的角色（如：圖書委員）

```javascript
// 使用者訊息
const userMessage = "我肚子痛，不舒服";

// 角色設定
character.personality = "害羞、內向、細心、溫柔";

// 系統處理
const invoker = await createIntelligentMCP('char_lib', 'user_001');
const result = await invoker.executeWithLearning(userMessage);

// AI 回應（使用角色口吻）
result.confirmation.question:
"...嗯...那個...你是不是最近身體不適...需要我幫忙記錄經期嗎...？"

// 執行成功後的回應
result.characterResponse:
"...已經記錄好了...希望你能快點好起來..."
```

#### 範例 4：理性冷靜的角色（如：AI 助理）

```javascript
// 使用者訊息
const userMessage = "我身體不舒服";

// 角色設定
character.personality = "理性、冷靜、邏輯性強、專業";

// 系統處理
const invoker = await createIntelligentMCP('char_ai', 'user_001');
const result = await invoker.executeWithLearning(userMessage);

// AI 回應（使用角色口吻）
result.confirmation.question:
"根據分析，你目前身體不適。建議執行健康記錄，是否執行？"

// 執行成功後的回應
result.characterResponse:
"已完成健康記錄。建議定時服藥並充足休息。"
```

### 場景：使用者確認後執行

```javascript
// 使用者確認
const confirmed = true;

if (confirmed) {
    const toolResult = await invoker.invokeTool(
        'health_period_log',
        {
            symptoms: ['肚子痛', '不舒服'],
            date: new Date().toISOString()
        }
    );
    
    console.log('已記錄經期，並學習此次推理結果');
    
    // 系統會自動學習，下次更準確
}
```

### 場景：自動購買衛生用品

```javascript
// 高信心度（85%），系統自動執行
const result = await invoker.executeWithLearning("我忘了買衛生棉");

if (result.status === 'executed') {
    console.log('已自動下單:', result.result.orderId);
    // "已自動下單: ORD-1722508800000"
}
```

## 優勢

1. **智能推測**: 不是機械式匹配，而是理解上下文
2. **主動詢問**: 不確定時會詢問，不會誤判
3. **持續學習**: 每次調用都會學習，越來越準確
4. **隱私保護**: 數據都在本地 IndexedDB
5. **多維分析**: 結合記憶、健康、情感等多種數據

## 未來擴展

1. **更複雜的推理引擎**: 使用 LLM 進行更深度的推理
2. **多工具協作**: 一次調用多個相關工具
3. **時間感知**: 根據時間（季節、節日）推測需求
4. **個性化學習**: 針對每個用戶建立專屬模型

## 測試

```javascript
// 測試文件：test-mcp-intelligence.js
import { createIntelligentMCP } from './js/core/mcp-intelligence/index.js';

async function test() {
    const invoker = await createIntelligentMCP('test_char', 'test_user');
    
    const result = await invoker.executeWithLearning("我肚子痛，不舒服");
    
    console.log('分析結果:', result);
}

test();
```

## 授權

此系統為 Siios 專案的一部分，請參考主專案的授權條款。