# 紫微斗數 MCP 整合計畫

## 目標
建立紫微斗數流年流月流日分析功能，讓使用者輸入角色出生資訊後，自動生成每日運勢預測，並整合到 Wiki 和 Chat 中。

## 核心決策

### 資料儲存
- **位置**: 擴充 CharactersDB 結構
- **新增欄位**: 
  - `birth_date` (YYYY-MM-DD)
  - `birth_time` (HH:mm)
  - `birth_location` (城市名)
  - `gender` ('male' | 'female') - 紫微斗數需要性別資訊
  - `ziwei_cache_id` (參考 ZiweiCacheDB)

### MCP 架構
- **方式**: 自建 Node.js + TypeScript MCP Server
- **部署**: 獨立部署到 Vercel/Cloudflare Workers
- **核心庫**: 使用 `fortel-ziweidoushu` (MIT 授權，npm 套件)
- **API 規格**: 遵循 MCP 標準，提供 `/tools` 和 `/tools/call` 端點

### 分析時機
- **懶加載策略**: 啟動 App 時檢查快取，若過期則重新分析
- **觸發時機**: 
  1. 角色設定出生資訊後首次分析
  2. App 啟動時檢查快取日期
  3. 跨日時（檢測日期變化）
- **不使用背景執行**: 因為 PWA 沒有 Service Worker

### 結果呈現
- **Wiki**: 嵌入「命理分析」區塊顯示流年流月流日
- **Chat**: 透過 `APIClient.buildMessages()` 注入命理上下文到系統提示

---

## 失敗模式處理

### 1. MCP Server 無法連線
**場景**: 網路異常、伺服器離線、DNS 解析失敗

**處理方式**:
- 使用過期快取，標記 `is_stale: true`
- 在 Wiki 頁面顯示警告：「⚠️ 資料可能過期（無法連線至分析服務）」
- Chat 不注入命理上下文（避免錯誤引導 AI）
- 自動重試機制：下次啟動時重新檢查

### 2. 出生資訊不完整
**場景**: 只有日期沒有時間、缺少地點

**處理方式**:
- 時間缺失：使用中午 12:00 作為預設值
- 地點缺失：跳過真太陽時校正
- 在 UI 上提示使用者補充資訊

### 3. 國曆轉農曆失敗
**場景**: 日期超出範圍、格式錯誤

**處理方式**:
- 前端驗證日期格式
- 提供農曆日期直接輸入選項
- 錯誤訊息明確提示使用者修正

### 4. 快取損壞
**場景**: IndexedDB 資料損料損壞、遷移失敗

**處理方式**:
- 捕獲 `getById` 異常
- 清除損壞快取，重新分析
- 記錄錯誤到 console 供除錯

### 5. 性別欄位遺失
**場景**: 舊角色沒有性別資訊

**處理方式**:
- 在角色設定頁面顯示提示：「此角色需要性別資訊才能進行命理分析」
- 提供快速設定選項
- 分析前檢查，缺少時不執行

### 6. 排盤算法異常
**場景**: fortel-ziweidoushu 套件 bug、極端日期

**處理方式**:
- try-catch 包裝排盤邏輯
- 記錄詳細錯誤資訊
- 返回部分結果（如果可能）
- 在 UI 上顯示：「分析暫時無法完成」

### 7. 跨時區問題
**場景**: 使用者在不同時區使用 App

**處理方式**:
- 所有日期使用當地時間
- 快取使用 `YYYY-MM-DD` 格式（不含時區）
- 跨日檢測使用瀏覽器本地時間

---

## 實作步驟

### Phase 1: 資料庫擴充

#### 1.1 修改 CharactersDB 結構
**檔案**: `js/db.js`

```javascript
// CharactersDB.create() 新增預設欄位
const character = {
  id,
  name: data.name || '',
  avatar: data.avatar || '',
  
  // 新增出生資訊
  birth_date: data.birth_date || null,        // '1990-01-15'
  birth_time: data.birth_time || null,        // '14:30'
  birth_location: data.birth_location || null, // '台北市'
  birth_calendar_type: data.birth_calendar_type || 'solar', // 'solar' | 'lunar'
  gender: data.gender || null,                 // 'male' | 'female'
  
  // 既有的欄位...
  description: data.description || '',
  personality: data.personality || '',
  scenario: data.scenario || '',
  first_message: data.first_message || '',
  
  // 新增命理快取參考
  ziwei_cache_id: data.ziwei_cache_id || null,
  
  created_at: Date.now()
};
```

