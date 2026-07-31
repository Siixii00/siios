# B 站影片播放適配 - 使用者指南

## 功能說明

實現了在 PWA 中播放 B 站影片的功能：

1. **在 B 站觀看** - 跳轉到 B 站 App 或網頁
2. **在 PWA 內播放** - 掃碼登入後，直接在 PWA 中播放影片

---

## 部署步驟

### 第一步：安裝 Wrangler

打開終端機，執行：

```bash
npm install -g wrangler
```

### 第二步：登入 Cloudflare

```bash
wrangler login
```

瀏覽器會開啟登入頁面，完成授權後回到終端機。

### 第三步：建立 KV Namespace

1. 開啟 https://dash.cloudflare.com
2. 左側選單點選 **Workers & Pages** → **KV**
3. 點擊 **Create a namespace**
4. 名稱輸入 `BILIBILI_KV`
5. 點擊 **Add**
6. 建立後，複製 Namespace ID（類似 `abc123def456...`）

### 第四步：更新 wrangler.toml

編輯 `bilibili-worker/wrangler.toml`，加入 KV 設定：

```toml
name = "siios-bilibili-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "BILIBILI_KV"
id = "你的Namespace_ID"  # 貼上第三步複製的 ID
```

### 第五步：部署

在專案目錄執行：

```bash
cd bilibili-worker
wrangler deploy
```

部署成功後會顯示：

```
Published siios-bilibili-worker
  https://siios-bilibili-worker.你的帳號.workers.dev
```

複製這個 URL。

### 第六步：更新前端 API 地址

編輯 `js/apps/bilibili/index.js`，找到第 154 行：

```javascript
const BILI_API = 'https://siios-bilibili-worker.你的帳號.workers.dev';
```

將 URL 改成第五步得到的實際網址。

### 第七步：測試

1. 開啟 PWA
2. 進入 B 站功能
3. 點擊任意影片
4. 選擇「在 PWA 內播放」
5. 會顯示登入提示，點擊「登入 B 站」
6. 用 B 站 App 掃描 QR code
7. 登入成功後，影片會在 PWA 內播放

---

## 專案結構

```
bilibili-worker/
├── wrangler.toml      # Cloudflare 設定檔
├── package.json
├── README.md
└── src/
    └── index.js       # Worker 主程式

js/apps/bilibili/
├── index.js           # 前端邏輯
└── style.css          # 樣式
```

---

## API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/bilibili/auth/login` | POST | 生成 QR code |
| `/api/bilibili/auth/poll` | GET | 輪詢登入狀態 |
| `/api/bilibili/auth/status` | GET | 檢查登入狀態 |
| `/api/bilibili/video/info` | GET | 獲取影片資訊 |
| `/api/bilibili/video/playurl` | GET | 獲取播放地址 |

---

## 常見問題

### Q: 部署失敗怎麼辦？

確認：
1. 已登入 Cloudflare (`wrangler login`)
2. KV namespace ID 正確
3. 在 `bilibili-worker` 目錄下執行 `wrangler deploy`

### Q: 影片無法播放？

可能原因：
1. 未登入 B 站 - 先掃碼登入
2. 影片有版權限制 - 用「在 B 站觀看」
3. API 返回錯誤 - 檢查 Worker logs

### Q: 如何查看 Worker logs？

```bash
wrangler tail
```

然後在 PWA 中操作，終端機會顯示即時 log。

### Q: 如何本地測試？

```bash
cd bilibili-worker
wrangler dev
```

會在 `http://localhost:8787` 啟動本地伺服器。

---

## 費用說明

Cloudflare Workers 免費方案：

| 項目 | 免費額度 |
|------|---------|
| 請求次數 | 100,000 次/日 |
| KV 讀取 | 100,000 次/日 |
| KV 寫入 | 1,000 次/日 |

個人使用完全足夠。
