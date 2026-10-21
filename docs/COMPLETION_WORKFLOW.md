# 完工工作流（掃描於 2026-10-19）

來源：`.kilo/plans/*`、`IMPROVEMENTS.md`、程式碼中的 TODO/「尚未實作」標記、殘留檔案。
重點：**多數項目是「程式碼已寫、但從未驗證」**，不是沒寫。每個階段完成後勾選、commit，再進下一階段。

狀態圖例：🔴 確定未做 ／ 🟡 有程式碼但未驗證 ／ ⚪ 清理

---

## 🔒 開工關卡（每個階段、每個任務都必須先通過）

**未完成以下步驟，不得修改任何檔案。** 每個階段開始時重做一次，不得沿用上一階段的結果。

1. **閱讀** [`.kilo/skills/karpathy-guidelines/SKILL.md`](../.kilo/skills/karpathy-guidelines/SKILL.md)（實際讀檔，不憑記憶）。
2. **宣告**：在回覆中寫明「已讀 karpathy-guidelines，開始階段 N」，並列出：
   - 假設（不確定的就先問使用者）
   - 本階段的成功標準與驗證方式（格式：`步驟 → verify: 檢查方式`）
3. **確認範圍**：只做本階段清單內的項目，每個變更行都要能對應到清單項目。
4. **破壞性操作**（刪除、覆寫）：先列清單給使用者確認，確認後才執行。

### 各準則在每個階段的套用方式

| 準則 | 要求 |
|---|---|
| 1 先想再寫 | 開工前先宣告假設；有多種解法就列出，不默默選擇 |
| 2 簡單優先 | 只補缺口，不加沒被要求的功能、抽象、設定 |
| 3 精準修改 | 不順手重構、不改格式；看到無關死碼只記錄在「發現」欄，不刪 |
| 4 目標驅動 | 每項任務有可檢查的完成標準；驗證通過才勾選 |

### 階段收尾（每個階段都要做）
- [ ] 逐項勾選並附驗證結果（沒驗證過就不勾）
- [ ] 回頭檢查 diff：每個變更行都能對應到清單項目
- [ ] 無關發現記錄於本文件末尾「發現」欄，不順手處理
- [ ] 一個階段一個 commit，不推送，除非使用者要求

---

## 階段 0：清理（低風險，先做以減少雜訊）⚪
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [x] 刪除殘留備份：`js/apps/bilibili/index.js.bak`、`js/apps/youtube/index.js.bak`、`js/apps/twitter/index.js.backup`、`js/apps/twitter/index.js.new`、`scripts/discord-bot-worker.js.backup`（已完成，已 git rm）
- [x] 確認後刪除 `scripts/temp/*`（6 個一次性改檔腳本）、空檔 `Continue`（已完成）
- [x] `bilibili-worker/src/` 正式版是 `index.js`（超集），其餘 8 個舊版檔案已移除（2026-10-21）
- [x] `.kilo/plans/` 已完成的計畫已歸檔到 `.kilo/plans/archive/`（2026-10-21）；仍有未驗證項目的紫微與 Bilibili 計畫留在原處
驗證：`git status` 乾淨、app 可正常載入。

## 階段 1：確定未實作的功能 🔴
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] `js/apps/touch/index.js:57` 截圖功能（toast「尚未實作」）
- [ ] `js/apps/mcp-market/code-templates.js` 的 4 個模板：提醒(137)、購物(168)、智慧燈光(189)、智慧空調(199)，另有 line 422 通用「未實作於 Worker」
  → 決策點：真的接服務，還是從市集移除這些項目？
- [ ] 聊天主題客製化（`1785460075395-chat-theme-customization.md`）：`js` 中找不到 chatTheme 相關程式，疑似完全未做；同計畫要求移除聊天室內的 API/系統提示詞/記憶設定，需確認
驗證：每項各自手動操作一次。

## 階段 2：Wiki 驗證（`feature-completion-plan` 餘項）🟡
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] 編號列表在插入/刪除後正確重排（`updateAllNumberedLists`）
- [ ] Notion 同步 429 速率限制實測
- [ ] Wiki 儲存/復原整體回歸測試（`IMPROVEMENTS.md` 狀態仍寫「待測試」）

## 階段 3：記憶系統驗證 🟡（`memory-vectorization-sync-plan`，29 項未勾）
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] 3a 向量化：每 10 則訊息建立記憶、7 類分類、embedding 存入 IndexedDB、向量搜尋、`memory_enabled` 時注入 prompt、設定 UI
- [ ] 3b 睡眠週期：排程/手動觸發、合併相似記憶、壓縮、補跑漏掉的睡眠窗口
- [ ] 3c Turso 同步（Vercel `/api/sync`）：確認這部分有沒有真的部署/實作，`js` 中未見對應用戶端 → 可能是 🔴
- [ ] 記憶可於 Character Context 檢索（feature-completion-plan 未勾項）

## 階段 4：聊天功能驗證 🟡
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] 群聊（`group-chat-plan`，7 項）：多角色回覆、單一失敗不影響其他、舊對話相容
- [ ] 聊天選單/健康功能（`chat-menu-health-features`，12 項）：漢堡選單、時間/天氣、用藥與經期記錄、提醒觸發

## 階段 5：外部服務與部署驗證 🟡
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] Bilibili 播放（`bilibili-playback-adaptation`，12 項）：後端、登入、Cookie 加密、播放地址、內嵌/外開、降級
- [ ] 紫微 MCP（`ziwei-mcp-integration-plan`，14 項）：Server 部署、快取過期處理、Wiki 命理區塊、Chat 注入；`ziwei-mcp-server/LOGIN_ALTERNATIVE.md`、`DEPLOY.md` 顯示部署上有問題
- [ ] Discord 整合：`tests/discord-test` 的 migration 002/003 是否已套用；`DISCORD_COMPLETION_REPORT.md` 與實況對照
- [ ] GitHub Actions：`update-bilibili.yml`、`update-twitter-content.yml` 近期是否成功（data/ 有更新，應可運作）