#### 1.2 新增 ZiweiCacheDB
**檔案**: `js/db.js`

```javascript
const ZiweiCacheDB = {
  async getByCharacterId(characterId) {
    const database = await initDB();
    return database.getAllFromIndex('ziweiCache', 'character_id', characterId);
  },
  
  async create(data) {
    const database = await initDB();
    const cache = {
      id: generateId(),
      character_id: data.character_id,
      analysis_date: data.analysis_date, // '2026-08-04'
      analysis_type: data.analysis_type, // 'daily' | 'monthly' | 'yearly'
      
      // 排盤結果
      chart_data: data.chart_data,       // 完整命盤 JSON
      fortune_summary: data.fortune_summary, // 運勢摘要文字
      
      // 四化飛星
      sihua: data.sihua,                 // {祿: '天梁', 權: '紫微', 科: '天府', 忌: '武曲'}
      
      // 流年流月流日宮位
      liu_nian_temple: data.liu_nian_temple,
      liu_yue_temple: data.liu_yue_temple,
      liu_ri_temple: data.liu_ri_temple,
      
      // 事件預測
      events: data.events || [],         // [{type, description, confidence}]
      
      created_at: Date.now(),
      expires_at: data.expires_at        // 快取過期時間
    };
    await database.put('ziweiCache', cache);
    return cache;
  }
};
```

#### 1.3 升級資料庫版本
```javascript
const DB_VERSION = 13; // 從 12 升級

// 在 upgrade() 中新增
if (!database.objectStoreNames.contains('ziweiCache')) {
  const ziweiStore = database.createObjectStore('ziweiCache', { keyPath: 'id' });
  ziweiStore.createIndex('character_id', 'character_id');
  ziweiStore.createIndex('analysis_date', 'analysis_date');
  ziweiStore.createIndex('analysis_type', 'analysis_type');
  ziweiStore.createIndex('expires_at', 'expires_at');
}
```

---

### Phase 2: MCP Server 開發 (2-3 小時)

#### 2.1 專案結構
```
ziwei-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP Server 入口
│   ├── tools/
│   │   ├── analyze-birth.ts  # 排盤分析工具
│   │   ├── get-daily-fortune.ts # 獲取當日運勢
│   │   └── get-events.ts     # 獲取事件預測
│   ├── lib/
│   │   ├── ziwei-engine.ts   # 封裝排盤邏輯
│   │   └── calendar-convert.ts # 國曆轉農曆
│   └── types.ts
└── README.md
```

#### 2.2 核心工具定義
**檔案**: `src/tools/analyze-birth.ts`

```typescript
export const analyzeBirthTool = {
  name: 'ziwei_analyze_birth',
  description: '根據出生年月日時間進行紫微斗數排盤分析',
  inputSchema: {
    type: 'object',
    properties: {
      birth_date: { type: 'string', description: '出生日期 YYYY-MM-DD' },
      birth_time: { type: 'string', description: '出生時間 HH:mm' },
      birth_location: { type: 'string', description: '出生地城市名' },
      calendar_type: { 
        type: 'string', 
        enum: ['solar', 'lunar'],
        description: '國曆或農曆'
      },
      gender: { 
        type: 'string', 
        enum: ['male', 'female'],
        description: '性別'
      }
    },
    required: ['birth_date', 'birth_time', 'gender']
  },
  
  async handler(args, context) {
    // 1. 國曆轉農曆（如果需要）
    const lunarDate = args.calendar_type === 'solar' 
      ? await convertToLunar(args.birth_date, args.birth_location)
      : parseLunarDate(args.birth_date);
    
    // 2. 真太陽時校正
    const correctedTime = await adjustTrueSolarTime(
      args.birth_time, 
      args.birth_location
    );
    
    // 3. 調用排盤引擎
    const chart = await generateZiweiChart({
      lunarYear: lunarDate.year,
      lunarMonth: lunarDate.month,
      lunarDay: lunarDate.day,
      hour: correctedTime.hour,
      gender: args.gender
    });
    
    // 4. 計算流年流月流日
    const today = new Date();
    const runtime = calculateRuntimeContext(chart, today);
    
    return {
      success: true,
      chart: chart,
      runtime: runtime,
      fortune_summary: generateFortuneSummary(chart, runtime)
    };
  }
};
```

