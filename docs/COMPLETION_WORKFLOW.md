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
