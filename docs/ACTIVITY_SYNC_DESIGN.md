# 活動同步系統設計

## 目標
讓 AI 角色了解用戶日常活動，提供更個人化的互動體驗。

## 核心原則

1. **隱私優先**：用戶必須手動啟用，可隨時關閉
2. **最小權限**：僅獲取必要資訊，不收集敏感內容
3. **透明化**：清楚告知收集項目，用戶可隨時查看記錄
4. **平台隔離**：每個平台獨立設定，可選擇性啟用

---

## 資料結構

### 活動記錄格式
```javascript
{
  id: "act_timestamp_random",
  platform: "instagram",      // 平台名稱
  activity_type: "like",      // 活動類型
  timestamp: 1722512345678,   // 時間戳
  summary: {                  // 摘要資訊
    count: 5,                 // 活動次數
    duration: 120,            // 時長（秒）
    contacts: ["用戶A"],       // 互動對象（可選）
    title: "某貼文"            // 標題（可選）
  },
  metadata: {
    source: "extension",      // 來源：extension | native | manual
    device: "desktop"         // 裝置類型
  },
  user_id: "user_xxx",        // 用戶 ID
  synced_at: 1722512345678    // 同步時間
}
```

### 不收集的資訊
- 訊息/郵件完整內容
- 貼文/評論完整文字
- 圖片/影片內容
- 密碼、Token 等敏感資訊
- GPS 位置資訊（除非用戶明確授權）

---

## 技術方案

### 一、iOS 端（原生 App）

#### 技術棧
- Swift + SwiftUI
- iOS 16+
- 權限：Photos, Contacts（可選）, Notifications

#### 實作方式
1. **Screen Time API**
   - 使用 `FamilyControls` framework
   - 獲取 App 使用時間統計
   - 需要 Parental Controls 權限

2. **通知監聽**
   - 使用 `UserNotifications` framework
   - 解析通知內容摘要
   - 僅處理已授權的 App

3. **通話記錄**
   - 使用 `CallKit` framework
   - 僅獲取通話時長、類型
   - 不獲取通話對象號碼（隱私）

4. **健康數據**（可選）
   - 使用 `HealthKit`
   - 步數、睡眠時間等
   - 需要明確授權

#### 架構
```
iOS Native App
├── ActivityCollector/
│   ├── ScreenTimeCollector.swift    # Screen Time API
│   ├── NotificationCollector.swift  # 通知監聽
│   ├── CallCollector.swift          # 通話記錄
│   └── HealthCollector.swift        # 健康數據（可選）
├── PrivacyManager.swift             # 隱私權限管理
├── ActivitySync.swift               # 同步到 PWA
└── ActivitySettingsView.swift       # 設定介面
```

#### 資料同步
- 透過 iCloud Sync 或 Firebase Firestore 同步到 PWA
- 使用端對端加密（E2EE）
- 用戶可在設定中查看並刪除記錄

---

### 二、Android 端（原生 App）

#### 技術棧
- Kotlin + Jetpack Compose
- Android 12+
- 權限：Usage Stats, Notifications, Contacts（可選）

#### 實作方式
1. **Usage Stats Manager**
   - 使用 `UsageStatsManager`
   - 獲取 App 使用時間統計
   - 需要 `PACKAGE_USAGE_STATS` 權限

2. **通知監聽服務**
   - 繼承 `NotificationListenerService`
   - 解析通知內容摘要
   - 僅處理已授權的 App

3. **通話記錄**
   - 使用 `CallLog` ContentProvider
   - 僅獲取通話時長、類型
   - 需要 `READ_CALL_LOG` 權限

4. **活動識別**（可選）
   - 使用 `ActivityRecognition` API
   - 識別走路、跑步、騎車等
   - 需要 `ACTIVITY_RECOGNITION` 權限

#### 架構
```
Android Native App
├── data/
│   ├── collectors/
│   │   ├── UsageStatsCollector.kt    # App 使用統計
│   │   ├── NotificationCollector.kt  # 通知監聽
│   │   ├── CallLogCollector.kt       # 通話記錄
│   │   └── ActivityCollector.kt      # 活動識別（可選）
│   └── PrivacyManager.kt             # 隱私權限管理
├── ui/
│   └── ActivitySettingsScreen.kt     # 設定介面
└── sync/
    └── ActivitySync.kt               # 同步到 PWA
```

#### 資料同步
- 透過 Firebase Firestore 或自建 API 同步
- 使用 TLS 傳輸加密
- 本地 SQLite 快取

---

### 三、電腦端（瀏覽器擴充功能）

#### 技術棧
- Manifest V3
- TypeScript
- 支援：Chrome, Edge, Firefox, Safari

#### 實作方式
1. **頁面監聽**
   - 使用 `content_scripts` 注入監聽腳本
   - 監聽 DOM 變化識別活動
   - 僅針對已授權的網站

