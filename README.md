# Siios - 多功能 PWA 應用

一個基於純前端技術的 PWA（漸進式網頁應用），整合多種社交與娛樂功能。

## 功能模組

| 模組 | 說明 |
|------|------|
| Chats | AI 角色聊天，支援群組對話 |
| Bilibili | B 站影片瀏覽與播放 |
| Lofter | Lofter 社群瀏覽 |
| Twitter | Twitter/X 模擬介面 |
| Weverse | Weverse 粉絲社群 |
| Theater | 劇場模式 |
| Dating | 約會模擬 |
| Drift Bottle | 漂流瓶功能 |
| Bubbles | 氣泡對話 |

---

## 🆕 新功能：活動同步系統

### 功能概述

活動同步系統讓 AI 角色能夠了解您的日常數位活動，提供更個人化的互動體驗。支援：

- **瀏覽器擴充功能**：自動監聽 Twitter、Instagram、YouTube、Facebook 活動
- **隱私優先**：可調整的隱私等級，用戶完全掌控
- **跨裝置同步**：透過 GitHub Gist 實現電腦與手機間的活動同步

### 快速開始

#### 1. 啟用活動同步

1. 前往「設定」→「活動同步」
2. 點擊「隱私設定」按鈕
3. 開啟「活動同步」開關
4. 選擇隱私等級：
   - **基本統計**：僅記錄平台、活動類型、時間（推薦）
   - **包含摘要**：額外記錄活動對象、標題
   - **詳細資訊**：包含通知內容摘要（隱私風險較高）
5. 設定資料保留期限（7-90 天）
6. 選擇要記錄的平台（Twitter、Instagram、YouTube、Facebook 等）
7. 保存設定

#### 2. 安裝瀏覽器擴充功能

**Chrome / Edge**
1. 開啟瀏覽器擴充功能頁面
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. 開啟「開發人員模式」
3. 點擊「載入已解壓縮的擴充功能」
4. 選擇 `activity-extension` 資料夾
5. 點擊擴充功能圖示進行設定

**設定擴充功能**
1. 輸入您的 PWA URL（例如：`https://your-app.com`）
2. 設定同步間隔（預設 5 分鐘）
3. 選擇隱私等級
4. 選擇要監聽的平台
5. 保存設定

#### 3. 查看活動記錄

返回 PWA 的「活動同步」頁面，即可查看：
- 今日活動摘要
- 各平台活動統計
- 詳細活動記錄

---

## 🌐 跨裝置同步設定

### 使用場景

讓手機 PWA 獲取電腦上的活動記錄，實現跨裝置資料同步。

### 設定步驟

#### 第一步：準備 GitHub Token

1. 前往 https://github.com/settings/tokens/new
2. 點擊「Generate new token (classic)」
3. 設定：
   - Note: `Siios Activity Sync`
   - Expiration: 選擇有效期（建議 90 天）
   - Select scopes: **僅勾選 `gist`**
4. 點擊「Generate token」
5. **立即複製 Token**（只顯示一次）

#### 第二步：在電腦端設定

1. 在 PWA 前往「設定」→「跨裝置同步」
2. 貼上 GitHub Token
3. 點擊「測試連線」確認有效
4. 點擊「啟用跨裝置同步」
5. **重要：複製並安全保存加密金鑰**
   - 此金鑰用於解密您的活動記錄
   - 遺失將無法復原資料
   - 建議儲存在密碼管理器中

#### 第三步：在手機端加入

1. 在手機 PWA 前往「設定」→「跨裝置同步」
2. 輸入**相同的 GitHub Token**
3. 輸入**之前備份的加密金鑰**
4. 選擇「從雲端還原」
5. 等待同步完成

#### 第四步：日常使用

- **自動同步**：每 5 分鐘自動同步一次
- **手動同步**：點擊「立即同步」按鈕
- **查看裝置**：顯示所有已連結的裝置

### 安全機制

| 層級 | 說明 |
|------|------|
| 傳輸加密 | HTTPS（GitHub API）|
| 儲存加密 | AES-256-GCM 端對端加密 |
| 金鑰管理 | 本地儲存，永不上傳 |

