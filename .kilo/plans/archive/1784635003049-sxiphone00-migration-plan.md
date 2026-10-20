# SXiPhone00 功能遷移計畫

## 核心原則

1. **以 siios 儲存架構為主**：使用 IndexedDB (idb)，不走 sxiphone00 的 localStorage/localforage 路線
2. **只遷移功能和 UI**：應用程式的 render 邏輯、CSS、元件
3. **資料存取統一使用 siios DB 模組**：ChatsDB、MessagesDB、WorldInfoDB、MemoryDB、SettingsDB、CharactersDB
4. **不遷移 sxiphone00 的儲存問題**：不使用其 storage scripts、localforage 配置、Firebase 相關功能

## 目標
將 sxiphone00 專案的全部 45 個應用程式遷移到 siios（SXIOS），保留所有功能。

## 遷移策略

### 重複部分（暫緩，保留兩邊代碼）
以下應用程式在 siios 已有對應實現，**暫不遷移**，等新架構完成後再合併：

| sxiphone00 | siios | 說明 |
|------------|-------|------|
| chat | apps/chats/ | 對話功能，siios 版本較簡單 |
| settings | apps/settings/ | 設定功能，siios 版本較簡單 |
| worldbook | apps/world-info/ | World Info 功能 |

### 非重複部分（立即遷移）

#### 批次 1：常用工具（6 個）
- album（相簿）
- weather（天氣）
- music（音樂播放器）
- pomodoro（番茄鐘）
- phone（電話）
- chrome（瀏覽器）

#### 批次 2：社交平台模擬（10 個）
- facebook（臉書模擬）
- facebook-settings（臉書設定，整合到 facebook）
- instagram（Instagram 模擬）
- twitter（推特模擬）
- youtube（YouTube 模擬）
- bilibili（Bilibili 模擬）
- twitch（Twitch 模擬）
- weverse（Weverse 模擬）
- lofter（Lofter 模擬）
- ao3（AO3 模擬）

#### 批次 3：娛樂/遊戲（4 個）
- arcade（街機廳，含多個遊戲）
- match-3（消消樂遊戲）
- bubbles（氣泡遊戲）
- theater（劇場）

#### 批次 4：約會/社交（4 個）
- dating（約會）
- exchange-diary（交換日記）
- drift-bottle（漂流瓶）
- pub（酒館）

#### 批次 5：生活服務（8 個）
- delivery（外送）
- daily-recipe（每日食譜）
- taobao（購物）
- kakaopay（支付）
- payment-code（付款碼）
- timetree（時間樹）
- home（宅家）
- farm（農場）

#### 批次 6：創作工具（3 個）
- personal-wiki（個人 Wiki）
- smart-painter（照相館）
- guzi-guide（谷子圖鑑）

#### 批次 7：外觀/設定（7 個）
- appearance（外觀設定）
- theme-shop（主題商店）
- emoji-shop（表情商店）
- gift-shop（禮物商店）
- passkey（Passkey）
- touch（輔助觸控）
- widget（小工具）

---

## 技術實作規範

### 1. 應用程式標準格式

```javascript
// js/apps/<app-name>/index.js
import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js'; // 按需導入

async function renderAppName(params) {
    const container = createElement('div', 'app-container bg-ios-bg');
    // ... UI 邏輯
    return { element: container, cleanup: null };
}

export default {
    id: '<app-id>',
    name: '<App Name>',
    icon: '<icon_name>',
    routes: [{ path: '/<app-path>', render: renderAppName }],
    navItem: { label: '<App Name>', icon: '<icon_name>', path: '/<app-path>', showInNav: true, order: <number> },
    styles: () => import('./style.css')
};
```

### 2. 資料存取規範

**siios 使用 IndexedDB，不使用 localStorage。所有資料存取使用 DB 模組：**

```javascript
import { SettingsDB, CharactersDB, WorldInfoDB, MemoryDB, ChatsDB, MessagesDB } from '../../db.js';

// SettingsDB - 應用設定
await SettingsDB.set('weather_location', '台北');
const location = await SettingsDB.get('weather_location');
await SettingsDB.set('music_playlist', JSON.stringify(playlist));

// 如需新的 ObjectStore，在 db.js 的 upgrade() 中新增
if (!database.objectStoreNames.contains('diary')) {
    const diaryStore = database.createObjectStore('diary', { keyPath: 'id' });
    diaryStore.createIndex('timestamp', 'timestamp');
}
```

### 3. 不遷移的内容

以下 sxiphone00 的内容**不遷移**（避免儲存問題）：
- `apps/scripts/` 下的儲存相關腳本（sx-storage.js, localStorage-mirror.js 等）
- localforage 配置
- Firebase 相關功能（除非需要雲端同步）
- 複雜的記憶系統腳本（siios 已有自己的 memory-system）

---

## 預估工作量

| 批次 | 數量 | 預估時間 |
|------|------|----------|
| 1 | 6 | 3 小時 |
| 2 | 10 | 5 小時 |
| 3 | 4 | 3 小時 |
| 4 | 4 | 2 小時 |
| 5 | 8 | 3 小時 |
| 6 | 3 | 2 小時 |
| 7 | 7 | 3 小時 |
| **總計** | **42** | **~19 小時** |

---

## 架構差異分析

### sxiphone00 架構
- 每個 app 是獨立的 HTML 檔案 (`apps/<name>/<name>.html`)
- 使用 iframe 載入應用程式
- 使用 localStorage 和 localforage 儲存資料（有儲存問題）

### siios (SXIOS) 架構
- SPA 模式，ES modules 動態 import
- 每個 app 匯出標準配置物件
- Router 註冊路由，動態渲染
- IndexedDB (idb) 儲存資料（乾淨、單一）

## 遷移步驟（每個 App）

1. **建立目錄**：`js/apps/<app-name>/`
2. **建立 index.js**：從原 HTML/JS 轉換 render 函式
3. **建立 style.css**：整合樣式
4. **改寫資料存取**：使用 siios DB 模組（`SettingsDB` 等）
5. **更新 registry.js**：新增 import
6. **測試功能**

## 下一步

1. 開始批次 1 的應用程式遷移（album, weather, music, pomodoro, phone, chrome）
2. 逐步完成所有批次
3. 全部完成後處理重複部分合併
