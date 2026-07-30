# 聊天選單與健康功能實作計劃

## 目標
1. 建立聊天視窗右側滑出選單（Kakao 風格漢堡選單）
2. 實作現實資訊注入功能（時間、天氣）
3. 建立健康資料管理系統（用藥紀錄、經期推算）

---

## 一、右側滑出選單

### 1.1 通用元件 - `createKakaoSideMenu`
**位置**: `js/components.js`

**功能規格**:
- 從右側滑入，含背景遮罩
- 支援標題、分組選項、分隔線
- 點擊遮罩或選項後自動關閉
- 提供 `open()` 和 `close()` 方法

**選單選項**（依使用者確認）:

#### 📋 資訊區
| 選項 | 功能 |
|------|------|
| 角色資訊 | 跳轉至角色詳情頁 |
| User面具資訊 | 跳轉至當前綁定的 User 面具頁 |
| 世界觀設定 | 管理/掛載對話世界觀 |

#### ⚙️ 設定
| 選項 | 功能 |
|------|------|
| 對話設定 | 跳轉至 `/chats/settings` |
| 天氣位置 | 設定此對話的城市位置 |
| 現實資訊注入 | 開關：啟用後自動注入時間/天氣 |

#### 📤 匯出與記憶
| 選項 | 功能 |
|------|------|
| 匯出對話 | 匯出為 HTML 檔案 |
| 生成記憶總結 | 呼叫 `MemorySystem.processBatch()` |
| 強制睡眠 | 呼叫 `MemorySystem.runSleepCycle()` |

#### 📅 每日功能
| 選項 | 功能 |
|------|------|
| 每日備份 | 建立對話 JSON 備份 |
| 每日記錄 | 查看 Char 對 User 的觀察紀錄 |

#### ⚠️ 危險區域
| 選項 | 功能 |
|------|------|
| 🚫 拉黑角色 | 設定 `blocked_until` 時間戳 |
| 🗑️ 清除對話 | 清空 `MessagesDB` |
| 🧹 清空記憶 | 刪除此對話的 `memories` |

---

### 1.2 CSS 樣式
**位置**: `css/kakao.css`

**新增樣式**:
```css
.kakao-side-menu-overlay { ... }  /* 背景遮罩 */
.kakao-side-menu { ... }           /* 右側選單容器 */
.kakao-side-menu-header { ... }    /* 選單標題 */
.kakao-side-menu-section { ... }   /* 分組區塊 */
.kakao-side-menu-item { ... }      /* 選項項目 */
.kakao-side-menu-divider { ... }   /* 分隔線 */
.kakao-side-menu-danger { ... }    /* 危險區域樣式 */
```

---

### 1.3 chat.js 整合
**位置**: `js/apps/chats/chat.js`

**修改點**:
- Line 39-42: 將 menuBtn 改為呼叫 `createKakaoSideMenu`
- 傳入 `chatId`、`currentChat`、相關回調函數

---

## 二、現實資訊注入功能

### 2.1 功能開關
**儲存位置**: `ChatsDB` 新增欄位
```javascript
{
  enable_real_world_info: boolean,  // 是否啟用
  weather_location: string | null,  // 城市（如 "台北"）
  last_weather_fetch: number,       // 上次抓取時間戳
  cached_weather: object | null     // 快取的天氣資料
}
```

### 2.2 天氣資料流程
1. **背景預載**: 進入對話時檢查快取（TTL: 10 分鐘）
2. **即時查詢**: 若快取過期，背景呼叫 Open-Meteo API
3. **降級處理**: API 失敗時使用舊快取或跳過
4. **超時設定**: 3 秒超時，不阻塞對話

### 2.3 API 整合
**位置**: `js/api.js` - `buildMessages()`

**注入邏輯**:
```javascript
if (chat.enable_real_world_info) {
  const realWorldInfo = await buildRealWorldContext(chat);
  if (realWorldInfo) {
    systemMessages.push({
      role: 'system',
      content: `[Current Reality]\n${realWorldInfo}\n[/Current Reality]`
    });
  }
}
```

**buildRealWorldContext() 回傳格式**:
```
時間: 2026-07-30 17:30 (週四)
地點: 台北
天氣: 晴朗，28°C，濕度 65%
體感: 建議外出記得防曬
```

### 2.4 天氣位置設定 UI
**位置**: 選單內的「天氣位置」選項