## 階段 6：全域一致性 🟡
> 🔒 開工前：先通過〈開工關卡〉（讀 karpathy-guidelines、宣告假設與驗證方式）。
- [ ] 計畫 5.2「刷新保護」：逐一檢查各 app 的 `render()` 是否先載入本地資料（標記「待執行」，約 45 個 app）
- [ ] 自動化測試：`FEATURE_IMPLEMENTATION_PLAN` 階段 5 要求 Jest + Playwright，目前 `tests/` 只有手動 HTML 頁面，**沒有任何自動測試**
- [ ] `health` 應用的敏感資料：確認僅在使用者同意時寫入記憶

---

## 建議執行順序
0 → 1 → 2 → 6（刷新保護）→ 4 → 3 → 5。
理由：先清雜訊，再做小而確定的缺口，最後才碰依賴外部部署的大塊。

## 掃描限制
- 沒有實際執行 app，「🟡」只代表「計畫未勾選」，可能其實已能運作。
- `js/apps/**` 另有約 430 處 TODO/placeholder 字樣命中，多數是 UI 的 placeholder 屬性，未逐一檢視。

---

## 發現（執行中遇到、不在範圍內、先記錄不處理）
- （空）

---

## 2026-10-20 狀態更新（對照實際程式碼與瀏覽器實測）

上方階段清單多數寫於 10-19 之前，已過時。實際狀態：

| 項目 | 狀態 | 依據 |
|---|---|---|
| 階段 1：截圖 | ✅ 已做 | 輔助觸控以螢幕擷取 API 實作 |
| 階段 1：mcp-market 4 個「尚未實作」模板 | ✅ 已處理 | 提醒改為 App 內建工具；購物、智慧燈光、智慧空調標示「尚未支援」且不可選取、不會被產生進 Worker |
| 階段 1：聊天主題客製化 | ✅ 已做 | `chat-settings.js` 有預設主題與自訂色彩，`chat.js` 載入時套用 |
| 階段 2：Wiki | ✅ 已驗證 | 見 `APPS_COMPLETION_CHECKLIST.md` A5（Notion 同步需真實帳號，未驗證） |
| 階段 3：記憶系統 3a/3b | ✅ 已驗證 | 用模擬 embedding 端點；3c Turso 同步：`js/` 內沒有任何對應用戶端，屬未實作且未列入需求 |
| 階段 4：群聊 | ✅ 實測 | 2 個角色的群組：按「生成回應」後兩人各自回覆、名稱正確（`Promise.allSettled`，單一失敗不影響其他） |
| 階段 4：聊天選單／健康 | ✅ 已驗證 | 用藥、經期、心情已接上 App 內建工具與健康 app |
| 階段 5：MCP Worker 部署 | ✅ 已部署並實測 | `https://siios-mcp-worker.yaninlin.workers.dev`，17 項真實網址測試全過 |
| 階段 5：Bilibili 播放、紫微 MCP、Discord | ⏸ 未驗證 | 需要外部帳號／服務 |
| 階段 6：刷新保護 | ✅ 實測 | 10-19 逐一載入 78 條無參數路由，皆能渲染、無主控台錯誤 |
| 階段 6：自動化測試 | 🟡 部分 | 僅 `mcp-worker/test`（`npm test`，5 項離線測試）；其餘仍是手動 HTML 頁面 |

### 10-20 變更 review 結果
範圍：本機工具、MCP 客戶端、聊天 MCP 開關、錢包。無需修正的缺陷；記錄於下：
- `set_reminder` / `create_event` 對只有日期的字串（如 `2026-10-20`）以 UTC 解析，位於 UTC 以西時區可能差一天；台灣時區（UTC+8）不受影響，未改。
- 錢包先寫餘額再寫交易紀錄，兩次寫入之間關閉頁面會有餘額變動但無紀錄的極小機率；已用序列化佇列防止重複扣款，未改。
- 重新產生 `mcp-worker/` 會覆蓋 `package.json`（遺失 `"type":"module"` 與 test 腳本），重產後必須還原。

### 仍待使用者決定（未動）
1. ~~`facebook`、`pub` 兩個 app~~ → 已於 2026-10-20 實作並實測：Facebook（發文／圖片／表情／留言／朋友 AI 發文與留言回覆／朋友開關／記憶）、酒館（選角色同桌、錢包付費點酒、醉意影響對話、離開存記憶）。
2. 宅家（Stay）精力值是否要影響角色對話。
3. 階段 0 殘留：`bilibili-worker/src/` 下 `index-android/final/fixed/oauth/search/simple/simple-v2` 與 `test-direct.js` 共 8 個非正式版檔案（`wrangler.toml` 的 main 是 `src/index.js`）；`.kilo/plans/` 21 份計畫是否歸檔。屬刪除／搬移操作，需你確認後才動。

### 2026-10-20 晚間：年齡確認、遊戲關卡、農場與宅家
- **年齡確認**：第一次開啟要求輸入生日（只存本機）。未滿 18 歲時，酒館、AO3、Lofter、約會與抽卡模擬顯示鎖定頁，滿 18 歲當天依日期自動解鎖；未成年無法自行修改生日；AI 提示詞會加入未成年保護指示。限制：資料存在本機，清除網站資料會重新詢問，這不是防破解的家長控制。
- **遊戲關卡**：消消樂 30 關（得分／蒐集）、2048 10 關（含悔棋）、貪吃蛇 10 關（障礙物）、翻牌配對 12 關、踩地雷 10 關，皆有選關、星數與依序解鎖。消消樂、2048、貪吃蛇用模擬機器人校準過難度；踩地雷、翻牌配對只做了介面實測，難度未用機器人驗證。
- **農場**：等級與經驗、12 種作物、澆水施肥、擴地、倉庫、每日行情與訂單、3 種動物、可把收成送給角色（寫入記憶）。
- **宅家**：8 個格子的房間佈置（家具從錢包購買）、舒適度影響精力恢復、10 種活動（部分需要家具）、邀請角色來家裡（AI 敘事＋記憶）、每日任務；精力 ≤30% 時聊天提示詞會讓角色適度關心。

