# Siios - AI 角色互動 PWA 平台

一個以 AI 角色互動為核心的漸進式網頁應用（PWA），整合記憶系統、世界觀管理、跨裝置同步等多種功能。

## 核心功能

### AI 聊天系統
- **角色對話**：支援單人與群組對話（2-4 角色）
- **記憶系統**：AI 角色具備持久記憶，支援語意搜尋、記憶衰減與強化
- **世界觀（World Info）**：角色知識庫系統，為角色扮演提供上下文
- **MCP 整合**：支援 Model Context Protocol 工具調用

### 活動同步系統
- **瀏覽器擴充功能**：自動監聯 Twitter、Instagram、YouTube、Facebook 活動
- **隱私控制**：可調整隱私等級，用戶完全掌控
- **跨裝置同步**：透過 GitHub Gist 實現電腦與手機間的加密同步

### 其他功能模組

| 模組 | 說明 |
|------|------|
| Bilibili | B 站影片瀏覽與播放 |
| Twitter/X | Twitter 模擬介面 |
| Lofter | Lofter 社群瀏覽 |
| Weverse | Weverse 粉絲社群 |
| Instagram | Instagram 介面 |
| AO3 | Archive of Our Own 瀏覽 |
| Theater | 劇場模式 - 故事創作與管理 |
| Dating | 約會模擬 |
| Drift Bottle | 漂流瓶功能 |
| Bubbles | 氣泡對話 |
| Health | 健康追蹤（生理週期、用藥提醒） |

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | 純 JavaScript (ES6+)，無框架 |
| 樣式 | Tailwind CSS (CDN)、自訂主題 |
| 資料儲存 | IndexedDB (idb v8) |
| 離線支援 | Service Worker (v36) |
| 後端服務 | Cloudflare Workers |
| 雲端儲存 | GitHub Gist (AES-256-GCM 加密) |
| 圖示 | Material Symbols、Font Awesome 6.5.1 |

---

## 專案結構

```
siios/
├── index.html              # 主入口
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
│
├── js/
│   ├── app.js              # 主應用初始化
│   ├── router.js           # Hash 路由系統
│   ├── api.js              # LLM 串流 API 客戶端
│   ├── db.js               # IndexedDB 封裝
│   ├── components.js       # UI 元件庫
│   ├── lockscreen.js       # 鎖定畫面
│   ├── homescreen.js       # 主畫面
│   │
│   ├── apps/               # 功能模組 (45+)
│   │   ├── chats/          # AI 聊天系統
│   │   ├── bilibili/       # B 站模組
│   │   ├── twitter/        # Twitter 模組
│   │   ├── theater/        # 劇場模式
│   │   ├── settings/       # 設定模組
│   │   ├── health/         # 健康追蹤
│   │   └── ...             # 其他模組
│   │
│   └── core/
│       ├── memory-system/  # 記憶管理系統
│       ├── embedding/      # 向量嵌入客戶端
│       ├── cross-device/   # 跨裝置同步
│       └── mcp-intelligence/  # MCP 工具整合
│
├── css/
│   ├── shared.css          # 共用樣式
│   ├── ios.css             # iOS 風格
│   ├── kakao.css           # KakaoTalk 主題
│   └── notion-tokens.css   # Notion 風格
│
├── worldbook/              # 角色知識庫 (40+ JSON)
│
├── bilibili-worker/        # Cloudflare Worker
│   ├── package.json
│   └── src/index.js
│
├── activity-extension/     # 瀏覽器擴充功能
│   ├── manifest.json
│   └── src/
│       ├── background/     # 背景服務
│       ├── detectors/      # 平台檢測器
│       └── popup/          # 彈出視窗
│
└── data/                   # 靜態資料
    ├── bilibili_videos.json
    └── bilibili_live.json
```

---

## 快速開始

### 本地運行

```bash
npx serve .
# 或
python -m http.server 8000
```

### 設定 API

1. 開啟應用程式
2. 前往「設定」→「API 設定」
3. 輸入：
   - API URL（OpenAI 相容端點）
   - API Key
   - 模型名稱