**功能**:
- 顯示當前設定城市
- 點擊開啟輸入框（複用 weather app 的 `geocodeLocation()`）
- 支援中文/英文城市名稱

---

## 三、健康資料管理系統

### 3.1 資料庫結構
**新增 Object Store**: `health`

**欄位設計**:

#### 用藥紀錄 (type: 'medication')
```javascript
{
  id: string,
  user_id: string,           // 綁定 User 面具
  type: 'medication',
  medication_name: string,   // 藥品名稱
  dosage: string,            // 劑量
  frequency: string,         // 頻率（每日/每週/需要時）
  start_date: number,        // 開始日期（時間戳）
  end_date: number | null,   // 結束日期（null = 持續中）
  notes: string,             // 備註
  reminders_enabled: boolean,// 是否啟用提醒
  reminder_times: string[],  // 提醒時間（如 ['08:00', '20:00']）
  created_at: number,
  updated_at: number
}
```

#### 經期記錄 (type: 'period')
```javascript
{
  id: string,
  user_id: string,
  type: 'period',
  start_date: number,        // 經期開始日期
  end_date: number | null,   // 經期結束日期（可選）
  cycle_length: number,      // 週期天數（自動計算或手動設定）
  period_length: number,     // 經期天數
  symptoms: string[],        // 症狀標籤（如 ['經痛', '腰酸']）
  notes: string,
  created_at: number
}
```

#### 經期設定 (type: 'period_settings')
```javascript
{
  id: 'period_settings_' + user_id,
  user_id: string,
  type: 'period_settings',
  default_cycle_length: number,  // 預設週期（如 28）
  default_period_length: number, // 預設經期天數（如 5）
  reminder_days_before: number,   // 提前幾天提醒（如 3）
  reminder_in_chat: boolean,      // 是否在對話中提醒
  reminder_notification: boolean, // 是否發送通知
  last_period_date: number,       // 上次經期開始日期
  predicted_next_date: number,    // 預測下次日期
  created_at: number,
  updated_at: number
}
```

#### 健康記憶範本 (type: 'health_memory_template')
```javascript
{
  id: string,
  user_id: string,
  type: 'health_memory_template',
  category: 'period' | 'medication' | 'general',
  
  // 經期相關反應記錄
  period_symptoms: string[],        // 常見症狀（如 ['經痛', '腰酸', '頭痛']）
  period_mood_changes: string[],    // 情緒變化（如 ['易怒', '低落', '焦慮']）
  
  // 用藥相關
  current_medications: string[],    // 目前用藥清單
  
  // 角色行為邊界（固定不可調整）
  behavior_rules: {
    no_surveillance: true,          // 禁止監視
    no_interference: true,          // 禁止干涉生活決定
    no_nagging: true,               // 禁止說教
    no_over_caring: true,           // 禁止過度關心
    must_think_before_respond: true,// 必須經過思考
    respect_user_stance: true       // 尊重使用者立場
  },
  
  created_at: number,
  updated_at: number
}
```

**設計理念**:
- **不設定強度**：角色的關心程度由角色本身的性格、設定來決定
- **核心原則固定**：禁止監視、干涉、說教、過度關心是固定規則
- **角色自由演繹**：根據角色性格自然表達關心，像真人一樣

### 3.2 經期推算邏輯
**位置**: `js/core/period-calculator.js`

**演算法**:
1. 取得最近 6 次經期記錄
2. 計算平均週期 = (倒數第1次 - 倒數第7次) / 6
3. 預測下次日期 = 最近一次開始 + 平均週期
4. 預測範圍 = ±3 天（標準差計算）

**API**:
```javascript
class PeriodCalculator {
  static async calculateNextPeriod(userId) { ... }
  static async getPeriodHistory(userId, limit = 12) { ... }
  static async updatePrediction(userId) { ... }
}
```

### 3.3 角色關心邊界設計

#### 核心原則（固定不變）
1. **只關心，不干涉** - 角色可以表達關心，但絕不強迫或說教
2. **不監視** - 不主動追蹤或詢問健康狀態
3. **不過度關心** - 自然地關心，像正常人一樣
4. **尊重隱私** - 不主動提及敏感健康資訊，除非使用者開啟
5. **必須思考** - 角色必須根據自身性格經過思考後決定如何關心
6. **尊重使用者立場** - 站在使用者的角度思考，不是教導者