### 2026-10-21 Review 與修正
自動化測試：`npm test`（Node 內建 test runner，23 項）涵蓋消消樂引擎與機器人可玩性、2048、貪吃蛇、年齡與解鎖日期、Wikipedia 解析與規則分析。UI 層（農場、宅家、投資模擬器、街機廳畫面）仍靠瀏覽器實測，沒有自動化。

Code review（`340bf4c~1..HEAD`）找到並修正：
- 消消樂連鎖動畫中途「重新開始／返回」會污染新棋盤或丟 TypeError（加局號 token）。
- 已存過記憶設定的使用者看不到新增的記憶來源（改為依 `known_sources` 把新來源補進去一次）。
- 聊天的低精力提示沒有套用自然恢復（改用基本恢復速度估算）。
- `set_reminder`／`create_event` 的純日期字串在西半球會差一天（改用本地日期）。
- Facebook 每次互動都整包重寫含 base64 圖片的貼文（圖片改為每張獨立存放，舊貼文自動遷移）。
- 還原備份可以覆蓋 `user_birthdate`，未成年可藉此解鎖（還原時略過該鍵）。
- 宅家「精力恢復到 60」任務在精力本來就高時直接達成（要先低於 60 才算）。
- 農場、宅家跨過午夜不換訂單、天氣、任務。
- 兩個沒用到的匯入。
已知但未處理：記憶設定頁的「來源」勾選目前不影響實際檢索（檢索用的是寫死的預設清單，屬既有行為）；聊天的低精力提示不含家具加成的恢復速度。

### 2026-10-21 外部服務實況
- **紫微 MCP**：線上 Worker 原本是假資料（星曜用雜湊挑選、四化寫死），而 PWA 會把它當真實命理塞進角色提示詞。已改成真正的排盤引擎並部署（版本 2.0.0），以 iztro 交叉驗證；PWA 的角色上下文也補上命盤與流年。
- **Bilibili**：線上 Worker 原本是舊的「搜尋代理」，前端要的端點全都不存在。已部署現行版本（含 KV、字幕路由、較穩的錯誤處理）。實測發現 **Bilibili 對 Cloudflare IP 一律回 HTTP 412**，所以 Worker 抓不到影片資訊、QR 登入也走不通；前端因此改成直接用官方嵌入播放器播放（不需登入），影片資訊只當選用，QR 被擋時降級為「手動貼 Cookie」。推薦／熱門清單仍來自 GitHub Actions 產生的 `data/bilibili_*.json`。
- 兩個 Worker 的 `.wrangler/` 本機快取曾被誤提交（含 Cloudflare 帳號 ID），已移除並加入 `.gitignore`；歷史紀錄中仍有，但只有帳號 ID，沒有金鑰。
- **Notion 同步（個人 Wiki）**：用 Notion 的真實 API 確認原本的寫法有 bug——更新頁面與附加區塊必須是 `PATCH`，原本送 `POST` 會得到 `400 invalid_request_url`，所以「新增頁面能成功、內容區塊寫不進去、既有頁面更新不了」。已修正，並補上：單次最多 100 區塊與單一文字最多 2000 字的分批、標題欄位名稱不是 `Name` 時的處理、缺少 `WikiId` 欄位時自動建立、拉取的區塊分頁、較清楚的錯誤訊息（Token 無效、沒把 Integration 加入資料庫），以及區塊太多時改成封存重建（逐一刪除受限於每秒約 3 次請求）。沒有真實 Notion 帳號可用，所以是用一個照 Notion 規則嚴格把關的模擬伺服器驗證（新增、更新、429 重試、拉取含分頁、區塊型別與待辦勾選），錯誤訊息則用真實 API 驗證；**尚未用真實帳號跑過**。
- **GitHub Actions**：`data/` 內的 Bilibili 與 Twitter 快取每天都有「自動更新」commit，運作正常。
- **Discord 整合**：需要你自己的 Bot Token、Application ID 與 D1 資料庫，無法代為驗證；已新增 `discord-worker/wrangler.toml`（指向 `scripts/discord-bot-worker.js`），之後在該資料夾執行 `npx wrangler deploy --keep-vars` 即可部署，不必再手動貼上；排程與環境變數維持 Cloudflare 上既有的設定。
- **合成服務 Worker（`synth-worker/`）**：先前只用模擬伺服器測過、從未部署。已部署到 `https://siios-synth-worker.yaninlin.workers.dev`（`SYNTH_TOKEN` 用隨機金鑰，存在 Cloudflare secret，沒有寫進 repo）。實測：未帶或帶錯 Token 回 401、`/health` 回報 Workers AI 已綁定。**實際生成（圖片、語音）尚未驗證**——當天的 Workers AI 免費額度已被產生農場素材用完（回 `quota`，Worker 的錯誤處理正確），UTC 午夜（台灣早上 8 點）重置後再測。