#### 2.3 整合現有庫
**檔案**: `src/lib/ziwei-engine.ts`

```typescript
// 使用 Renhuai123/ziwei-doushu 的算法
import { DestinyBoard, DestinyConfigBuilder } from 'fortel-ziweidoushu';
import { calculateLunarDate } from './calendar-convert';

export async function generateZiweiChart(params) {
  const { lunarYear, lunarMonth, lunarDay, hour, gender } = params;
  
  // 使用 fortel-ziweidoushu 排盤
  const board = new DestinyBoard(
    DestinyConfigBuilder.withLunar({
      year: lunarYear,
      month: lunarMonth,
      day: lunarDay,
      bornTimeGround: getTimeGround(hour),
      gender: gender === 'male' ? Gender.M : Gender.F
    })
  );
  
  return {
    twelve_palaces: extractPalaces(board),
    major_stars: extractMajorStars(board),
    sihua: board.bornStarDerivativeMap,
    element: board.element
  };
}

export function calculateRuntimeContext(chart, targetDate) {
  // 計算流年流月流日宮位
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;
  const day = targetDate.getDate();
  
  return {
    liu_nian: calculateLiuNian(chart, year),
    liu_yue: calculateLiuYue(chart, year, month),
    liu_ri: calculateLiuRi(chart, year, month, day)
  };
}
```

#### 2.4 MCP Server 入口
**檔案**: `src/index.ts`

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { analyzeBirthTool } from './tools/analyze-birth.js';
import { getDailyFortuneTool } from './tools/get-daily-fortune.js';