#### 關心由角色性格決定
- **不設定強度等級**
- 角色根據自身設定（性格、關係、背景）自然決定關心程度
- 例如：
  - 溫柔型角色：可能會輕聲問候、準備熱飲
  - 傲嬌型角色：可能嘴上不在意但默默準備保暖用品
  - 理性型角色：可能提供實用建議但不囉嗦
  - 活潑型角色：可能用轉移注意力的方式關心

#### 注入到 system prompt 的規則
```
[Health Care Boundaries - MANDATORY]
You may express natural care about the user's health based on YOUR character's personality and relationship with the user.

CRITICAL RULES (DO NOT VIOLATE):
❌ NEVER surveillance, monitor, or track the user's health
❌ NEVER interfere with the user's life decisions
❌ NEVER nag, lecture, or preach
❌ NEVER show excessive concern (be natural, like a normal person)
❌ NEVER act like a doctor or medical professional
❌ NEVER bring up health topics without context or user initiation

✅ DO think before responding - consider your character's personality
✅ DO respect the user's perspective and autonomy
✅ DO express care naturally if the context is appropriate
✅ DO remember that you are a character with your own thoughts and boundaries

Example of NATURAL care (good):
- "最近天氣變冷了，記得多穿點" (simple, natural)
- "看你臉色不太好，要不要休息一下？" (observant, not intrusive)

Example of BAD care (forbidden):
- "你今天有沒有按時吃藥？為什麼不吃？這樣會怎樣怎樣..." (nagging)
- "你應該要...你必須...你一定要..." (interfering)
- "你經期快來了要小心這個那個" (over-caring, out of context)
[/Health Care Boundaries]
```

### 3.4 智慧提醒機制

#### 在對話中提醒
**觸發條件**: 
- 預測日期前 N 天（可設定，預設 3 天）
- 對話開始時檢查
- **首次使用必須先建立健康記憶**

**注入方式**:
```javascript
// 在 buildMessages() 中
const healthMemory = await HealthDB.getMemoryTemplate(userId);
if (!healthMemory) {
  // 首次使用，提示使用者建立健康記憶
  return;
}

const periodReminder = await checkPeriodReminder(userId);
if (periodReminder && chat.enable_health_reminder) {
  // 注入健康資訊，但不指定角色該怎麼做
  // 讓角色根據自己的性格決定如何反應
  systemMessages.push({
    role: 'system',
    content: buildHealthContext(periodReminder, healthMemory)
  });
}
```