### 2026-10-21 回應格式／字數切換沒有跟著變
- **聊天室原因**：（1）格式指示只放在系統提示詞最前面，離輸出很遠，對話歷史裡舊格式的回覆影響更大，模型就沿用舊格式；（2）沒選過模式時，介面顯示「多句」但實際沒有任何格式提示（預設不一致）；（3）輸出長度上限只看上下文大小，與模式無關；（4）自我檢查沒看格式與長度。
- **修正**：模式設定集中在 `js/constants/rp-system-prompt.js`（提示詞、結尾提醒、輸出上限）；格式提醒附在最後一則使用者訊息結尾，單句 400／多句 1200 token 上限，完整模式不限；預設與介面一致（多句）；自我檢查納入格式與長度。
- **Discord 原因**：提示詞寫死「語句簡短」且完全沒有回應模式設定；`max_tokens` 固定 2000；超過 2000 字的回覆被 Discord API 拒絕整則消失。
- **Discord 修正**：新增 `/configure RESPONSE_MODE`（full／dialogue_single／dialogue_multi／custom，也接受中文別名）與 `CUSTOM_RESPONSE_PROMPT`，`/config` 會顯示目前模式；提示詞與提醒和 PWA 相同；超過 2000 字自動切段送出，重新生成會刪掉全部切段（舊資料沒有記錄時只刪最後一則）。預設為多句對話。
- **部署**：Discord Worker 要把新的 `scripts/discord-bot-worker.js` 重新貼到 Cloudflare，再開一次 `/discord/register-commands`（或 `/setup`）讓新的 `/configure` 選項出現。
- 測試：`tests/unit/response-mode.test.mjs`（PWA 與 Discord 純函式；Discord 版從 Worker 檔案取出標記區塊測試）。

### 2026-10-21 Discord：清除、截斷、思考過程
- **清除沒清到記憶**：`/clear` 一直有兩種模式（只清對話／全部清除）。原本的順序是先逐則刪 Discord 訊息（每則等 200ms），最後才清資料庫；Worker 背景執行有時間上限，常常在刪完訊息前被中斷，所以看起來「只清了聊天、記憶沒清」。改成先清資料庫、最後才刪訊息，14 天內的訊息用批次刪除。「全部清除」也改成用 `chat_id` 或 `character_id` 比對（Siios 同步來的記憶只有 `character_id` 對得上），並重置摘要進度。`mode` 改為必選，避免沒選到而預設只清對話。
- **回覆被截斷**：前一版加的輸出上限太小（中文一字約 1~2 token），改為單句 800／多句 2000／完整與自訂 3000（PWA 同步調整單句、多句）；回覆因上限被截斷時收在最後一個完整句子。
- **思考過程（COT）**：Worker 沒有任何處理，模型把 `<think>…</think>` 一起吐出來就原樣送上 Discord。現在程式碼會去掉各種思考標籤（含只有結尾標籤、思考到一半被截斷的情況），提示詞也明確禁止；若整段都是思考則回報錯誤而不是送出空訊息。
- 重新部署後需再開一次 `/discord/register-commands`，`/clear` 的選項才會更新。

- 2026-10-21 已用 wrangler 把最新版部署到 `siios-discord-bot`（https://siios-discord-bot.yaninlin.workers.dev），並重新註冊斜線指令；`/discord/ping`、`/keepalive` 正常。

### 2026-10-21 備份相容性與世界書匯入
- **備份相容性檢查**：這輪改動沒有動到備份格式（只有還原時略過 `user_birthdate`）。新功能（Facebook、農場、投資、酒吧、宅家）的資料都存在 `settings`，會自然隨備份匯出與還原。實測：匯出含新鍵的備份、還原「舊格式、沒有任何新鍵」的備份、還原剛匯出的完整備份，都沒有錯誤，生日也沒被覆蓋。順手修掉 `backup-manager.js` 檔首被我重複加上的 BOM。
- **世界書匯入**：World Info 新增「匯入世界書」頁（`/import-worldbook`）。支援選檔（JSON／TXT／Markdown，可多選）與貼上文字；JSON 認得 SXIOS 世界書、SillyTavern 等 Lorebook（含角色卡的 `character_book`）、條目陣列、「名稱:內容」物件、文字陣列；純文字依 `# 標題`／`【標題】`／`=== 標題 ===` 分段，標題下方第一行寫「關鍵字：甲, 乙」會成為關鍵字觸發條目，沒有標題就整段一個條目。匯入前有預覽與勾選，可指定全部放到全域／關鍵字／劇場，同名條目可選略過或覆蓋。解析邏輯在 `js/core/worldbook-parser.js`（內建 38 本世界書都能解析，條目數與檔案一致），內建世界書的匯入改用同一份對照表。

### 2026-10-21 Discord 機器人「不能用」盤查
- 部署前的線上程式碼最後一次上傳是 8/20，用 wrangler 部署目前的版本後，下列既有問題浮現或被放大：
  1. **API 金鑰被送進提示詞**：`/configure` 把設定存成 `globalSettings` 的 `bot_config_*` 列，世界書載入器把它們當成一般世界書條目塞給模型（含 `AI_API_KEY`、`BACKUP_KEY`）。已排除 `bot_config_` 開頭的列。
  2. **輪詢路徑沒有錯誤處理**：AI 呼叫失敗（上游回拒絕罐頭話、HTTP 錯誤、空內容）會讓整輪輪詢中止，而該則使用者訊息已經存進資料庫，之後永遠不會再被處理，看起來就是「機器人不回了」。現在失敗會回報錯誤訊息並繼續處理後面的訊息。
  3. **上游拒絕罐頭話被當成角色發言**（「我只是一个语言模型…」）並存進歷史，會讓後續回覆更容易拒絕。現在偵測到會換亂數種子重試最多三次，仍失敗才回報錯誤，不存拒絕內容。
  4. **歷史裡的舊回覆帶著 `<thinking>`／`<!-- ECoT -->` 思考過程**（世界書的 ECoT 預設要求模型輸出），模型會照著繼續輸出。送給模型前先去掉；回覆也會去掉 HTML 註解形式的思考與自我檢查。
  5. **Gateway 心跳計時器**在建立它的請求結束後觸發，碰到舊連線物件會丟「Cannot perform I/O on behalf of a different request」；改用閉包內的連線並 try/catch。
- 測試：`tests/unit/discord-reply.test.mjs`（用記憶體 SQLite 模擬 D1、假 fetch 模擬 Discord 與 AI，涵蓋金鑰不外洩、思考過程去除、拒絕重試、連續失敗不中斷輪詢）。
- 已重新部署並重新註冊斜線指令。

