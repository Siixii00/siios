# 跨裝置活動同步設計

## 目標
讓手機 PWA 可以獲取電腦上的活動記錄，實現跨裝置同步。

---

## 技術方案

### 方案一：雲端儲存服務（推薦）

#### 架構
```
電腦瀏覽器擴充功能
       ↓
   加密活動記錄
       ↓
   雲端儲存服務 ←→ 手機 PWA
       ↓                ↓
   自動同步         解密並顯示
```

#### 支援的雲端服務

1. **GitHub Gist**（免費、穩定）
   - 優點：免費、GitHub 生態、版本控制
   - 缺點：需要 GitHub 帳號、API 限制
   - 適合：技術用戶、開發者

2. **Google Drive API**
   - 優點：普及率高、儲存空間大
   - 缺點：需要 Google 帳號、設定較複雜
   - 適合：一般用戶

3. **Cloudflare KV + D1**
   - 優點：快速、與現有架構整合
   - 缺點：需要部署 Worker
   - 適合：已部署 Cloudflare 的用戶

4. **Firebase Firestore**
   - 優點：即時同步、跨平台
   - 缺點：需要 Firebase 專案
   - 適合：需要即時性的場景

---

### 方案二：P2P 同步（WebRTC）

#### 架構
```
電腦 PWA ←→ WebRTC Channel ←→ 手機 PWA
```

#### 特點
- 不需要中心伺服器
- 即時同步
- 需要配對機制（QR Code）
- 兩台裝置需同時在線

#### 適用場景
- 重視隱私
- 不想使用第三方服務
- 兩台裝置常在同一網路

---

### 方案三：本地網路同步

#### 架構
```
電腦 PWA (Server) ←→ 區域網路 ←→ 手機 PWA (Client)
```

#### 特點
- 不需要網際網路
- 快速、安全
- 需要在同一區域網路
- 需要電腦開啟服務

---

## 推薦實作：GitHub Gist + 端對端加密

### 優點
1. **完全免費**：GitHub Gist 免費使用
2. **隱私保護**：端對端加密，GitHub 看不到內容
3. **版本控制**：可查看歷史記錄
4. **穩定可靠**：GitHub 服務穩定
5. **易於整合**：已有 GitHub 設定介面

### 流程

#### 1. 設定階段
```
用戶 → PWA 設定 → 輸入 GitHub Token
                      ↓
                  選擇同步方式
                      ↓
              生成加密金鑰（自動）
                      ↓
                儲存設定到本地
```

#### 2. 電腦端上傳
```
瀏覽器擴充功能
       ↓
   收集活動記錄
       ↓
   應用隱私過濾
       ↓
   AES-256 加密
       ↓
   上傳到 GitHub Gist
       ↓
   更新同步時間戳
```

#### 3. 手機端下載
```
手機 PWA
       ↓
   定時檢查更新
       ↓
   下載 Gist 內容
       ↓
   AES-256 解密
       ↓
   合併到本地資料庫
       ↓
   更新 UI
```

---

## 資料結構

### Gist 檔案結構
```json
{
  "activities.json": {
    "encrypted": true,
    "algorithm": "AES-256-GCM",
    "version": 1,
    "device_id": "device_abc123",
    "timestamp": 1722512345678,
    "data": "encrypted_base64_string..."
  },
  "metadata.json": {
    "devices": [
      {
        "id": "device_abc123",
        "name": "Chrome on Windows",
        "last_sync": 1722512345678,
        "count": 150
      }
    ],
    "schema_version": 1
  }
}
```

### 本地設定
```javascript
{
  cross_device_enabled: true,
  sync_method: 'github_gist',
  github_token: 'ghp_xxx',  // 加密儲存
  gist_id: 'gist_id_xxx',
  encryption_key: 'generated_key',  // 本地儲存
  sync_interval: 300000,  // 5 分鐘
  devices: [
    {
      id: 'device_abc123',
      name: 'Chrome on Windows',
      type: 'browser',
      last_seen: 1722512345678
    }
  ]
}
```

---

## 加密機制

### 金鑰生成
```javascript
// 使用 Web Crypto API
async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  // 匯出為 Base64
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}
```

### 加密
```javascript
async function encrypt(data, keyBase64) {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw', keyData, 'AES-GCM', false, ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
}
```

### 解密
```javascript
async function decrypt(encryptedObj, keyBase64) {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw', keyData, 'AES-GCM', false, ['decrypt']
  );
  
  const iv = Uint8Array.from(atob(encryptedObj.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encryptedObj.data), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

---

## 實作優先順序

### Phase 1: GitHub Gist 同步（1 週）
1. 擴充 PWA 設定介面
2. 實作 GitHub API 整合
3. 實作加密/解密功能
4. 實作同步邏輯

### Phase 2: 擴充功能整合（3 天）
1. 擴充功能加入雲端同步
2. 實作自動上傳
3. 實作衝突解決

### Phase 3: 其他服務支援（2 週）
1. Google Drive API
2. Firebase Firestore
3. Cloudflare Worker

### Phase 4: P2P 同步（選用，1 週）
1. WebRTC 配對
2. 即時同步

---

## 衝突解決策略

### Last-Write-Wins（LWW）
- 最後修改時間戳優先
- 簡單但可能遺失資料

### Operational Transform（OT）
- 記錄操作日誌
- 合併衝突操作
- 複雜但資料不遺失

### 推薦：Merge by Timestamp
```javascript
function mergeActivities(local, remote) {
  const merged = new Map();
  
  // 本地活動
  local.forEach(a => {
    merged.set(a.id, a);
  });
  
  // 遠端活動（較新者覆蓋）
  remote.forEach(a => {
    const existing = merged.get(a.id);
    if (!existing || a.timestamp > existing.timestamp) {
      merged.set(a.id, a);
    }
  });
  
  return Array.from(merged.values());
}
```

---

## 隱私與安全

### 加密層級
1. **傳輸加密**：HTTPS（GitHub API）
2. **儲存加密**：AES-256-GCM
3. **金鑰管理**：本地儲存，不上傳

### 安全措施
- GitHub Token 使用最小權限（僅 gist）
- 加密金鑰不自動同步（用戶需手動備份）
- 定期提醒備份金鑰

### 用戶控制
- 可隨時停止同步
- 可清除雲端資料
- 可查看同步記錄

---

## 使用者體驗

### 初次設定
1. 前往「設定」→「跨裝置同步」
2. 選擇同步方式（GitHub Gist）
3. 輸入 GitHub Token
4. 系統自動生成加密金鑰
5. **重要：備份加密金鑰**
6. 開始同步

### 其他裝置加入
1. 在新裝置開啟「跨裝置同步」
2. 輸入相同的 GitHub Token
3. **輸入加密金鑰**
4. 選擇「從雲端還原」
5. 同步完成

### 日常使用
- 自動背景同步（每 5 分鐘）
- 手動同步按鈕
- 查看同步狀態
- 管理已連結裝置

---

## 實作檔案

需要新增以下檔案：

1. `js/core/cross-device-sync.js` - 核心同步邏輯
2. `js/core/encryption.js` - 加密工具
3. `js/core/github-sync.js` - GitHub API 整合
4. `js/apps/settings/cross-device-settings.js` - 設定頁面
5. `activity-extension/src/utils/cloud-sync.js` - 擴充功能雲端同步

---

## 下一步

是否要開始實作 GitHub Gist 同步功能？
