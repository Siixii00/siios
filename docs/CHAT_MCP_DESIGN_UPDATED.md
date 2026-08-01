# 聊天 MCP 自然整合指南（更新版）

## 核心設計理念

### 不預設角色性格
- ❌ **不使用**預設的性格模板（溫柔、活潑、害羞等）
- ✅ **讓 AI 自己閱讀**角色設定檔（personality, description, scenario, first_mes）
- ✅ **讓 AI 自己理解**角色應該如何說話
- ✅ **讓 AI 自己參考**世界書來扮演

### AI 收到的完整資訊

當需要 MCP 協助時，AI 會收到：

```
角色設定：
- name: 小護
- personality: 溫柔體貼的護理師...
- description: 在醫院工作的護理師...
- scenario: 你是一位護理師...
- first_mes: 你好，我是小護...
- mes_example: <START>{{user}}: 我不舒服{{char}}: 怎麼了？

世界書：
- 關鍵字：經期、生理期
- 內容：使用者的經期通常在月初...

上下文：
- 最近 50 則對話記錄

推測需求：
- 可能是經期不適（信心度 82%）

建議工具：
- health_period_log（記錄經期）
```

AI 會根據這些資訊自己決定如何回應！

## 實際運作流程

### 範例：使用者說身體不適

```
使用者: 我肚子痛，不舒服

【步驟 1：背景分析】
- 讀取角色設定：小護（護理師）
- 讀取世界書：經期相關知識
- 讀取健康數據：上次經期 27 天前
- 讀取記憶：最近 20 則對話
- 推測需求：經期不適（82%）

【步驟 2：發送給 AI】
{
  userMessage: "我肚子痛，不舒服",
  character: { /* 完整角色設定 */ },
  worldBook: [ /* 相關條目 */ ],
  recentContext: [ /* 最近對話 */ ],
  inferredNeed: "經期不適",
  suggestedTool: "health_period_log",
  confidence: 0.82
}

【步驟 3：AI 自主決定回應】
AI 根據角色設定自己決定：
"我看你最近身體不適，是不是經期來了？
 需要我幫你記錄經期嗎？"

（AI 會根據 personality 決定語氣，
 不是我們預設的模板！）
```

## 與舊版差異

### 舊版（已棄用）
```javascript
// ❌ 預設性格模板
if (traits.includes('溫柔')) {
    response = "❤️ 我發現你不舒服...";
} else if (traits.includes('活潑')) {
    response = "✨ 嘿！我注意到...";
}

// ❌ 固定的 emoji 和語氣
prefix = '❤️ ';
suffix = '，別擔心，我會陪著你的';
```

### 新版（目前使用）
```javascript
// ✅ 不預設，讓 AI 自己決定
return {
    question: "我看你最近身體不適...",
    
    // 提供完整資訊給 AI
    characterData: this.character,
    worldBookContext: this.worldBook,
    recentContext: this.recentMemories,
    
    // AI 根據這些自己生成回應
};
```

## 整合到 AI 請求

### 在 API 調用時加入 MCP 資訊

```javascript
// 發送給 AI 的完整請求
const aiRequest = {
    // 原有的角色設定
    character: character,
    
    // 原有的世界書
    world_book: worldBook,
    
    // 原有的對話歷史
    messages: recentMessages,
    
    // 新增：MCP 推測資訊
    mcp_context: {
        enabled: true,
        inferred_needs: [
            {
                type: 'health_period',
                description: '可能是經期不適',
                confidence: 0.82,
                suggested_tools: ['health_period_log']
            }
        ],
        available_tools: [
            {
                name: 'health_period_log',
                description: '記錄經期資訊',
                how_to_use: '調用此工具來記錄使用者的經期狀況'
            }
        ]
    }
};

// AI 的 prompt 會包含：
// "你可以根據需要自然地調用 MCP 工具來協助使用者。
//  如果判斷需要使用工具，請用角色的語氣詢問使用者是否需要幫忙。"
```

## AI 自主判斷機制

### AI 的判斷邏輯

AI 收到資訊後會自己判斷：

1. **是否需要 MCP？**
   - 根據使用者需求
   - 根據信心度
   - 根據工具可用性

2. **如何詢問？**
   - 根據角色 personality
   - 根據世界書設定
   - 根據當前情境

3. **用什麼語氣？**
   - AI 自己從角色設定學習
   - 不是我們硬編碼的模板

### 範例對話生成

```
【角色設定】
Name: 小護
Personality: 溫柔體貼的護理師，很關心人的健康

【AI 自主生成】
使用者: 我肚子痛
AI 回應: 我看你最近身體不適，是不是經期來了？
         需要我幫你記錄經期嗎？

（AI 自己從 personality 學習到要「溫柔」「關心」，
 不是我們寫死的模板！）
```

## 優勢

1. **靈活性**：每個角色都可以有獨特的回應方式
2. **自然度**：AI 自己理解角色，不會有固定模板感
3. **可擴展**：新增角色不需要寫新模板
4. **一致性**：AI 會根據完整設定扮演角色

## 技術實現

```javascript
// IntelligentMCPInvoker 核心方法

askForConfirmation() {
    return {
        type: 'confirmation_needed',
        
        // 基本問題模板（簡單）
        question: "我看你...需要幫忙嗎？",
        
        // 提供給 AI 的完整資訊
        characterData: this.character,        // 完整角色設定
        worldBookContext: this.worldBook,     // 世界書
        recentContext: this.recentMemories,   // 上下文
        inferredNeed: topNeed,                // 推測的需求
        suggestedTool: topTool,               // 建議工具
        
        // AI 根據這些自己生成最終回應
    };
}
```

## 總結

**舊版**：我們預設性格模板 → 固定語氣和 emoji
**新版**：提供完整資訊 → AI 自己理解角色 → 自然回應

讓 AI 真正扮演角色，而不是套用模板！