### 2026-10-21 Discord `/clear` 細項
- `/clear` 的 `mode` 新增兩項：**只刪罐頭／錯誤訊息**（`canned`：模型的拒絕罐頭話與機器人回報的「⚠️ AI 回覆時發生錯誤」，Discord 與歷史紀錄一起刪）、**只刪最近幾則機器人回覆**（`last`，搭配新的 `count` 選項，預設 1、最多 50，Discord 上切成多段的回覆會整則刪掉）。兩者都不動使用者訊息與記憶；原本的「只清對話」「全部清除」不變。
- 刪訊息的程式抽成 `deleteBotMessages`（14 天內批次刪除），整頁清除與細項清除共用。

### 2026-10-21 Discord 輪詢回溯整個頻道
- **現象**：新綁定（或游標不存在）的頻道，輪詢第一次會抓「最近 20 則」當成新訊息，逐則存進歷史並依插嘴機率回覆，等於回溯整個頻道。游標落後很久的頻道（機器人停擺過、或游標沒更新）也一樣。
- **修正**：第一次看到的頻道只記下目前位置、不處理舊訊息；輪詢只處理 15 分鐘內的訊息，更舊的跳過（游標照樣往前推）。即時（Gateway）路徑本來就只處理新訊息，不受影響。
- 這次回溯在 D1 `messages` 留下 7 筆（頻道 `1322909219325743216` 的 5 則舊使用者訊息與機器人 2 則回覆），會混進角色的對話歷史；尚未清除，需要使用者確認後再刪。

### 2026-10-21 Discord 上下文改讀頻道歷史
- 機器人的上下文原本只來自 D1 `messages`，`/clear` 或資料庫被清掉後就等於「不讀上下文」，Discord 頻道上看得到的對話完全沒用到。
- 現在 `buildConversationHistory`：優先讀頻道上「這則訊息之前」最近 60 則（機器人自己的當 assistant、其他人當 user；空訊息、其他機器人、拒絕罐頭話與「⚠️ AI 回覆時發生錯誤」略過；相鄰同角色合併，切段的回覆會接回一則；頻道有多位使用者時前面標名字）。來自 Siios（`source: 'pwa'`）的資料庫訊息依時間穿插；讀不到 Discord（沒權限、限流、空的）就退回資料庫歷史。重新生成用的是「那則使用者訊息之前」的歷史，舊回覆不會進去。
- `/clear` 的「只清除對話」「全部清除」會在 `botState` 記下 `ctx_cutoff_<頻道>`（目前時間的 snowflake），之後只讀這個時間點之後的 Discord 訊息——因為使用者自己的訊息不會被刪，否則清除後上下文會馬上又回來。「只刪罐頭」「只刪最近幾則」不設游標。

### 2026-10-21 PWA 聊天室出現思考過程（COT）
- **原因**：世界書的 ECoT 預設會要求模型輸出 `<thinking>…</thinking>` 並用 `<!-- Start the ECoT -->` 之類的 HTML 註解包住思考與自我檢查；PWA 把模型輸出原樣顯示、存檔，歷史裡的舊思考還會教模型繼續輸出。
- **修正**：新增 `js/core/reasoning-filter.js`（`stripReasoning`）。串流時畫面只顯示去掉思考後的文字（標籤寫到一半先不顯示，不會閃一下）；完成時存檔與自我檢查用的是乾淨版；`APIClient.complete`（各 App 共用的非串流呼叫）也一併處理；送給模型的歷史裡舊回覆的思考過程先去掉。整段都是思考時回報錯誤，提示重新生成。Discord Worker 的 `stripReasoning` 是同一套規則（補上沒收尾的 `<!--`），測試會比對兩邊結果一致。
- 已存進資料庫的舊訊息不會被改寫；只是顯示用的歷史（送給模型的）會去掉，畫面上舊訊息裡的思考過程仍在。

### 2026-10-21 找回 Discord 專用輸出模式
- 加入回應模式（1d19e42）時，我把 Discord Worker 提示詞裡一直寫死的三行（「Discord 主要是公開頻道，回覆請用輕鬆、聊天式的口吻，語句簡短，限縮在聊天模式。／可適度加入動作描寫…／不要使用 markdown…」）拿掉了，所以機器人的語氣、長度都變了。git 歷史裡這就是 Discord 唯一的專用提示詞（最早出現在 9caa15f，沒有更早的「可選模式」；若你記得的是 Cloudflare 上更早的手動貼上版本，那個版本無法從 Cloudflare 取回）。
- 現在把原文放回來，成為可選的 **`discord` 模式（Discord 聊天模式）**，並且是 Discord 的**預設**（跟加入回應模式之前的行為一致）。`/configure RESPONSE_MODE` 可選 discord／full／dialogue_single／dialogue_multi／custom，別名 `dc`、`dc模式`、`聊天` 等；提醒也會附在最後一則使用者訊息後面。PWA 聊天室沒有這個模式，預設仍是多句。

### 2026-10-21 Review 與 Chat 補強
- **Review（1d19e42..HEAD）**：修掉 5 項——輪詢路徑的 `ctx` 被 D1 查詢結果遮住（輪詢路徑從來不會萃取記憶，還多一次沒用到的查詢）、拒絕偵測誤判角色台詞（「我無法回答你」）、斜線指令的回應被當成對話上下文、自我檢查只回思考過程時誤報錯誤、`wrangler.toml` 相容日期被順便改新。未處理（低）：匯入世界書強制放關鍵字類時無關鍵字條目永不觸發、測試需要 Node 22.5+（`node:sqlite`）、串流每個 chunk 重掃全文。
- **Chat**：（1）最後一則使用者文字訊息在提示詞裡出現兩次（歷史一次、附上格式提醒再一次，C4 紀錄裡「發現但未動」那項），現在歷史裡那一則會拿掉；貼圖等非文字訊息不受影響。（2）「匯出聊天記錄」原本把訊息內容直接塞進 HTML，內容有 `<`、`&` 會破壞頁面（也有注入問題），現在全部跳脫；圖片會嵌入、貼圖／位置／語音用文字描述、AI 回覆的思考過程不匯出。（3）以前存下來、帶著 `<thinking>`／ECoT 註解的 AI 回覆，顯示時去掉（資料庫原文不動，編輯該則訊息時看到的是去掉後的文字）。
- 仍未做（原清單已記錄）：Wiki／世界觀「帶入當前角色」、`verifyReply` 多打一次 LLM（可選擇關閉）。

