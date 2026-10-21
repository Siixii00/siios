# Siios — AI 角色互動 PWA

一個以 **AI 角色** 為核心的手機風格網頁應用（PWA）：跟角色聊天、一起玩遊戲與逛各種「虛擬 App」，角色會記得你們做過的事。

資料全部存在你自己的瀏覽器（IndexedDB）。需要伺服器的功能（工具、語音／圖片生成、Discord 機器人…）都是**跑在你自己的 Cloudflare 帳號**，大多可以用免費額度。

> 目錄：[功能](#功能) · [快速開始](#快速開始) · [第一次設定](#第一次設定) · [記憶系統](#記憶系統) · [部署各項服務](#部署各項服務) · [跨裝置活動同步](#跨裝置活動同步與瀏覽器擴充功能) · [備份](#備份與還原) · [隱私與安全](#隱私與安全) · [疑難排解](#疑難排解) · [開發](#開發)

---

## 功能

**聊天與角色**
- 單人／群組聊天（串流回應）、角色與使用者面具、世界書（World Info）、回應模式（完整／單句／多句／自訂）
- 傳送貼圖、圖片、影片、語音、檔案、位置、禮物、轉帳；語音辨識、文字轉語音、圖片／影片／音樂生成
- 思維鏈與心聲（事後推想）、聊天總結、每日紀錄、匯出聊天記錄

**記憶**：角色有持久記憶（感官、情緒、時空標記、遺忘曲線、語意搜尋）。你在各個 App 做的事也會被記住。見 [記憶系統](#記憶系統)。

**App（約 50 個）**

| 類型 | App |
|---|---|
| 生活 | 相簿、天氣、音樂、番茄鐘、時間樹、交換日記、電話、健康（經期紀錄與關心）、每日食譜、照相館 |
| 遊戲 | 街機廳（2048、貪吃蛇、記憶翻牌、踩地雷，皆有關卡）、消消樂、農場、宅家、酒館、投資模擬器（每天依真實世界事件波動）、約會、劇場 |
| 社群 | Instagram、Facebook、Twitter、YouTube、Bilibili、Twitch、Weverse、Lofter、AO3、漂流瓶、Bubble |
| 購物與支付 | 購物、外送、禮物／表情／主題商店、虛擬錢包（餘額自己調整，不涉及真實金流） |
| 工具 | 角色 Wiki（可同步 Notion）、MCP 工具、輔助觸控、小工具、外觀設定、谷子圖鑑、Passkey、付款碼 |

**其他**：未成年鎖定（出生日期未滿 18 歲時，部分內容鎖起來，滿 18 歲當天自動開放）、離線可用（Service Worker）、本機／GitHub／Google Drive 備份、跨裝置活動同步、Discord 機器人。

---

## 快速開始

### 直接使用
開啟部署好的網址（GitHub Pages）。手機瀏覽器選「加入主畫面」就是 App。

### 自己部署 PWA（GitHub Pages）
1. Fork 這個 repo，**repo 名稱保持 `siios`**（程式裡的資源路徑是 `/siios/…`）。
2. Settings → Pages → Branch 選 `main` / root。
3. 網址會是 `https://<你的帳號>.github.io/siios/`。
4. （選用）Actions 頁籤啟用 workflow，會每小時更新 Bilibili 與 Twitter 的內容快取（`data/`）。

### 本機執行
資源路徑固定是 `/siios/`，所以要從**上一層**資料夾提供服務：

```bash
# repo 放在名為 siios 的資料夾裡
cd ..                      # 回到 siios 的上一層
npx serve .                # 然後開 http://localhost:3000/siios/
```

---

## 第一次設定

1. **設定 → 聊天 API 串接**：填 API 網址（OpenAI 相容服務的網址，例如 `https://api.openai.com`，**不用加 `/v1`**）、API Key、模型名稱。
2. **角色**：設定 → Char 設定 → 新增角色（也可以在聊天室新增）。
3. **（建議）使用者面具**：設定 → User 面具設定；角色會依面具稱呼你。
4. **（建議）啟用記憶系統**與**嵌入模型**：見下面。
5. 出生日期（第一次開啟時會問）只存在這台裝置上。

### 約會（虛擬見面）
選一個角色 → 看關係與過去的約會回憶 → 選地點（10 個場景＋自訂地點；有的要好感度到了才解鎖，有的會從錢包扣款）→ 在場景裡面對面互動。角色依你們的**關係階段**（初識／朋友／曖昧／戀人）、現在的**時段**與場景氛圍演出；好感度是角色自己這一輪的真實感受（被冒犯會下降），不是隨機數，每天增加有上限。場景有專屬活動、隨機小插曲、送禮（用禮物商店買的）、依好感度解鎖的互動。結束時角色用第一人稱寫下回憶，存成**一則**記憶並記進約會紀錄。

### 嵌入模型（讓記憶有「語意搜尋」）

沒設定嵌入模型也能用，記憶會改用**關鍵字**比對。設定後，角色可以想起「換個說法」的往事（例如你說「看大海」，它想起「去海灘看日出」）。

**設定 → 聊天 API 串接 → 嵌入模型設定**，選一個免費服務捷徑（會自動填網址與模型），貼上 API Key，按「測試嵌入模型」確認成功，再按「儲存設定」。

| 服務 | 說明 | API Key 從哪取得 |
|---|---|---|
| **Cloudflare Workers AI（用你自己的 Worker，最推薦）** | 多語言（含中文）效果好，免費額度每天 10,000 neurons，不需信用卡。需先部署 [合成服務 Worker](#合成服務-synth-worker) | 該 Worker 的 `SYNTH_TOKEN` |
| Google Gemini | 有免費額度（有每分鐘／每日限制），多語言 | [Google AI Studio](https://aistudio.google.com/apikey) |
| Jina AI | 註冊即有免費額度，中文好 | [jina.ai/embeddings](https://jina.ai/embeddings/) |
| SiliconFlow | `BAAI/bge-m3` 為免費模型 | [siliconflow.com](https://siliconflow.com/) |
| Mistral | 免費 Experiment 方案，有速率限制 | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| Voyage AI | 新帳號有大量免費 token | [dashboard.voyageai.com](https://dashboard.voyageai.com/) |
| Ollama（本機） | 完全免費，要在自己電腦跑；手機不能用 | `ollama pull bge-m3`，並設定環境變數 `OLLAMA_ORIGINS=*` |

> 免費額度與限制以各服務官方目前的方案為準。以上服務都已確認允許瀏覽器直接呼叫（CORS）。
> 嵌入網址可填服務根網址、`…/v1`，或完整的 `…/embeddings`。連續失敗 3 次會暫停 5 分鐘並退回關鍵字搜尋，不會影響聊天。
> 換嵌入模型後，舊記憶的向量維度不同、不會被語意搜尋用到（仍可用關鍵字找到），新記憶會用新模型。

---

## 記憶系統

**寫進記憶的來源**
- **聊天**：每累積 10 則訊息，把最近 10 則（太短的不算）整理成記憶：分類（類型、領域、重要性）、感官／情緒／時空標記、向量。重複的內容不會重複存。
- **各個 App**：Facebook、Instagram、酒館、農場、宅家、投資、約會、劇場、YouTube…都會記下你和角色一起做的事。
- **你自己做的事（所有 App）**：買東西、外送、送禮、玩遊戲過關、新增行程、寫交換日記、相簿新增照片、打電話、收藏食譜與谷子…會記成「共用記憶」，**每個角色都看得到**。
- **Discord**：機器人整理出來的事實，會同步回 PWA；PWA 的記憶也會同步給機器人（見 [Discord 機器人](#discord-機器人)）。
- 最近的**網路活動**（來自瀏覽器擴充功能／其他裝置）只有在「設定 → 活動同步」開啟、並打開「允許 AI 角色存取」時，才會依隱私等級以摘要形式提供給角色，角色只會在自然的時候提起。

**記憶消化（學習）**：各 App 隨手寫入的記憶只是原始片段。**設定 → API 設定 → 記憶系統 → 記憶消化 API**（選填，OpenAI 相容，可以用便宜的小模型）會把它們整理成一句話摘要、「學到了什麼」（用戶的喜好、習慣、關係變化）、重要度、類型與標籤，有嵌入模型時順便補上向量；聊天記憶的分類也走這組 API。網址與金鑰都填了，啟動後 30 秒、之後每 15 分鐘（畫面開著時）自動消化；沒填就不會自動做（避免悄悄用掉聊天 API 的額度），可以按「立即消化記憶」手動做，這時會用聊天 API。記憶內容會送到這組 API。

**怎麼想起來**：每次回覆前，用你這句話去找最相關的 5 筆記憶（有嵌入模型就用語意搜尋，沒有就用相鄰兩字的關鍵字比對，兩者可並用），依「相似度 × 衰減 × 重要性」排序，放進提示詞，並標示來源（例如「（YouTube）…」）。沒有使用者訊息的 App（農場、天氣、Instagram…）沒有查詢句，就取這個角色**近期、重要**的記憶。「記憶設定」的記憶層級選 meta 時，放進提示詞的是摘要，選 full 才是完整內容。

**設定 → 記憶設定**：選擇哪些來源的記憶可以被想起、是否包含虛構內容（劇場、同人）、綁定劇場。聊天室與所有 App 都遵守這份設定。

**遺忘**：記憶隨時間淡化（衰減率在 API 設定頁），重要性越高越慢；「睡眠週期」會整理記憶，淡到低於**遺忘閾值**（API 設定頁）的才會被刪除；原本只在凌晨 2–6 點 App 開著時才會跑，現在**啟動時距離上次超過 24 小時也會補跑**（聊天室仍可手動執行）。從 Discord 同步來的記憶被遺忘或刪除後，不會再被同步拉回來。**永久記憶、重要性 ≥ 0.8、建立不到 7 天的記憶不會被遺忘**。常被想起的記憶會被強化。

---

## 部署各項服務

所有服務都跑在**你自己的 Cloudflare 帳號**（免費方案即可）。共同的準備：

```bash
npm install -g wrangler        # 或之後都用 npx wrangler
npx wrangler login
```

| 服務 | 資料夾 | 用途 | 需要 |
|---|---|---|---|
| MCP 工具 Worker | `mcp-worker/` | 天氣、食譜、動漫、遊戲價格、翻譯、維基 | `MCP_API_KEY` |
| 紫微斗數 MCP | 神秘門產生，或 `ziwei-mcp-server/` | 紫微斗數排盤 | 自己部署，沒有公用服務；`MCP_API_KEY`（神秘門版） |
| 合成服務 | `synth-worker/` | 語音、圖片、語音辨識、**免費嵌入模型**（影片／音樂需付費服務） | `SYNTH_TOKEN` |
| Discord 機器人 | `discord-worker/` | 讓角色在 Discord 上說話 | Discord Bot Token、D1 資料庫、`ACCESS_KEY`（存取密鑰） |
| Bilibili Worker（選用，多半用不到） | `bilibili-worker/` | 掃碼登入、影片資訊（Bilibili 會擋 Cloudflare；播放不需要它，PWA 預設完全不連它） | KV |

### MCP 工具 Worker
MCP（Model Context Protocol）讓角色在聊天時呼叫外部工具（查天氣、翻譯…）。

```bash
cd mcp-worker
npm install
npx wrangler secret put MCP_API_KEY     # 必填：自己產生一組長亂數
npm run deploy
```
部署後會得到 `https://siios-mcp-worker.<你的子網域>.workers.dev`。到 PWA：**設定 → MCP 工具整合 → 新增 MCP 伺服器**，填 Worker 網址與 `MCP_API_KEY`（填在 API Key 欄位），再到角色設定裡啟用想用的工具。

沒設定 `MCP_API_KEY` 時 Worker 會拒絕所有請求（避免別人知道網址就能用）。想要更多／自訂的工具：**神秘門**（MCP 市集）可以勾選工具並產生 Worker 程式碼，部署方式相同。

### 紫微斗數 MCP
角色的紫微斗數命盤需要**你自己部署的服務**（沒有公用服務，也不會用到別人的）。最簡單的做法是用**神秘門**：

1. 開啟 **神秘門**（MCP 市集）→ 勾選「紫微斗數排盤」（可再勾其他工具）→ 生成程式碼。
2. 照畫面說明建立 `package.json`、貼上程式碼（會帶一個 `src/ziwei-engine.js` 排盤引擎檔）、`npm install`、`npx wrangler secret put MCP_API_KEY`、`npm run deploy`。
3. 到 PWA：**設定 → MCP 工具整合 → 紫微斗數服務**，填 Worker 網址與 `MCP_API_KEY`。

沒設定時，角色頁會提示尚未設定，不會連到任何預設網址。也可以改用倉庫裡的 `ziwei-mcp-server/`（`npm run deploy`；排盤引擎以 iztro 交叉驗證，`npm test` 可執行測試）。

### 合成服務 (synth-worker)
語音合成（TTS）、圖片生成、語音辨識，以及**OpenAI 相容的 `/v1/embeddings`（免費嵌入模型，預設 `bge-m3`）**。

```bash
cd synth-worker
npx wrangler secret put SYNTH_TOKEN     # 必填：自己產生一組長亂數
npx wrangler secret put HF_TOKEN        # 選填：Hugging Face token
npx wrangler deploy
```
然後：
- **設定 → 合成服務**：填 Worker 網址與 `SYNTH_TOKEN`。
- 嵌入模型：**設定 → 聊天 API 串接 → 嵌入模型設定**，選「Cloudflare Workers AI（用你自己的 Worker）」，會自動帶入網址與 Token。

Workers AI 免費額度每天 10,000 neurons（UTC 午夜重置），用完請求會失敗、不會扣費。影片、音樂生成沒有免費路徑，可在合成服務設定改用付費服務（填你自己的金鑰）。詳見 `synth-worker/README.md`。

### Discord 機器人
讓角色在 Discord 的頻道與私訊裡說話，對話與記憶會和 PWA 同步。**完整的圖文步驟在 PWA 裡：設定 → Discord 整合 → 「第一次使用？Worker 部署教學」**（可一鍵複製 Worker 程式碼，全程網頁操作、不用裝任何東西）。

用 wrangler 部署（進階）。**每個人都部署在自己的 Cloudflare 帳號、用自己的資料庫，不會用到別人的 Worker**：

```bash
npx wrangler d1 create siios-discord-db           # 記下輸出的 database_id
```
編輯 `discord-worker/wrangler.toml`，把 `database_id` 的佔位文字換成你的（排程 `*/2 * * * *` 已經寫好）。

```bash
cd discord-worker
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put DISCORD_APPLICATION_ID
npx wrangler deploy --keep-vars
```
```bash
npx wrangler secret put ACCESS_KEY            # 存取密鑰：自己產生一組長亂數（PWA 教學頁有產生鈕）
```
Cloudflare 後台 → Worker → Settings → Variables 新增文字變數 `DISCORD_PUBLIC_KEY`。然後：
1. 開啟 `https://<你的worker>/setup?key=<你的ACCESS_KEY>` 註冊斜線指令。
2. Discord Developer Portal → **Interactions Endpoint URL** 填 `https://<你的worker>/discord/webhook`；Bot 頁開啟 **MESSAGE CONTENT INTENT**。
3. 在 Discord 用 `/configure` 設定 `API URL`、`API Key`、`Model`（也可設定回應模式 `Response Mode`）。
4. 把頻道綁定到角色：PWA 角色設定啟用 Discord 並填頻道 ID，再到 **設定 → Discord 整合** 按「同步角色資料到 Worker」；或在 Discord 用 `/channel bind`。

**存取密鑰（雙邊驗證）**：PWA 的「設定 → Discord 整合 → 存取密鑰」要填和 Worker 的 `ACCESS_KEY` 一樣的值，否則 Worker 對所有同步介面回 401（沒設 `ACCESS_KEY` 則回 503）；Discord 端的人要先 `/auth key:<密鑰>`，機器人才會理他（連錯 5 次鎖 15 分鐘；`/auth-reset` 可清掉其他人的驗證）。升級前就綁定過的使用者會自動視為已驗證。

資料表會在第一次請求時**自動建立**。更新 Worker 時重新貼上／部署最新的 `scripts/discord-bot-worker.js`，「測試連接」會提醒你版本是否過舊。

常用指令（`/auth` 所有人都能用；其餘只有伺服器管理員看得到）：`/auth`、`/auth-reset`、`/configure`、`/config`（含最近被模型拒絕的紀錄）、`/channel`、`/reroll`、`/clear`（只清對話／全部清除／只刪罐頭與錯誤訊息／只刪最近幾則回覆）、`/backup`。

**回應模式**（`/configure key:Response Mode`）：`discord`（預設，輕鬆聊天、短句）、`full`（完整描寫）、`dialogue_single`、`dialogue_multi`、`custom`（用 `Custom Response Prompt` 自訂）。

### Bilibili（選用）
影片用官方嵌入播放器播放，**不需要**登入，也**預設不連任何 Worker**。只有你自己部署了 Bilibili Worker 並在設定裡填入網址（設定鍵 `bilibili_worker_url`）才會用到影片資訊與 QR 登入；Bilibili 對 Cloudflare 的 IP 一律回 412，所以效果有限。推薦／熱門清單來自 GitHub Actions 產生的 `data/bilibili_*.json`。部署（選用）見 `bilibili-worker/README.md`。

### 共同觀看（YouTube／Bilibili）
播放頁下方的「👀 一起看」：選一個角色、選留言頻率（只在我說話時／30 秒／1 分鐘／2 分鐘／5 分鐘），按「開始一起看」。角色會依自己的個性（和設定的記憶）用你設定的 AI 即時說話，你也可以直接對他說話；結束時會存一則「一起看了什麼」的記憶。

角色**看不到畫面也聽不到聲音**（嵌入播放器是跨網域的，網頁讀不到）。他的資訊來源是：標題與頻道（YouTube 會自動抓）、你貼在「影片內容」欄的字幕／簡介／重點、播放時間（YouTube 讀得到；Bilibili 只知道一起看了多久）、以及你說的話；提示詞要求他不要編造沒看到的劇情。

---

## 跨裝置活動同步與瀏覽器擴充功能

把電腦與手機瀏覽器上的活動（YouTube、Twitter、Instagram、Facebook…）同步到 PWA，讓角色「知道你最近在看什麼」。資料先**端對端加密**（AES-256-GCM）再放進你自己 GitHub 帳號的私人 Gist，金鑰不會上傳。

**第一台裝置（建立）**
1. 建立 GitHub Token：<https://github.com/settings/tokens/new>（classic，只勾 **gist**）。
2. PWA：**設定 → 跨裝置同步 → 啟用**，貼上 Token。
3. 馬上**備份「加密金鑰」**，並到同一頁複製 **Gist ID**（之後也隨時看得到）。

**另一台裝置（加入）**：同一頁選「已經在另一台裝置啟用過了？加入既有的同步」，填 Token（同一個 GitHub 帳號）、Gist ID、加密金鑰。加入後停用只會解除自己這台，不會刪掉雲端資料。

**打開 PWA 時會自動同步**（啟動後同步一次；自動同步間隔可在該頁設定）。

**瀏覽器擴充功能（Chrome／Edge）**
1. `chrome://extensions/` → 開啟「開發人員模式」→「載入未封裝項目」→ 選 `activity-extension/`。
2. 擴充功能「設定」填入：GitHub Token、Gist ID、加密金鑰（和 PWA 相同），選隱私等級與要記錄的平台。
3. 啟用後，擴充功能會把活動合併進同一個 Gist；PWA 同步時就會收到。

**隱私等級**（**設定 → 活動同步**）：基本（只有平台與次數）、摘要（加上標題）、詳細（再加內容片段）。角色看到的內容不會超過你選的等級，也只包含你沒有關掉的平台；要打開同一頁的「允許 AI 角色存取」，角色才看得到這些活動。

---

## 備份與還原

**設定 → 資料備份與還原**：
- 本機：匯出／匯入 JSON 檔。
- GitHub：自動建立私人 repo `siios-backup`，存成 `siios-backup.json`（需要有 `repo` 權限的 Token）。
- Google Drive。
- 可設定自動備份間隔。

備份包含聊天、角色、記憶、設定等；**備份檔內含你的 API 金鑰與各種 Token**，請妥善保管。還原是「合併」不是覆蓋；出生日期以這台裝置填的為準（還原不會改它，避免繞過年齡確認）。

---

## 隱私與安全

- 聊天、記憶、設定都存在你的瀏覽器裡；只有你設定的 AI 服務、Worker 與（選用的）GitHub／Google 會收到相關資料。
- 各 Worker 的金鑰（`MCP_API_KEY`、`SYNTH_TOKEN`、Discord Token）存在 Cloudflare 的 Secrets，不要放進程式碼或貼到公開地方。
- Discord Worker 有**存取密鑰**（`ACCESS_KEY`）：PWA 要帶密鑰、Discord 使用者要先 `/auth`。密鑰請用長亂數，不要公開；懷疑外洩就換掉 `ACCESS_KEY`、重新部署並在 Discord 執行 `/auth-reset`。
- 年齡確認只存在本機；未滿 18 歲時，成人內容會鎖起來。

---

## 疑難排解

| 狀況 | 處理 |
|---|---|
| 圖示變成一串英文字 | 圖示字型沒載入：確認網路後重新整理。已使用過的 App 之後離線也能顯示（Service Worker 會快取字型與程式碼） |
| 更新後畫面沒變 | 重新整理一次；PWA 用 Service Worker，新版會在下次開啟時生效 |
| 角色沒有想起舊的事 | 設定 → 記憶設定確認來源有勾；沒設嵌入模型時只有關鍵字比對（相鄰兩字要有重疊） |
| 嵌入測試失敗 | 看測試顯示的原因：網址／模型名稱／金鑰；Gemini 要填完整的 `…/openai/embeddings` 網址 |
| Discord 機器人不回覆 | 見 PWA 內 Discord 教學的「常見問題」：Cron、MESSAGE CONTENT INTENT、頻道綁定 |
| 模型常常拒絕回覆 | 多半是 AI 服務自己的內容過濾，`/config` 可看最近被拒絕的紀錄；機器人會自動換亂數種子並精簡上下文重試 |

---

## 開發

```bash
npm test                              # Node 22.5 以上（單元測試用到 node:sqlite）
node scripts/update-sw-assets.mjs     # 新增／移除 js、css 檔案後，更新離線快取清單
```

- 純 JavaScript（ES modules），沒有建置步驟；IndexedDB（idb）、Material Symbols、Font Awesome 從 CDN 載入並由 Service Worker 快取。
- 修改 `sw.js` 或任何會被快取的檔案後，請把 `sw.js` 的 `CACHE_NAME` 版本加一。
- `scripts/discord-bot-worker.js` 是單一檔案（貼到 Cloudflare 用）；裡面的 `WORKER_VERSION` 要和 `js/apps/settings/discord-guide-data.js` 的 `EXPECTED_WORKER_VERSION` 一致（測試會檢查）。
- 專案結構：`js/apps/*` 各 App、`js/core/*` 共用核心（記憶系統、同步、錢包…）、`worldbook/` 內建世界書、`*-worker/` 各 Worker、`activity-extension/` 瀏覽器擴充功能、`tests/unit/` 單元測試、`docs/` 設計與流程文件。

## 授權

MIT License
