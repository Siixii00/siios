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

## 專案結構

```
siios/
├── js/
│   ├── app.js              # 主應用入口
│   ├── router.js           # 路由系統
│   ├── api.js              # API 客戶端
│   ├── db.js               # IndexedDB 封裝
│   ├── components.js       # UI 元件
│   ├── apps/
│   │   ├── bilibili/       # B 站模組
│   │   ├── chats/          # 聊天模組
│   │   ├── lofter/         # Lofter 模組
│   │   └── ...             # 其他模組
│   └── core/
│       ├── memory-saver.js
│       └── world-info-loader.js
├── css/
│   ├── shared.css
│   └── kakao.css
├── worldbook/              # 角色知識庫
├── bilibili-worker/        # Cloudflare Worker（B 站 API）
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