**buildHealthContext() 邏輯**:
```javascript
function buildHealthContext(reminder, healthMemory) {
  const context = `[Health Context - For Your Information Only]\n`;
  
  // 僅提供事實資訊，不指示角色該做什麼
  if (reminder.daysUntil <= 3) {
    context += `User's period is expected in about ${reminder.daysUntil} days.\n`;
  }
  
  // 使用者的常見症狀（供角色參考）
  if (healthMemory.period_symptoms?.length > 0) {
    context += `User often experiences: ${healthMemory.period_symptoms.join(', ')}.\n`;
  }
  
  // 關鍵：不告訴角色「要關心」或「要說什麼」
  context += `\nUse this information based on YOUR character's personality. Think naturally.`;
  context += `\nRemember: Care naturally, respect boundaries.`;
  
  return context;
}
```

**設計理念**:
- 提供**事實資訊**，不提供**行為指令**
- 角色根據自身性格決定如何使用這些資訊
- 可以完全忽略，也可以自然關心

#### App 通知
**位置**: Service Worker 或定時器

**實作**:
- 使用 `Notification API`
- 每日檢查是否需要提醒
- 點擊通知可跳轉至健康記錄頁

### 3.5 健康管理 UI

#### 首次使用流程
1. 進入健康頁面時檢查是否已有健康記憶
2. 若無，顯示簡單引導頁面：
   - 「建立你的健康記憶」
   - 可選填：常見症狀、情緒變化
   - 說明：角色會根據自己的性格來關心你
   - 可跳過，之後再設定

#### 健康記憶設定頁
**位置**: `js/apps/health/memory-settings.js`

**功能**:
- 記錄常見症狀（多選標籤）
- 記錄情緒變化（多選標籤）
- 用藥清單（可增刪）
- 說明區塊：「角色會根據自身性格自然關心，請放心使用」

**預設症狀標籤**:
- 經痛、腰酸、頭痛、疲勞、水腫、情緒波動、食慾改變、失眠、腹脹、乳房脹痛

**預設情緒標籤**:
- 易怒、低落、焦慮、敏感、疲倦、想吃甜食

#### 健康記錄頁面

#### 健康記錄頁面
**位置**: `js/apps/health/index.js`

**路由**: `/health`

**功能**:
- 顯示用藥紀錄列表
- 顯示經期日曆視圖
- 新增/編輯/刪除記錄
- 經期預測視覺化

#### 經期日曆
**UI 元件**:
- 月曆視圖（可參考 `exchange-diary/index.js`）
- 標記經期日期（紅色）
- 標記預測日期（粉色虛線）
- 點擊日期可新增記錄

---

## 四、實作順序

### Phase 1: 選單基礎功能
1. 建立 `createKakaoSideMenu` 元件
2. 新增 CSS 樣式
3. 整合至 `chat.js`
4. 實作基本選項（角色資訊、設定、清除對話）

### Phase 2: 現實資訊注入
1. 新增 `ChatsDB` 欄位
2. 建立 `buildRealWorldContext()` 函數
3. 整合至 `api.js` 的 `buildMessages()`
4. 實作天氣位置設定 UI
5. 加入快取與降級處理

### Phase 3: 健康資料庫
1. 新增 `health` Object Store
2. 建立 `HealthDB` API
3. 建立 `PeriodCalculator` 類別
4. 建立健康記憶範本資料結構

### Phase 4: 健康記憶設定
1. 建立首次使用引導頁（可跳過）
2. 建立健康記憶設定頁
3. 實作角色關心邊界邏輯（固定規則）
4. 整合到資訊注入系統

### Phase 5: 健康記錄管理
1. 建立健康記錄頁面
2. 實作經期日曆視圖
3. 用藥紀錄管理

### Phase 6: 進階選單功能
1. 匯出對話 HTML
2. 生成記憶總結
3. 強制睡眠
4. 每日備份
5. 拉黑角色

---

## 五、風險與降級策略

### 5.1 天氣 API 失敗
- **快取機制**: TTL 10 分鐘，使用舊資料
- **超時處理**: 3 秒超時，不阻塞對話
- **降級**: 失敗時僅注入時間資訊

### 5.2 經期推算不準確
- **歷史資料不足**: 若少於 3 次記錄，使用預設 28 天週期
- **手動修正**: 允許使用者手動調整預測
- **隱私考量**: 所有資料本地儲存，不上傳雲端

### 5.3 效能影響
- **背景預載**: 不阻塞對話啟動
- **懶加載**: 健康功能僅在需要時載入
- **輕量化**: CSS/JS 模組化，按需載入

---

## 六、驗證計劃

### 6.1 選單功能
- [ ] 點擊漢堡選單可正常開啟
- [ ] 點擊遮罩可關閉選單
- [ ] 各選項可正常跳轉/執行
- [ ] 滑動動作流暢

### 6.2 現實資訊注入
- [ ] 開啟後可看到時間資訊
- [ ] 天氣資訊正確顯示
- [ ] API 失敗時不影響對話
- [ ] 快取機制正常運作

### 6.3 健康功能
- [ ] 可新增用藥紀錄
- [ ] 可新增經期記錄
- [ ] 經期推算結果合理
- [ ] 提醒機制正常觸發

---

## 七、開放問題

1. ~~備份儲存位置~~ → 存本地資料庫
2. **拉黑角色 UI**: 是否需要顯示剩餘時間？
3. **用藥提醒**: 是否需要整合系統通知？
4. ~~首次引導~~ → 可跳過
5. ~~經期症狀標籤~~ → 已提供預設標籤清單

---

## 八、預估檔案變更

### 新增檔案
- `js/core/period-calculator.js` - 經期推算邏輯
- `js/core/real-world-context.js` - 現實資訊注入
- `js/core/health-boundary-checker.js` - 關心邊界檢查
- `js/apps/health/index.js` - 健康管理頁面
- `js/apps/health/memory-template.js` - 健康記憶範本設定
- `js/apps/health/style.css` - 健康頁面樣式

### 修改檔案
- `js/components.js` - 新增 `createKakaoSideMenu`
- `css/kakao.css` - 新增選單樣式
- `js/apps/chats/chat.js` - 整合選單
- `js/api.js` - 整合資訊注入
- `js/db.js` - 新增 `health` store、修改 `ChatsDB`
- `js/router.js` - 新增 `/health` 路由
- `sw.js` - 更新快取清單