2. **支援平台**
   - 社交媒體：Twitter, Instagram, Facebook, LinkedIn
   - 通訊：LINE Web, Discord Web, Telegram Web
   - 影音：YouTube, Twitch, Bilibili
   - 郵件：Gmail, Outlook

3. **活動識別規則**
```javascript
const PLATFORM_RULES = {
  twitter: {
    patterns: ['twitter.com', 'x.com'],
    activities: {
      like: '[data-testid="like"]',
      retweet: '[data-testid="retweet"]',
      tweet: '[data-testid="tweetTextarea"]',
      view: 'article[data-testid="tweet"]'
    }
  },
  instagram: {
    patterns: ['instagram.com'],
    activities: {
      like: '[aria-label="讚"]',
      comment: 'textarea[placeholder*="留言"]',
      view: 'article[role="presentation"]'
    }
  }
};
```

#### 架構
```
Browser Extension
├── manifest.json
├── background/
│   ├── service-worker.ts       # 背景服務
│   └── storage.ts              # 本地存儲
├── content/
│   ├── injector.ts             # 注入腳本
│   ├── detectors/              # 各平台檢測器
│   │   ├── twitter.ts
│   │   ├── instagram.ts
│   │   └── ...
│   └── privacy-filter.ts       # 隱私過濾
├── popup/
│   └── settings.html           # 設定介面
└── sync/
    └── activity-sync.ts        # 同步到 PWA
```

#### 資料同步
- 透過 `chrome.storage.sync` 或 Firebase
- 使用 AES 加密敏感資訊
- 用戶可在擴充功能設定中管理

---

### 四、PWA 整合

#### 設定介面
已在 `js/apps/activity/index.js` 實作基礎框架，需擴充：

1. **隱私設定頁面**
   - 各平台開關
   - 資料保留期限
   - 一鍵清除功能

2. **活動來源管理**
   - 查看已連結裝置
   - 授權管理
   - 同步狀態

3. **AI 存取控制**
   - 設定哪些角色可存取
   - 存取範圍限制
   - 存取記錄查詢

#### DB 擴充
```javascript
// 在 db.js 新增
const ActivitySettingsDB = {
  async getSettings() {
    const database = await initDB();
    return database.get('activitySettings', 'global');
  },
  
  async updateSettings(settings) {
    const database = await initDB();
    await database.put('activitySettings', {
      id: 'global',
      ...settings,
      updated_at: Date.now()
    });
  }
};

const ActivitySourcesDB = {
  async registerSource(source) {
    // 註冊裝置來源
  },
  
  async getSources() {
    // 獲取所有已註冊來源
  }
};
```

---

## 隱私保護機制

### 1. 分層授權
```
Level 1: 基本統計（預設）
├── App 使用時間
├── 平台活動次數
└── 時間分布

Level 2: 包含摘要（需要二次確認）
├── 互動對象名稱
├── 活動標題
└── 時長統計

Level 3: 詳細資訊（需要密碼確認）
├── 通知內容摘要
├── 搜尋關鍵字
└── 位置資訊
```

### 2. 平台隔離
- 每個平台獨立開關
- 可單獨設定詳細程度
- 可設定黑名單

### 3. 資料保留
- 預設保留 30 天
- 可設定 7/14/30/90 天
- 可手動清除

### 4. 存取控制
```javascript
const ACCESS_CONTROL = {
  ai_can_access: true,           // AI 是否可存取
  accessible_characters: [],     // 可存取的角色清單
  accessible_platforms: [],      // 可存取的平台
  blacklisted_keywords: [],      // 黑名單關鍵字
  time_restriction: {            // 時間限制
    start: '09:00',
    end: '22:00'
  }
};
```

### 5. 透明化
- 所有活動記錄可查詢
- 每次同步顯示通知
- 每月隱私報告

---

## 實作優先順序

### Phase 1: 基礎建設（2 週）
1. 擴充 ActivityDB 結構
2. 實作隱私設定介面
3. 實作基礎同步 API

### Phase 2: 瀏覽器擴充功能（3 週）
1. 開發基礎框架
2. 實作 Twitter, Instagram 檢測
3. 實作隱私過濾
4. 實作同步機制

### Phase 3: Android 原生 App（4 週）
1. 使用統計收集
2. 通知監聽服務
3. 通話記錄整合
4. 同步到 PWA

### Phase 4: iOS 原生 App（4 週）
1. Screen Time API 整合
2. 通知監聽
3. 通話記錄
4. iCloud 同步

### Phase 5: AI 整合（2 週）
1. 實作 AI 存取 API
2. 實作上下文注入
3. 優化提示詞

---

## 法規遵循

### GDPR 合規
- 明確告知資料收集範圍
- 提供資料下載功能
- 提供完全刪除功能
- 記錄同意歷史

### App Store 審核
- 明確說明權限用途
- 提供隱私政策連結
- 遵守最小權限原則

### 使用者條款
- 活動同步為選用功能
- 用戶隨時可關閉
- 資料不上傳至第三方伺服器（除非用戶選擇雲端同步）