### 2026-10-21 拒絕重試精簡上下文、PWA ⇄ Discord 記憶串接
- **拒絕**：不加強提示詞去壓安全判斷。改成被拒絕後的重試逐次精簡上下文（第 2 次只留最近 12 則、第 3 次只留最近 4 則，目前這則一定在），並把拒絕寫進 D1 `botState` 的 `refusal_log`（最近 20 筆：時間、模型、頻道、訊息開頭 20 字、每次拒絕的上下文量、第幾次成功或放棄）。`/config` 現在會列最近 5 筆（也改成只有自己看得到）。
- **記憶串不起來的原因**：（1）機器人讀記憶只用 `chat_id = 角色 ID`，PWA 推上去的記憶 `chat_id` 是 Siios 的聊天室 ID，永遠讀不到；（2）機器人把每則訊息的原文日誌也存成記憶，最近 50 筆幾乎都是日誌，真正的記憶被擠掉；（3）拉回 PWA 時用 `put` 覆蓋，會把 PWA 原生記憶（向量、感官…）換成缺欄位的精簡版，還會把對話日誌和自己推上去的記憶又拉回來。
- **修正**：機器人用 `chat_id` 或 `character_id` 比對，SQL 就排除日誌，重要性高的優先（最多 60 筆）；PWA 的 `MemoryDB.importMany` 不覆蓋本機已有的、不匯入日誌；新增 `js/core/discord-memory-sync.js`（推：只送精簡欄位、分批 40 筆、增量；拉：`/sync/chat?memories_only=1`，不含日誌與 Siios 來源）。App 啟動 8 秒後背景自動同步（每 30 分鐘最多一次，沒設 Worker 網址就略過；自動同步只處理「已啟用 Discord 的角色」）。設定頁的按鈕改為「🧠 同步記憶（雙向）」，手動會推所有有歸屬角色的記憶。
- 沒有歸屬角色的記憶（既沒有 `character_id`、聊天室也找不到角色）不會同步。

### 2026-10-21 Discord Worker 部署教學（開放給多數使用者）
- **PWA**：Discord 整合頁新增「📘 第一次使用？Worker 部署教學」卡片，進入 `/settings/discord/guide`：10 個步驟（建立 Discord 機器人與 MESSAGE CONTENT INTENT、用 Application ID 產生邀請連結、在 Cloudflare 建 Worker 並一鍵複製／下載程式碼、建 D1 並綁定變數名 `DB`、三個變數、Cron `*/2 * * * *`、`/setup` 與 Interactions Endpoint URL、`/configure` 設定 AI、綁定角色、回 PWA 同步），每步有複製按鈕，網址會代入使用者填的 Worker URL；另有常見問題與安全提醒。內容與純函式在 `discord-guide-data.js`，畫面在 `discord-guide.js`。
- **Worker**：新使用者不必再手動建表——`ensureSchema` 在第一次請求／排程時用 `CREATE TABLE IF NOT EXISTS` 建好全部 11 張表（既有資料庫不受影響）；`/discord/ping` 回報 `version`。PWA「測試連接」會和 `EXPECTED_WORKER_VERSION` 比對，Worker 過舊就提醒重新貼上程式碼（改 Worker 行為時，兩個版本常數要一起更新，測試會檢查一致）。
- **已知風險（未處理）**：Worker 的 PWA 端介面（`/sync/*`、`/discord/send`、`/discord/clear`、`/discord/history`、`/gateway/start`）沒有驗證，只靠網址不被知道；教學裡已提醒不要公開網址。若要正式開放，建議加一組存取密鑰（Worker 變數 + PWA 帶標頭）。