### 注意事項

- 加密金鑰**不會**自動同步，需手動備份
- GitHub Token 僅需要 `gist` 權限，確保最小權限原則
- 停用同步會刪除 GitHub Gist 上的所有資料

---

## 活動同步 API 文件

### API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/activities/sync` | POST | 同步活動記錄 |
| `/api/activities/sync` | GET | 獲取活動列表 |
| `/api/activities/sources` | GET | 獲取裝置來源列表 |
| `/api/activities/sources` | POST | 註冊新裝置 |
| `/api/activities/settings` | GET | 獲取隱私設定 |
| `/api/activities/settings` | POST | 更新隱私設定 |
| `/api/activities/stats` | GET | 獲取統計資訊 |

### 同步活動範例

```javascript
// POST /api/activities/sync
{
  "activities": [
    {
      "platform": "instagram",
      "activity_type": "like",
      "timestamp": 1722512345678,
      "summary": {
        "title": "某貼文"
      }
    }
  ],
  "source": "extension",
  "device": {
    "type": "browser",
    "platform": "Win32"
  }
}
```

### 回應格式

```javascript
{
  "success": true,
  "synced": 10,
  "message": "Successfully synced 10 activities"
}
```

---

## 活動同步架構

```
┌─────────────────────┐
│  瀏覽器擴充功能      │
│  (Chrome/Edge)      │
│  - Twitter 檢測     │
│  - Instagram 檢測   │
│  - YouTube 檢測     │
│  - Facebook 檢測    │
└──────────┬──────────┘
           │
           ↓
    ┌──────────────┐
    │  隱私過濾器   │
    │  (可調整等級) │
    └──────┬───────┘
           │
           ↓
    ┌──────────────┐
    │  本地儲存     │
    │  (Chrome Storage) │
    └──────┬───────┘
           │
           ├─→ 直接同步 → PWA (本地)
           │
           └─→ 加密上傳 → GitHub Gist
                              │
                              ↓
                         手機 PWA 下載
                              │
                              ↓
                         解密並顯示
```

---

## 模組說明

| 模組 | 說明 |
|------|------|
| Chats | AI 角色聊天，支援群組對話 |

## 專案結構

```
siios/
├── js/
│   ├── app.js              # 主應用入口
│   ├── router.js           # 路由系統
│   ├── api.js              # API 客戶端
│   ├── db.js               # IndexedDB 封裝
│   ├── activity-interceptor.js  # 活動 API 攔截器
│   ├── apps/
│   │   ├── bilibili/       # B 站模組
│   │   ├── chats/          # 聊天模組
│   │   ├── settings/       # 設定模組
│   │   │   ├── activity-privacy-settings.js  # 活動隱私設定
│   │   │   └── cross-device-settings.js      # 跨裝置同步設定
│   │   └── ...             # 其他模組
│   ├── api/
│   │   └── activity-sync.js    # 活動同步 API
│   └── core/
│       ├── memory-saver.js
│       ├── world-info-loader.js
│       └── cross-device/   # 跨裝置同步核心
│           ├── encryption.js   # 加密工具
│           ├── github-sync.js  # GitHub API 整合
│           └── sync-manager.js # 同步管理器
├── css/
│   ├── shared.css
│   └── kakao.css
├── worldbook/              # 角色知識庫
├── bilibili-worker/        # Cloudflare Worker（B 站 API）
├── activity-extension/     # 瀏覽器擴充功能
│   ├── manifest.json
│   ├── src/
│   │   ├── background/     # 背景服務
│   │   ├── detectors/      # 平台檢測器
│   │   ├── popup/          # 彈出視窗
│   │   ├── options/        # 設定頁面
│   │   └── utils/          # 工具函數
│   └── README.md           # 擴充功能說明
├── docs/
│   ├── ACTIVITY_SYNC_DESIGN.md         # 活動同步設計文件
│   └── CROSS_DEVICE_SYNC_DESIGN.md     # 跨裝置同步設計文件
└── .kilo/
    ├── plans/              # 開發計劃
    └── skills/             # 自定義技能
```

---

## B 站影片播放功能

### 功能說明

支援兩種播放方式：