---

## 記憶系統

AI 角色的記憶系統具備以下功能：

| 功能 | 說明 |
|------|------|
| 感官提取 | 提取視覺、聽覺、嗅覺、觸覺、味覺細節 |
| 情緒標記 | 價值/喚醒度評分 |
| 時空標記 | 地點、環境、上下文 |
| 衰減引擎 | 基於時間的記憶淡化 |
| 睡眠引擎 | 閒置時的記憶整合 |
| 向量搜尋 | 透過嵌入進行語意檢索 |

記憶類型：動態、情節、語意、程序

---

## 世界觀（World Info）

為角色扮演提供背景知識：

- 優先級插入（前/中/後）
- 關鍵字與語意匹配
- 角色專屬過濾
- 禁止內容處理

---

## 活動同步設定

### 1. 啟用活動同步

1. 前往「設定」→「活動同步」
2. 開啟「活動同步」
3. 選擇隱私等級：
   - **基本統計**：僅記錄平台、活動類型、時間
   - **包含摘要**：額外記錄活動對象、標題
   - **詳細資訊**：包含通知內容摘要
4. 設定資料保留期限（7-90 天）

### 2. 安裝瀏覽器擴充功能

**Chrome / Edge**
1. 開啟 `chrome://extensions/` 或 `edge://extensions/`
2. 開啟「開發人員模式」
3. 點擊「載入已解壓縮的擴充功能」
4. 選擇 `activity-extension` 資料夾

### 3. 跨裝置同步

使用 GitHub Gist 實現加密同步：

1. 建立 GitHub Token（僅需 `gist` 權限）
2. 在電腦端設定並備份加密金鑰
3. 在手機端輸入相同的 Token 與金鑰

**安全機制**：AES-256-GCM 端對端加密，金鑰永不上傳

---

## B 站影片播放

### 架構

```
PWA 前端 → Cloudflare Worker → B 站 API
         (QR 登入、Cookie 儲存)
```

### 部署 Worker

```bash
# 安裝 Wrangler
npm install -g wrangler

# 登入
wrangler login

# 建立 KV Namespace（名稱：BILIBILI_KV）
# 在 Cloudflare Dashboard 操作

# 更新 wrangler.toml 中的 KV ID

# 部署
cd bilibili-worker
wrangler deploy
```

### API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/bilibili/auth/login` | POST | 生成 QR code |
| `/api/bilibili/auth/poll` | GET | 輪詢登入狀態 |
| `/api/bilibili/auth/status` | GET | 檢查登入狀態 |
| `/api/bilibili/video/info` | GET | 獲取影片資訊 |
| `/api/bilibili/video/playurl` | GET | 獲取播放地址 |

---

## 活動同步 API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/activities/sync` | POST | 同步活動記錄 |
| `/api/activities/sync` | GET | 獲取活動列表 |
| `/api/activities/sources` | GET/POST | 裝置來源管理 |
| `/api/activities/settings` | GET/POST | 隱私設定 |
| `/api/activities/stats` | GET | 統計資訊 |

---

## MCP 整合

### Worker vs MCP 選擇

| 需求 | 推薦方案 |
|------|---------|
| 網頁前端調用 API | Cloudflare Worker |
| AI 助手查詢資料 | MCP |
| 持久化儲存 | Worker + KV |
| 定時任務 | Worker + Cron Triggers |

### 配置 MCP

在 `.kilo/kilo.json` 中加入：

```json
{
  "mcps": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "ghp_xxx" }
    }
  }
}
```

---

## 測試

專案使用手動測試，測試檔案：

- `tests/test-scroll.html`
- `tests/test-bilibili-api.html`
- `tests/test-cors.html`
- `tests/test-error.html`
- `tests/test-mcp-workers.html`

---

## 開發指令

```bash
# 本地運行
npx serve .

# 測試 Worker
cd bilibili-worker && wrangler dev

# 查看 Worker 日誌
wrangler tail

# 部署 Worker
cd bilibili-worker && wrangler deploy
```

---

## 授權

MIT License