### 2026-10-21 全面檢查：記憶、嵌入、跨裝置活動、外觀（PWA 整體 review）
**外觀與圖示**
- 無效的 Material 圖示名稱：`discord`（設定、神秘門）、`follow`（Twitch）改成 `forum`／`person_add`。圖示字型改 `display=block`，載入前不再閃出一串英文字；Service Worker 現在也快取 CDN（idb、Font Awesome、Material Symbols、字型檔）與**全部** App 的 js／css（`scripts/update-sw-assets.mjs` 產生清單，測試會檢查是最新的），離線時每個 App 都開得起來。
- **全域 CSS 外洩**：Lofter 的 `.page { display:none }` 把約 20 個用 `.page` 當容器的 App（街機、約會、外送、購物、支付、時間樹、谷子圖鑑…）在「先開過 Lofter」之後整頁變空白；另有 19 組 class 名稱（`.icon-btn`、`.feed`、`.add-btn`…）被多個 App 樣式表重複定義互相覆蓋。改成 38 份樣式表中相關規則加上 `:where(body[data-app="…"])` 限定（優先權不變），路由切換時設定 `body[data-app]`。
- 健康 App 全英文 → 繁體中文（舊的英文標籤自動對應，已勾選的不會消失）；順手修掉經期提醒的三個問題：沒存過提醒設定就永遠不提醒、提醒無法關閉（`|| true`）、預測更新會把其他設定重設；新增「聊天室提醒」設定區。記憶頁搜尋按鈕被擠成直排。
- 原生 `confirm()`／`alert()`／`prompt()` 全部換成 App 風格的對話框／提示（`askConfirm`、toast、`askForm`）。
**記憶系統**
- 聊天室與各 App 取記憶都套用「記憶設定」（來源、虛構內容）；來源清單集中（`memory-sources.js`），補上原本缺的 ao3／lofter／theater／drift-bottle／health／mcp 與新增的 discord、music、pomodoro、weather 等。
- 遺忘曲線 bug：睡眠週期每晚把「從建立到現在」的衰減再算一次，記憶以時間平方的速度消失（約一個月全部被刪）。改為從上次衰減時間算起；永久記憶／重要性 ≥ 0.8／7 天內的記憶不會被遺忘；常被想起的記憶強化後歸零計數。
- 聊天記憶寫入時沒有 `character_id`（只有 `characterId`），跨聊天室、跨 App 找不到；已修並相容舊資料。重複內容不重複處理；太短的訊息不處理。提示詞標示記憶來源。
- 設定儲存後記憶系統立即套用（原本要重開 App）。
- **所有 App 都有記憶**：新增 `activity-memory.js`（共用記憶，每個角色都看得到）；錢包扣款（購物、外送、禮物、主題、貼圖、街機）、時間樹行程、遊戲過關、相簿、交換日記、照相館、食譜收藏、谷子圖鑑、電話、天氣、音樂（陪聽、AI 感想）、番茄鐘（完成專注）都會記。不接記憶的：輔助觸控、小工具、外觀設定、Passkey、付款碼（沒有生活內容或屬敏感資料）；健康另有自己的提示詞機制。
**嵌入（embedding）**
- 網址規則（根網址／`/v1`／完整 `/embeddings`）、`dimensions` 只在 text-embedding-3 系列才送（其他服務會回 400）、檢查回應內容、連續失敗暫停；查詢向量拿不到時整批退回關鍵字搜尋（原本已有向量的記憶會整批消失）；設定頁加「測試嵌入模型」與免費服務捷徑。
- synth-worker 新增 OpenAI 相容 `/v1/embeddings`（Workers AI `bge-m3`，免費），已部署。當天 Workers AI 免費額度已用完，真實的 bge-m3 呼叫**尚未驗證**（回應格式依官方文件）；用概念式假服務驗證了整條流程（存向量、語意檢索找到沒有共同字的記憶、服務掛掉時退回關鍵字）。
**跨裝置活動紀錄**（原本是壞的）
- 瀏覽器擴充功能把活動 POST 到 PWA 網址的 `/api/activities/sync`，但 PWA 是靜態網站，那個「API」只存在頁面裡、擴充功能打不到；擴充功能裡寫好的加密 Gist 上傳程式從來沒被用到。改為擴充功能與 PWA 共用同一個加密 Gist（設定 Token／Gist ID／金鑰）。
- PWA：新增「加入既有的同步」（原本第二台裝置只能建立一個新的 Gist，永遠不會和第一台互通）；顯示／複製 Gist ID 與金鑰（原本金鑰只顯示 2 秒就跳頁）；加入者停用不會刪共享的 Gist；啟動時自動同步（原本只有打開設定頁才會連線）；超過 1MB 的 Gist 檔案改抓 raw_url。
- `ActivityDB.create` 忽略傳入的 id → 每次同步都把遠端活動重新新增一份（重複越滾越多）；`SettingsDB.delete` 不存在 → 停用同步到一半丟錯。皆已修。
- 同步進來的活動從來沒有送給 AI；現在依隱私等級（基本／摘要／詳細）整理成一小段提示詞給聊天室。
**文件**：README 重寫（功能、第一次設定、免費嵌入服務、記憶系統、每個 Worker／MCP／Discord／擴充功能的部署步驟、備份、隱私、疑難排解、開發）；擴充功能 README 更新；紫微斗數服務網址可在 MCP 設定頁自訂。
- 活動紀錄給 AI 看之前必須同時開啟「活動同步」與「允許 AI 角色存取」（這個開關原本存了卻從來沒被檢查），並排除被關掉的平台。活動隱私設定頁在設定不含 platforms 時會當掉，已修。擴充功能的自動同步改用 chrome.alarms（MV3 service worker 閒置會被關掉，setInterval 幾乎不會觸發），瀏覽器重啟時也會恢復。

### 2026-10-21 Discord Worker：每個人用自己的
- 確認 PWA 與 Worker 程式碼裡沒有寫死任何 workers.dev 網址或維護者的資源（`tests/unit/discord-self-hosted.test.mjs` 持續檢查）；Worker 網址欄位預設是空的，各人填自己的。
- 版控裡的 `discord-worker/wrangler.toml` 原本帶著維護者的 D1 資料庫 ID，改成佔位文字的範本（並附上排程）；維護者自己的設定放在被 `.gitignore` 忽略的 `wrangler.local.toml`，部署用 `npx wrangler deploy --config wrangler.local.toml --keep-vars`。
- （已處理）紫微斗數與 Bilibili 不再預設指向維護者的 Worker，見下一節。