1. **在 B 站觀看** - 跳轉到 B 站 App 或網頁
2. **在 PWA 內播放** - 掃碼登入後直接播放

### 架構

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────┐
│   PWA 前端   │ ───→ │   Cloudflare Worker  │ ───→ │   B 站 API  │
│             │      │   (bilibili-worker)   │      │             │
│ - 播放選項   │      │ - QR code 登入       │      │ - 影片資訊  │
│ - QR 掃碼   │      │ - Cookie 儲存 (KV)   │      │ - 播放地址  │
│ - 影片播放   │      │ - API 轉發          │      │             │
└─────────────┘      └──────────────────────┘      └─────────────┘
```

### 部署 Cloudflare Worker

#### 1. 安裝 Wrangler

```bash
npm install -g wrangler
```

#### 2. 登入 Cloudflare

```bash
wrangler login
```

#### 3. 建立 KV Namespace

1. 開啟 https://dash.cloudflare.com
2. Workers & Pages → KV → Create namespace
3. 名稱：`BILIBILI_KV`
4. 複製 Namespace ID

#### 4. 更新設定

編輯 `bilibili-worker/wrangler.toml`：

```toml
name = "siios-bilibili-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "BILIBILI_KV"
id = "你的_NAMESPACE_ID"
```

#### 5. 部署

```bash
cd bilibili-worker
wrangler deploy
```

#### 6. 更新前端

編輯 `js/apps/bilibili/index.js`，找到 `BILI_API` 常數：

```javascript
const BILI_API = 'https://siios-bilibili-worker.你的帳號.workers.dev';
```

改成你的 Worker URL。

### API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/bilibili/auth/login` | POST | 生成 QR code |
| `/api/bilibili/auth/poll` | GET | 輪詢登入狀態 |
| `/api/bilibili/auth/status` | GET | 檢查登入狀態 |
| `/api/bilibili/video/info` | GET | 獲取影片資訊 |
| `/api/bilibili/video/playurl` | GET | 獲取播放地址 |

---

## MCP 整合指南

本專案架構支援多種 MCP（Model Context Protocol）整合。

### 為什麼不用 MCP 做 B 站功能？

MCP 適合 **AI 助手調用外部工具**，而非 **網頁前端調用 API**：

| 場景 | MCP | Worker |
|------|-----|--------|
| AI 助手查詢資料 | ✅ | ❌ |
| 網頁前端調用 API | ❌ | ✅ |
| 自動化腳本 | ✅ | ✅ |

因此 B 站功能使用 Cloudflare Worker，而非 MCP。

### 如何新增 MCP 整合

如果你想串接其他 MCP 服務：

#### 1. 安裝 MCP Server

參考 [MCP 官方文檔](https://modelcontextprotocol.io/) 安裝對應的 server。

#### 2. 配置 Kilo

在 `.kilo/kilo.json` 中加入：

```json
{
  "mcps": {
    "your-mcp-name": {
      "command": "path/to/mcp-server",
      "args": ["--option", "value"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

#### 3. 在程式碼中使用

MCP 主要用於開發階段的 AI 輔助，例如：

- 查詢 API 文檔
- 生成程式碼片段
- 分析資料結構

#### 常見 MCP Server 範例

```json
{
  "mcps": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allow"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

### Worker vs MCP 選擇指南

| 需求 | 推薦方案 |
|------|---------|
| 網頁前端需要調用 API | Cloudflare Worker |
| AI 助手需要查詢資料 | MCP |
| 需要持久化儲存 | Worker + KV / MCP + 資料庫 |
| 需要定時任務 | Worker + Cron Triggers |

---

## 開發指南

### 本地運行

直接用靜態伺服器開啟：

```bash
npx serve .
```

或使用 Python：

```bash
python -m http.server 8000
```

### 測試 Worker

```bash
cd bilibili-worker
wrangler dev
```

### 查看 Worker Logs

```bash
wrangler tail
```

---

## 技術棧

- **前端**: 純 JavaScript (ES6+), CSS3
- **資料儲存**: IndexedDB
- **後端**: Cloudflare Workers
- **資料庫**: Cloudflare KV

---

## 授權

MIT License