const server = new Server(
  { name: 'ziwei-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [analyzeBirthTool, getDailyFortuneTool]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'ziwei_analyze_birth':
      return await analyzeBirthTool.handler(args);
    case 'ziwei_get_daily_fortune':
      return await getDailyFortuneTool.handler(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 2.5 部署配置
**檔案**: `vercel.json` 或 `wrangler.toml`

```json
{
  "version": 2,
  "builds": [
    { "src": "src/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/index.ts" }
  ]
}
```

---

### Phase 3: 前端整合 (2 小時)

#### 3.1 角色設定頁面新增出生資訊欄位
**檔案**: `js/apps/settings/char-settings.js`

```javascript
async function renderCharEdit(params) {
  // ... 現有程式碼 ...
  
  // 新增出生資訊區塊
  const birthSection = createElement('div', 'ios-grouped-list mx-4 mt-4');
  birthSection.appendChild(createElement('div', 'text-xs text-ios-muted px-4 mb-2', {
    textContent: '出生資訊（用於紫微斗數分析）'
  }));
  
  // 出生日期
  const birthDateInput = createElement('input', 'ios-input', {
    type: 'date',
    value: char.birth_date || ''
  });
  birthSection.appendChild(createFormItem('出生日期', birthDateInput));
  
  // 出生時間
  const birthTimeInput = createElement('input', 'ios-input', {
    type: 'time',
    value: char.birth_time || ''
  });
  birthSection.appendChild(createFormItem('出生時間', birthTimeInput));
  
  // 出生地點
  const birthLocationInput = createElement('input', 'ios-input', {
    type: 'text',
    placeholder: '例如：台北市',
    value: char.birth_location || ''
  });
  birthSection.appendChild(createFormItem('出生地點', birthLocationInput));
  
  // 國曆/農曆選擇
  const calendarTypeSelect = createElement('select', 'ios-select');
  calendarTypeSelect.innerHTML = `
    <option value="solar" ${char.birth_calendar_type === 'solar' ? 'selected' : ''}>國曆</option>
    <option value="lunar" ${char.birth_calendar_type === 'lunar' ? 'selected' : ''}>農曆</option>
  `;
  birthSection.appendChild(createFormItem('曆法', calendarTypeSelect));
  
  main.appendChild(birthSection);
  
  // 儲存時更新
  const saveBtn = createElement('button', 'ios-btn ios-btn-primary mt-4 mx-4', {
    textContent: '儲存並分析命盤',
    onClick: async () => {
      const updatedChar = {
        ...char,
        birth_date: birthDateInput.value || null,
        birth_time: birthTimeInput.value || null,
        birth_location: birthLocationInput.value || null,
        birth_calendar_type: calendarTypeSelect.value
      };
      
      await CharactersDB.update(char.id, updatedChar);
      
      // 觸發 MCP 分析
      if (updatedChar.birth_date && updatedChar.birth_time) {
        await analyzeZiwei(char.id);
      }
      
      createToast('已儲存');
    }
  });
  main.appendChild(saveBtn);
}
```

#### 3.2 Wiki 頁面嵌入命理分析
**檔案**: `js/apps/personal-wiki/index.js`

```javascript
async function renderCharacterWiki(characterId) {
  // ... 現有程式碼 ...
  
  // 新增「命理分析」區塊
  const ziweiSection = createElement('div', 'mt-8');
  ziweiSection.appendChild(createElement('h2', 'text-xl font-bold mb-4', {
    textContent: '命理分析'
  }));
  
  // 從快取讀取當日運勢
  const todayCache = await ZiweiCacheDB.getByDate(characterId, getTodayString());
  
  if (todayCache) {
    // 流年流月流日卡片
    const fortuneCards = createElement('div', 'grid grid-cols-3 gap-4');
    
    // 流年
    fortuneCards.appendChild(createFortuneCard({
      title: '流年運勢',
      temple: todayCache.liu_nian_temple,
      sihua: todayCache.sihua,
      summary: todayCache.fortune_summary.yearly
    }));
    
    // 流月
    fortuneCards.appendChild(createFortuneCard({
      title: '流月運勢',
      temple: todayCache.liu_yue_temple,
      summary: todayCache.fortune_summary.monthly
    }));
    
    // 流日
    fortuneCards.appendChild(createFortuneCard({
      title: '流日運勢',
      temple: todayCache.liu_ri_temple,
      summary: todayCache.fortune_summary.daily,
      events: todayCache.events
    }));
    
    ziweiSection.appendChild(fortuneCards);
  } else {
    ziweiSection.appendChild(createElement('p', 'text-ios-muted', {
      textContent: '尚未設定出生資訊，無法進行命理分析'
    }));
  }
  
  container.appendChild(ziweiSection);
}

function createFortuneCard(data) {
  const card = createElement('div', 'bg-ios-surface rounded-lg p-4');
  
  card.appendChild(createElement('div', 'font-medium mb-2', {
    textContent: data.title
  }));
  
  if (data.temple) {
    card.appendChild(createElement('div', 'text-sm text-ios-muted', {
      textContent: `命宮：${data.temple}`
    }));
  }
  
  if (data.summary) {
    card.appendChild(createElement('p', 'text-sm mt-2', {
      textContent: data.summary
    }));
  }
  
  if (data.events && data.events.length > 0) {
    const eventList = createElement('div', 'mt-2 space-y-1');
    data.events.forEach(event => {
      eventList.appendChild(createElement('div', 'text-xs bg-blue-50 px-2 py-1 rounded', {
        textContent: `${event.description} (${Math.round(event.confidence * 100)}%)`
      }));
    });
    card.appendChild(eventList);
  }
  
  return card;
}
```

#### 3.3 Chat 整合當日運勢
**檔案**: `js/api.js` (修改 `buildMessages` 方法)

```javascript
async buildMessages(chatId, userMessage, settings, messages, memoryContext = null, characterData = null, userData = null) {
  const systemMessages = [];
  
  // ... 現有的系統訊息建構邏輯 ...
  
  // ===== 新增：注入紫微命理上下文 =====
  if (characterData?.ziwei_cache_id) {
    const ziweiCache = await ZiweiCacheDB.getById(characterData.ziwei_cache_id);
    
    if (ziweiCache && !ziweiCache.is_stale) {
      const ziweiContext = this.buildZiweiContext(ziweiCache);
      systemMessages.push({
        role: 'system',
        content: ziweiContext
      });
    }
  }
  // ===== 新增結束 =====
  
  // ... 後續邏輯 ...
  
  return systemMessages;
}

buildZiweiContext(cache) {
  const { fortune_summary, liu_ri_temple, events, sihua } = cache;
  
  let context = '[今日命理提示]\n';
  context += `流日命宮：${liu_ri_temple}\n`;
  context += `整體運勢：${fortune_summary.daily}\n`;
  
  // 四化飛星
  if (sihua) {
    context += `四化：祿(${sihua.祿}) 權(${sihua.權}) 科(${sihua.科}) 忌(${sihua.忌})\n`;
  }
  
  // 事件預測
  if (events && events.length > 0) {
    const topEvents = events.filter(e => e.confidence > 0.7).slice(0, 3);
    if (topEvents.length > 0) {
      context += `可能事件：${topEvents.map(e => e.description).join('、')}\n`;
    }
  }
  
  context += '\n請根據這些命理資訊，自然地融入角色的日常對話中。';
  context += '例如：如果運勢提到「精力充沛」，角色可能會主動提議外出或運動。';
  
  return context;
}
```

**關鍵整合點**：
1. 在 `buildMessages()` 中檢查 `characterData.ziwei_cache_id`
2. 從 `ZiweiCacheDB` 載入快取
3. 建構命理上下文並注入到系統提示
4. AI 會自然地根據這些資訊調整回應

**不修改 Chat.js 的原因**：
- 現有架構已將所有上下文建構邏輯集中在 `APIClient.buildMessages()`
- 在 API 層注入更符合「資料流」設計
- Chat 層保持簡單，不需要額外邏輯

---

### Phase 4: 懶加載更新機制

#### 4.1 啟動時檢查邏查邏輯
**檔案**: `js/core/ziwei-lazy-loader.js`

```javascript
class ZiweiLazyLoader {
  constructor() {
    this.lastCheckDate = null;
  }
  
  async checkAndRefreshIfNeeded(characterId) {
    const today = this.getTodayString();
    const char = await CharactersDB.getById(characterId);
    
    // 沒有出生資訊，跳過
    if (!char.birth_date || !char.birth_time) {
      return null;
    }
    
    // 取得快取
    const cache = char.ziwei_cache_id 
      ? await ZiweiCacheDB.getById(char.ziwei_cache_id)
      : null;
    
    // 判斷是否需要更新
    const needsUpdate = this.shouldUpdate(cache, today);
    
    if (needsUpdate) {
      return await this.refreshCache(characterId, today);
    }
    
    return cache;
  }
  
  shouldUpdate(cache, today) {
    // 沒有快取，需要分析
    if (!cache) return true;
    
    // 快取日期不是今天
    if (cache.analysis_date !== today) return true;
    
    // 快取已過期
    if (cache.expires_at < Date.now()) return true;
    
    return false;
  }
  
  async refreshCache(characterId, today) {
    try {
      const result = await ziweiClient.analyzeBirth(characterId);
      
      // 建立新快取
      const newCache = await ZiweiCacheDB.create({
        character_id: characterId,
        analysis_date: today,
        analysis_type: 'daily',
        chart_data: result.chart,
        fortune_summary: result.fortune_summary,
        sihua: result.runtime.sihua,
        liu_nian_temple: result.runtime.liu_nian.temple,
        liu_yue_temple: result.runtime.liu_yue.temple,
        liu_ri_temple: result.runtime.liu_ri.temple,
        events: result.events || [],
        expires_at: this.getTomorrowMidnight()
      });
      
      // 更新角色的快取參考
      await CharactersDB.update(characterId, {
        ziwei_cache_id: newCache.id
      });
      
      return newCache;
    } catch (error) {
      console.error('[ZiweiLazyLoader] 更新失敗:', error);
      
      // 返回舊快取（如果存在）
      const char = await CharactersDB.getById(characterId);
      if (char.ziwei_cache_id) {
        const oldCache = await ZiweiCacheDB.getById(char.ziwei_cache_id);
        if (oldCache) {
          // 標記為過期資料
          oldCache.is_stale = true;
          return oldCache;
        }
      }
      
      return null;
    }
  }
  
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }
  
  getTomorrowMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
  
  // 檢測跨日（用於長時間開啟 App 的情況）
  startDayChangeDetection() {
    this.lastCheckDate = this.getTodayString();
    
    setInterval(() => {
      const today = this.getTodayString();
      if (today !== this.lastCheckDate) {
        console.log('[ZiweiLazyLoader] 偵測到跨日，觸發更新');
        this.lastCheckDate = today;
        this.refreshAllCharacters();
      }
    }, 60000); // 每分鐘檢查一次
  }
  
  async refreshAllCharacters() {
    const characters = await CharactersDB.getAll();
    for (const char of characters) {
      if (char.birth_date && char.birth_time) {
        await this.checkAndRefreshIfNeeded(char.id);
      }
    }
  }
}

export const ziweiLazyLoader = new ZiweiLazyLoader();
```

#### 4.2 整合到 App 啟動流程
**檔案**: `js/app.js`

```javascript
// 在 App 初始化時啟動檢查
async function initApp() {
  // ... 現有初始化邏輯 ...
  
  // 啟動紫微懶加載器
  await ziweiLazyLoader.startDayChangeDetection();
}
```

#### 4.3 Wiki 頁面檢查
**檔案**: `js/apps/personal-wiki/index.js`

```javascript
async function renderCharacterWiki(characterId) {
  // 檢查並更新快取（如果需要）
  const ziweiData = await ziweiLazyLoader.checkAndRefreshIfNeeded(characterId);
  
  // ... 渲染 Wiki 頁面 ...
}
```

#### 4.2 MCP 調用封裝
**檔案**: `js/core/ziwei-mcp-client.js`

```javascript
class ZiweiMCPClient {
  constructor() {
    this.endpoint = 'https://ziwei-mcp.vercel.app'; // 或你的部署網址
  }
  
  async analyzeBirth(characterId) {
    const char = await CharactersDB.getById(characterId);
    
    if (!char.birth_date || !char.birth_time) {
      throw new Error('缺少出生資訊');
    }
    
    const response = await fetch(`${this.endpoint}/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ziwei_analyze_birth',
        arguments: {
          birth_date: char.birth_date,
          birth_time: char.birth_time,
          birth_location: char.birth_location,
          calendar_type: char.birth_calendar_type || 'solar',
          gender: char.gender || 'female'
        }
      })
    });
    
    if (!response.ok) throw new Error('MCP 調用失敗');
    
    const result = await response.json();
    
    // 儲存快取
    await this.saveCache(characterId, result);
    
    return result;
  }
  
  async saveCache(characterId, analysisResult) {
    const today = getTodayString();
    const tomorrow = getTomorrowString();
    
    await ZiweiCacheDB.create({
      character_id: characterId,
      analysis_date: today,
      analysis_type: 'daily',
      chart_data: analysisResult.chart,
      fortune_summary: analysisResult.fortune_summary,
      sihua: analysisResult.runtime.sihua,
      liu_nian_temple: analysisResult.runtime.liu_nian.temple,
      liu_yue_temple: analysisResult.runtime.liu_yue.temple,
      liu_ri_temple: analysisResult.runtime.liu_ri.temple,
      events: analysisResult.events || [],
      expires_at: new Date(tomorrow + 'T00:00:00').getTime()
    });
    
    // 更新角色的快取指標
    await CharactersDB.update(characterId, {
      ziwei_updated_at: Date.now()
    });
  }
}

