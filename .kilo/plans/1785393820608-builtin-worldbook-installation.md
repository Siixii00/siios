# 內建世界書安裝功能實作計畫

## 目標
將 `worldbook/` 資料夾中的世界書 JSON 檔案轉換為 siios 可用的格式，並提供使用者介面來選擇和安裝世界書到資料庫。

---

## 資料映射規則

### 世界書 JSON 結構 → siios DB 映射

| 世界書類別 | 目標 DB | priority 預設值 |
|-----------|---------|----------------|
| `sx_worldbook_cot` | GlobalSettingsDB | `front` |
| `sx_worldbook_style` | GlobalSettingsDB | `front` |
| `sx_worldbook_global` | GlobalSettingsDB | `front` |
| `sx_worldbook_keywords` | KeywordSettingsDB | `middle` |
| `sx_worldbook_backend` | GlobalSettingsDB | `back` |

### 資料轉換

```javascript
// 世界書條目格式
{
  "title": "🔮Claude 4.2 最高指令",
  "triggers": ["claude", "4.2"],
  "content": "...",
  "enabled": true
}

// 轉換為 GlobalSettingsDB 格式
{
  "name": "🔮Claude 4.2 最高指令",
  "content": "...",
  "priority": "front", // 或 middle/back
  "enabled": true
}

// 轉換為 KeywordSettingsDB 格式
{
  "name": "...",
  "content": "...",
  "keywords": ["claude", "4.2"], // triggers → keywords
  "priority": "middle",
  "enabled": true
}
```

---

## 實作步驟

### 1. 新增世界書管理頁面

**檔案**: `js/apps/world-info/builtin-worldbooks.js`

功能：
- 顯示 `worldbook/` 資料夾中所有可用的世界書清單
- 每個世界書顯示：名稱、描述、條目數量、安裝狀態
- 提供「安裝」按鈕，將選中的世界書寫入 DB
- 顯示已安裝的世界書，支援「啟用/停用」切換

### 2. 新增世界書安裝服務

**檔案**: `js/core/worldbook-installer.js`

```javascript
class WorldbookInstaller {
  // 掃描 worldbook/ 資料夾中的所有 JSON 檔案
  async scanWorldbooks()
  
  // 安裝單一世界書到 DB
  async installWorldbook(worldbookId)
  
  // 取得已安裝的世界書清單
  async getInstalledWorldbooks()
  
  // 切換世界書啟用狀態
  async toggleWorldbook(worldbookId, enabled)
}
```

### 3. 修改 World Info 首頁

**檔案**: `js/apps/world-info/index.js`

新增選項：
```javascript
{
  title: '內建世界書',
  description: '安裝並管理內建的世界書',
  onClick: () => Router.navigate('/builtin-worldbooks')
}
```

### 4. 註冊路由

**檔案**: `js/apps/world-info/index.js`

新增路由：
```javascript
{ path: '/builtin-worldbooks', render: renderBuiltinWorldbooks }
```

### 5. 整合到 world-info-loader

**檔案**: `js/core/world-info-loader.js`

確保安裝的世界書會被 `loadWorldInfoContext()` 正確載入。

---

## 檔案結構

```
js/
├── apps/world-info/
│   ├── index.js              # 修改：新增路由和選項
│   ├── builtin-worldbooks.js # 新增：世界書管理頁面
│   └── ...
├── core/
│   ├── world-info-loader.js  # 確認：正確載入已安裝世界書
│   └── worldbook-installer.js # 新增：世界書安裝服務
└── db.js                     # 確認：現有 DB 結構足夠使用

worldbook/
├── ivory_tower_worldbook.json
├── 4o_worldbook.json
├── gemini31_worldbook.json
└── ... (其他世界書檔案)
```

---

## 世界書安裝流程

1. 使用者進入 `/world-info` → 點擊「內建世界書」
2. 系統掃描 `worldbook/` 資料夾，顯示所有可用的世界書
3. 使用者選擇要安裝的世界書，點擊「安裝」
4. 系統將世界書內容寫入對應的 DB：
   - `cot/style/global/backend` → GlobalSettingsDB
   - `keywords` → KeywordSettingsDB
5. 在 SettingsDB 記錄已安裝的世界書 ID 清單
6. 世界書設定全局生效，所有聊天室都會套用

---

## 資料持久化

### SettingsDB 新增設定

```javascript
// 記錄已安裝的世界書
SettingsDB.set('installed_worldbooks', ['ivory_tower', '4o', 'gemini31'])

// 記錄每個世界書的啟用狀態
SettingsDB.set('worldbook_enabled', {
  'ivory_tower': true,
  '4o': true,
  'gemini31': false
})
```

### 安裝時命名規則

為了區分不同世界書的條目，在 DB 中儲存時加上前綴：

```javascript
// GlobalSettingsDB
{
  name: '[ivory_tower] 🔮Claude 4.2 最高指令',
  content: '...',
  priority: 'front',
  enabled: true
}

// KeywordSettingsDB
{
  name: '[ivory_tower] 某關鍵字設定',
  keywords: [...],
  content: '...',
  priority: 'middle',
  enabled: true
}
```

---

## 驗證步驟

1. 安裝一個世界書後，重新載入頁面，確認世界書仍存在
2. 進行聊天，確認世界書內容被正確載入到 API 請求
3. 停用一個世界書，確認其條目不會被載入
4. 安裝多個世界書，確認不會互相覆蓋

---

## 開放問題

無。