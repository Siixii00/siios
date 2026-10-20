# Siios MCP Worker

這個 Worker 提供 6 個工具給 Siios PWA 使用。

## 包含的工具

- **天氣查詢** (get_weather): 查詢指定城市的天氣資訊，讓角色可以根據天氣給出貼心建議
- **食譜搜尋** (search_recipe): 搜尋料理食譜，角色可以根據使用者喜好推薦
- **動漫搜尋** (search_anime): 搜尋動漫資訊與新番推薦
- **遊戲價格查詢** (check_game_price): 查詢 Steam、Switch 等平台的遊戲價格
- **翻譯** (translate): 翻譯文字到指定語言
- **維基查詢** (search_wiki): 搜尋維基百科資訊

## 部署步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 登入 Cloudflare

```bash
wrangler login
```

### 3. 設定 Secrets

**必填：** `MCP_API_KEY` — 自己產生一組長亂數。沒有設定時 Worker 會拒絕所有請求，避免任何人知道網址就能呼叫你的工具。

```bash
wrangler secret put MCP_API_KEY
```

其餘工具都使用免費、免金鑰的服務，不需要其他設定。

### 4. 部署

```bash
npm run deploy
```

### 5. 在 Siios PWA 設定

1. 開啟「設定」→「MCP 工具整合」
2. 新增 MCP 伺服器
3. 輸入 Worker URL，以及上一步設定的 `MCP_API_KEY`（填在 API Key 欄位）

## 本地測試

```bash
npm run dev
```

會在 http://localhost:8787 啟動。

## 查看日誌

```bash
npm run tail
```

## 檔案結構

```
├── src/
│   └── index.js      # Worker 主程式
├── wrangler.toml     # Cloudflare 設定
└── package.json
```
