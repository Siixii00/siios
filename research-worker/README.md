# research-worker：研究參與（選填）的接收端

只接收「匿名編號 + 週別 + 用過的 App 名稱」，其他一律拒絕。完整說明見 [docs/RESEARCH_DATA.md](../docs/RESEARCH_DATA.md)。

- `POST /collect`：收一筆 `{ v, pid, week, apps }`（同一個編號同一週再送會合併 App 清單）
- `POST /delete`：收 `{ pid }`，刪掉這個編號的全部資料（使用者按「停止參加並刪除資料」時呼叫）
- 驗證規則與 PWA 共用 `js/core/research-core.js`（所以要在完整的 repo 裡部署，不能只複製這個資料夾）
- 不讀、不存來源位址、瀏覽器資訊、時間戳記

## 部署（在你自己的 Cloudflare 帳號）
```bash
cd research-worker
npx wrangler d1 create siios-research-db            # 記下輸出的 database_id
```
編輯 `wrangler.toml`：把 `database_id` 換成你的；`ALLOWED_ORIGIN` 填你的 PWA 網址（例如 `https://<帳號>.github.io`）。
```bash
npx wrangler d1 execute siios-research-db --remote --file=schema.sql
npx wrangler deploy
```
部署後會得到 `https://siios-research-worker.<你的子網域>.workers.dev`。

## 啟用
把網址填進 `js/core/research-config.js` 的 `RESEARCH_ENDPOINT`，修改 `sw.js` 的 `CACHE_NAME` 版本加一，再發佈 PWA。填了之後，設定裡才會出現「研究參與（選填）」。

## 看資料
```bash
npx wrangler d1 execute siios-research-db --remote --command "SELECT week, apps FROM app_usage"
```
匯出給論文分析時，只會看到 `pid`（匿名）、`week`、`apps` 三欄。

## 測試
```bash
npm test      # 在 repo 根目錄；包含 tests/unit/research-worker.test.mjs
```