### 2026-10-21 Discord 存取密鑰、共同觀看、紫微斗數自建
- **Discord Worker 存取密鑰（`ACCESS_KEY`）**：PWA 呼叫的所有介面都要帶密鑰（`Authorization: Bearer`／`X-Siios-Key`；瀏覽器直接開的 `/setup`、`/poll` 等 GET 可用 `?key=`；`/backup` 的 `?key` 仍是 BACKUP_KEY）。公開的只有狀態頁、`/discord/ping`（回版本與 `access_key_configured`）、`/keepalive`、`/discord/webhook`（Discord 簽章）。沒設 `ACCESS_KEY` 回 503、密鑰錯誤回 401、常數時間比較。`DISCORD_PUBLIC_KEY` 沒設時不再放行（之前會讓任何人偽造 Discord 事件）。
- **Discord 端驗證**：新表 `authorizedUsers`；`/auth key:<密鑰>` 通過才能用機器人（指令、私訊、頻道訊息、輪詢都一樣，沒通過的人不回、不存歷史，私訊每小時提示一次）；連錯 5 次鎖 15 分鐘；`/auth-reset` 只留自己。升級時已綁定過的使用者自動視為已驗證。
- **PWA**：`js/core/discord-worker-client.js`（`workerFetch` 自動帶密鑰、`testWorkerAccess`、`generateAccessKey`）；設定頁新增「存取密鑰」欄，「測試連接」會依序檢查連線、密鑰、版本；所有同步呼叫（角色／用戶／世界書／備份／對話／還原／綁定／記憶）改用 `workerFetch`。教學步驟 5 有「產生密鑰」鈕（並存進 PWA）、步驟 7 `/setup?key=`、步驟 8 `/auth`，另加常見問題與安全提醒。`WORKER_VERSION`／`EXPECTED_WORKER_VERSION` 為 2026.10.22。
- **共同觀看**：`js/core/co-watch.js`（面板、計時、API 呼叫、結束時存記憶）與 `co-watch-prompt.js`（網址解析、提示詞，純函式）。YouTube／Bilibili 共用；頻率可選（只在我說話時／30 秒／1／2／5 分鐘）；YouTube 用 `enablejsapi=1` 讀播放時間；內容來源是標題／頻道（YouTube oEmbed）、使用者貼的字幕或簡介、對話。角色看不到畫面與聲音，提示詞要求不編造。舊的「隨機關鍵字」即時留言與 Bilibili 一次性評論移除。
- **Bilibili**：改為只嵌入播放器，預設不連任何 Worker（`BILI_API` 預設空，要在設定鍵 `bilibili_worker_url` 填自己的才會用）；首頁不再跳登入提示，也不再從維護者的 GitHub 倉庫載入 Cookie。
- **紫微斗數**：加入神秘門（工具 `fortune_ziwei`，排盤引擎由 `scripts/build-ziwei-template.mjs` 產生 `ziwei-engine-template.js`，產生的 Worker 帶 `src/ziwei-engine.js` 與 `lunar-javascript` 依賴）；PWA 預設端點改為空，設定頁可填網址與 `MCP_API_KEY`；沒設定時給明確提示。維護者的 `ziwei-mcp-server` 實測可用，但 PWA 不再預設連它。
- **新增測試**：`discord-auth.test.mjs`（密鑰閘門、/auth、鎖定、升級、webhook 簽章）、`co-watch.test.mjs`、`ziwei-market.test.mjs`、`imports-resolve.test.mjs`（所有相對 import 都存在——抓到 `mcp-intelligence/index.js` 的 db 路徑錯誤並修正）。
- **未驗證**：真實 YouTube／Bilibili 嵌入播放與 postMessage 時間（瀏覽器窗格無外網播放驗證，邏輯用單元測試與假 API 驗過）；Workers AI 嵌入額度用完，bge-m3 實際呼叫仍未驗。
- **發現但未動**：`js/activity-router.js` 引用不存在的 `api/` 資料夾且無人使用（死碼）；Bilibili 的 `syncBilibiliCookieToGitHub` 仍寫死 `Siixii00/siios` 倉庫（登入入口已停用，建議整段刪掉）。

### 2026-10-21 記憶系統：跨 App 檢索、衰退、消化 API
- **查出的問題**：約 22 個 App 呼叫 `buildAppContext` 時沒有查詢句，而空查詢的結果是空的，所以大部分 App 其實讀不到任何記憶；約會把角色物件當選項傳（讀不到 characterId）；「記憶層級」設定沒有作用（提示詞一律用完整內容）；聊天記憶的摘要固定是同一句；睡眠週期只在凌晨 2–6 點 App 開著時才跑，手機幾乎碰不到（遺忘與強化等於沒運作）；「遺忘閾值」設定沒人讀；DecayEngine 預設 0.1 與設定頁預設 0.01 不一致；Discord 來的記憶被遺忘後下次同步會復活。
- **修正**：沒有查詢句時取該角色近期、重要的記憶（仍遵守來源／虛構設定）；提示詞改用 `displayContent`；聊天記憶的摘要取訊息前 40 字；睡眠週期啟動時補跑（`runSleepCycleIfDue`，24 小時內不重複，時間記在 `memory_last_sleep`）；遺忘閾值生效（`<=`，因為係數下限是 0.01）；預設衰減率統一 0.01；`MemoryDB.delete` 對 Discord 來源的記憶記下 `forgotten_memory_ids`（上限 3000），`importMany` 略過；約會與共同觀看改用正確的呼叫（共同觀看用影片標題當查詢句）。
- **記憶消化 API**：`core/memory-system/digest.js`（純函式：挑待消化、組提示詞、解析、套用結果）＋ `MemorySystem.digestPending/getDigestStats`。設定 `memory_api_url/key/model`（留空用聊天 API；分類器也走這組）。每批 8 則，寫回摘要、學到的事、重要度（與原值 4:6 混合）、類型、領域、標籤，補向量；API 本身出錯（額度／金鑰）就停止，不累計記憶的失敗次數，只有解析不出來才累計（上限 3）。只有填了專用 API 才自動做（啟動 30 秒後、每 15 分鐘、畫面開著），避免悄悄花掉聊天 API 的額度；設定頁有「立即消化記憶」與待消化數量。
- **測試**：`memory-retrieval.test.mjs`、`memory-digest.test.mjs`（用 `_memory-harness.mjs` 把 db.js 換成記憶體假資料庫）；瀏覽器用真的 IndexedDB 驗過消化、無查詢句檢索、墓碑與設定頁。
- **沒做**：`saveInteractionMemory` 仍不檢查記憶總開關（關掉時照寫、不會被讀）；每次檢索仍讀整張記憶表（記憶很多時會慢）。
