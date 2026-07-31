# Bilibili Worker 部署說明

這個 Cloudflare Worker 提供 B 站 QR code 登入和影片播放 API。

## 部署步驟

### 1. 安裝 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登入 Cloudflare

```bash
wrangler login
```

### 3. 建立 KV Namespace

在 Cloudflare Dashboard 建立 KV namespace：

1. 前往 https://dash.cloudflare.com
2. 選擇 Workers & Pages → KV
3. 點擊 "Create a namespace"
4. 命名為 `BILIBILI_KV`

### 4. 更新 wrangler.toml

將 KV namespace ID 加入 `wrangler.toml`：

```toml
name = "siios-bilibili-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "BILIBILI_KV"
id = "你的KV_namespace_ID"  # 從 Dashboard 取得
```

### 5. 部署

在 `bilibili-worker` 目錄下執行：

```bash
cd bilibili-worker
wrangler deploy
```

部署成功後會得到一個 URL，例如：
```
https://siios-bilibili-worker.你的帳號.workers.dev
```

### 6. 更新前端 API 地址

在 `js/apps/bilibili/index.js` 中，將 API 地址改為你的 Worker URL：

```javascript
// 將
fetch('/api/bilibili/...')

// 改為
fetch('https://siios-bilibili-worker.你的帳號.workers.dev/api/bilibili/...')
```

或者更好的做法是在 `js/config.js` 中設定：

```javascript
export const API_BASE = 'https://siios-bilibili-worker.你的帳號.workers.dev';
```

然後在各處引用。

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/bilibili/auth/login` | POST | 生成 QR code 登入 URL |
| `/api/bilibili/auth/poll` | GET | 輪詢登入狀態 |
| `/api/bilibili/auth/status` | GET | 檢查登入狀態 |
| `/api/bilibili/video/info` | GET | 獲取影片資訊 |
| `/api/bilibili/video/playurl` | GET | 獲取播放地址 |

## 自訂網域（可選）

1. 在 Cloudflare Dashboard → Workers → 你的 Worker
2. 點擊 "Triggers" → "Custom Domains"
3. 新增你的網域，例如 `api.你的網域.com`

## 費用

Cloudflare Workers 免費方案：
- 每日 100,000 次請求
- KV 讀取 100,000 次/日
- KV 寫入 1,000 次/日

對於個人使用完全足夠。

## 本地測試

```bash
wrangler dev
```

會在本機啟動 `http://localhost:8787` 進行測試。