export const ziweiClient = new ZiweiMCPClient();
```

---

### Phase 5: 事件生成邏輯 (1 小時)

#### 5.1 基於命盤的事件推測
**檔案**: `ziwei-mcp-server/src/lib/event-predictor.ts`

```typescript
export function predictDailyEvents(chart, runtimeContext) {
  const events = [];
  
  // 取得流日命宮主星
  const dailyTemple = runtimeContext.liu_ri.temple;
  const majorStars = chart.twelve_palaces[dailyTemple].majorStars;
  
  // 根據主星推測事件
  if (majorStars.includes('紫微')) {
    events.push({
      type: 'career',
      description: '可能遇到重要人物或領導機會',
      confidence: 0.75
    });
  }
  
  if (majorStars.includes('天機')) {
    events.push({
      type: 'social',
      description: '適合進行策劃或學習新事物',
      confidence: 0.70
    });
  }
  
  if (majorStars.includes('太陽')) {
    events.push({
      type: 'energy',
      description: '精力充沛，適合戶外活動',
      confidence: 0.80
    });
  }
  
  // 根據四化飛星調整
  if (runtimeContext.liu_ri.sihua.祿 === '天梁') {
    events.push({
      type: 'health',
      description: '健康運佳，適合運動或養生',
      confidence: 0.85
    });
  }
  
  return events.sort((a, b) => b.confidence - a.confidence);
}
```

#### 5.2 Chat 整合事件提示
**檔案**: `js/apps/chats/chat.js`

```javascript
// 在聊天對話中，根據事件自然提示
async function injectZiweiContext(message, character) {
  if (!character.ziwei_cache) return;
  
  const events = character.ziwei_cache.events;
  
  // 根據事件類型，在對話中自然帶入
  if (events.some(e => e.type === 'social' && e.confidence > 0.7)) {
    // AI 可能會自然提到：「今天感覺很適合出去走走呢～」
    return {
      hint: '今天社交運勢不錯，可能想找人聊天或外出',
      events: events.filter(e => e.type === 'social')
    };
  }
  
  if (events.some(e => e.type === 'energy' && e.confidence > 0.75)) {
    // AI 可能會自然提到：「今天精力充沛！」
    return {
      hint: '今天體力充沛，可能想做點活動',
      events: events.filter(e => e.type === 'energy')
    };
  }
  
  return null;
}
```

---

## 資料遷移計畫

### 1. IndexedDB 版本升級
**從版本 12 升級到 13**

```javascript
// 在 js/db.js 的 upgrade() 中新增
if (oldVersion < 13) {
  // 新增 ziweiCache 物件存儲
  if (!database.objectStoreNames.contains('ziweiCache')) {
    const ziweiStore = database.createObjectStore('ziweiCache', { keyPath: 'id' });
    ziweiStore.createIndex('character_id', 'character_id');
    ziweiStore.createIndex('analysis_date', 'analysis_date');
    ziweiStore.createIndex('analysis_type', 'analysis_type');
    ziweiStore.createIndex('expires_at', 'expires_at');
  }
}
```

### 2. 現有角色資料相容性
**問題**: 現有角色沒有 `gender` 欄位

**解決方式**:
- 不修改現有角色資料
- 在 `CharactersDB.create()` 和 `update()` 中新增預設值
- 在角色設定頁面顯示提示：「此角色需要補充性別資訊」

### 3. 懶加載機制相容
**問題**: 現有 App 啟動流程沒有檢查機制

**解決方式**:
- 在 `app.js` 的初始化階段新增 `ziweiLazyLoader.startDayChangeDetection()`
- 不影響現有邏輯，僅新增功能

### 4. API 向後相容
**問題**: 舊版 `buildMessages()` 沒有命理邏輯

**解決方式**:
- 使用 `characterData?.ziwei_cache_id` 可選鏈
- 沒有快取時跳過注入
- 不影響現有對話功能

---

## 驗證計畫

### 1. 單元測試
- [ ] CharactersDB 欄位正確新增
- [ ] ZiweiCacheDB 正確存取
- [ ] MCP Server 正確回應 `/tools/call`
- [ ] 國曆轉農曆正確
- [ ] 真太陽時校正正確
- [ ] 流年流月流日計算正確

### 2. 整合測試
- [ ] 前端設定出生資訊 → MCP 分析 → 快取儲存
- [ ] Wiki 正確顯示命理分析區塊
- [ ] Chat 正確注入命理上下文
- [ ] 定時更新機制正確觸發

### 3. 使用者測試
- [ ] 設定角色出生資訊流程順暢
- [ ] Wiki 頁面載入速度 acceptable (< 2s)
- [ ] Chat 對話自然融入命理資訊
- [ ] 每日更新自動執行

---

## 風險評估

### 高風險
1. **MCP Server 效能問題**
   - 排盤計算可能耗時 1-3 秒
   - 首次分析會有延遲
   - **緩解**: 使用快取、非同步載入、顯示載入指示器

2. **快取一致性**
   - 使用者可能同時開啟多個分頁
   - IndexedDB 可能競爭
   - **緩解**: 使用交易（transaction）、樂觀鎖機制

### 中風險
1. **真太陽時準確度**
   - 城市經緯度資料庫不完整
   - **緩解**: 允許手動輸入經緯度、預設跳過校正

2. **國曆轉農曆錯誤**
   - 某些日期轉換可能失敗
   - **緩解**: 提供農曆直接輸入、錯誤提示明確

3. **性別欄位缺失**
   - 現有角色沒有性別資訊
   - **緩解**: 在 UI 上明確提示、強制設定

### 低風險
1. **跨時區問題**
   - 使用者在不同時區登入
   - **緩解**: 使用本地時間、YYYY-MM-DD 格式

2. **套件依賴風險**
   - fortel-ziweidoushu 可能停止維護
   - **緩解**: MIT 授權可自行維護、演算法已固定

---

## 未來擴展

1. **合盤分析**: 兩個角色的命盤比對
2. **歷史運勢**: 查看過去的流年流月分析
3. **事件日曆**: 將預測事件整合到日曆 App
4. **個性化解讀**: 讓使用者標記事件準確度，優化模型