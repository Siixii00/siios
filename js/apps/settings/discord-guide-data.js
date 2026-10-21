// Discord Worker 部署教學的內容與純函式（不依賴瀏覽器，方便測試）；畫面在 discord-guide.js
// 與 scripts/discord-bot-worker.js 的 WORKER_VERSION 必須一致（tests/unit/discord-guide.test.mjs 會檢查）
export const EXPECTED_WORKER_VERSION = '2026.10.24';
export const WORKER_CODE_PATH = 'scripts/discord-bot-worker.js';
// 權限：查看頻道、傳送訊息、管理訊息（批次刪除用，沒有也能運作）、讀取訊息歷史、新增反應
export const INVITE_PERMISSIONS = 1024 + 2048 + 8192 + 65536 + 64;

export function buildInviteUrl(applicationId) {
    const id = String(applicationId || '').trim();
    if (!/^\d{15,25}$/.test(id)) return '';
    return `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot%20applications.commands&permissions=${INVITE_PERMISSIONS}`;
}

// 步驟內容：html 是說明（可含 <b>、<code>、<a>）；copy 是可一鍵複製的項目。{{WORKER}} 會換成使用者填的 Worker 網址
export const GUIDE_STEPS = [
    {
        title: '0. 事前準備（約 15 分鐘）',
        html: [
            '需要：<b>Discord 帳號</b>、<b>Cloudflare 免費帳號</b>（<a href="https://dash.cloudflare.com/sign-up" target="_blank">註冊</a>）、一組 <b>AI 服務的網址與金鑰</b>（OpenAI 相容格式，例如 OpenAI、各家代理或自架服務）。',
            '機器人是跑在<b>你自己的 Cloudflare 帳號</b>裡：對話、記憶、AI 金鑰都只存在你自己的 Worker 與資料庫，不會經過別人的伺服器。'
        ]
    },
    {
        title: '1. 建立 Discord 機器人',
        html: [
            '打開 <a href="https://discord.com/developers/applications" target="_blank">Discord Developer Portal</a> → <b>New Application</b> → 取名字。',
            '<b>General Information</b> 頁：複製 <b>Application ID</b> 和 <b>Public Key</b>（等一下要用）。',
            '<b>Bot</b> 頁：按 <b>Reset Token</b> 取得並<b>複製 Token</b>（只會顯示一次，請先存好；不要貼給別人）。',
            '同一頁往下找到 <b>Privileged Gateway Intents</b>，把 <b>MESSAGE CONTENT INTENT</b> 打開並儲存——沒開的話機器人讀不到訊息內容。'
        ]
    },
    {
        title: '2. 把機器人邀請到你的伺服器',
        html: [
            '在下面填入你的 Application ID，會產生邀請連結（權限已包含：查看頻道、傳送訊息、讀取歷史、新增反應、管理訊息）。',
            '打開連結 → 選你的伺服器 → 授權。想用<b>私訊（DM）</b>聊天的話，你和機器人要在同一個伺服器裡，且在該伺服器的隱私設定允許「來自伺服器成員的私訊」。'
        ],
        invite: true
    },
    {
        title: '3. 建立 Worker 並貼上程式碼',
        html: [
            '登入 <a href="https://dash.cloudflare.com" target="_blank">Cloudflare</a> → 左邊 <b>Workers &amp; Pages</b> → <b>Create</b> → <b>Create Worker</b> → 取名（例如 <code>siios-discord-bot</code>）→ <b>Deploy</b>。',
            '部署後按 <b>Edit code</b>，把編輯器裡原本的程式碼<b>全部刪掉</b>，貼上下面複製的程式碼，再按右上角 <b>Deploy</b>。',
            '網址會是 <code>https://名稱.你的帳號.workers.dev</code>，請記下來。'
        ],
        code: true
    },
    {
        title: '4. 建立資料庫並綁定',
        html: [
            'Cloudflare 左邊 <b>Storage &amp; databases</b> → <b>D1 SQL database</b> → <b>Create database</b> → 名稱例如 <code>siios-discord-db</code>。',
            '回到你的 Worker → <b>Settings</b> → <b>Bindings</b> → <b>Add</b> → <b>D1 database</b> → Variable name 必須填 <b>DB</b>（大寫），選剛建立的資料庫 → 儲存。',
            '<b>資料表不用自己建</b>，Worker 第一次被呼叫時會自動建立。'
        ],
        copy: [{ label: 'Variable name', text: 'DB' }]
    },
    {
        title: '5. 設定密鑰與變數',
        html: [
            'Worker → <b>Settings</b> → <b>Variables and Secrets</b> → <b>Add</b>，新增下面四個（Token 與 ACCESS_KEY 的 Type 選 <b>Secret</b>，其餘選 Text 即可）：',
            '<code>DISCORD_BOT_TOKEN</code> = 步驟 1 的 Token<br><code>DISCORD_APPLICATION_ID</code> = 步驟 1 的 Application ID<br><code>DISCORD_PUBLIC_KEY</code> = 步驟 1 的 Public Key<br><code>ACCESS_KEY</code> = <b>存取密鑰</b>（用下面的按鈕產生一組隨機的）',
            '<b>存取密鑰</b>是你自己的通行證：沒有它，別人就算知道你的 Worker 網址也不能呼叫；PWA 和 Discord 都要輸入它才能使用（PWA 在「設定 → Discord 整合」的存取密鑰欄，Discord 用 <code>/auth</code>）。按「產生密鑰」會順便存進這支 PWA，你只要把它貼到 Cloudflare 的 ACCESS_KEY。',
            '儲存後如果 Cloudflare 提示要重新部署，按 <b>Deploy</b>。AI 的網址與金鑰<b>不用</b>放這裡，之後在 Discord 裡用指令設定。'
        ],
        copy: [{ label: 'DISCORD_BOT_TOKEN', text: 'DISCORD_BOT_TOKEN' }, { label: 'DISCORD_APPLICATION_ID', text: 'DISCORD_APPLICATION_ID' }, { label: 'DISCORD_PUBLIC_KEY', text: 'DISCORD_PUBLIC_KEY' }, { label: 'ACCESS_KEY', text: 'ACCESS_KEY' }],
        accessKey: true
    },
    {
        title: '6. 加上排程（Cron）',
        html: [
            'Worker → <b>Settings</b> → <b>Triggers</b> → <b>Cron Triggers</b> → <b>Add</b>，填入下面這行（每 2 分鐘執行一次），儲存。',
            '機器人靠這個排程保持運作、檢查新訊息；<b>沒加的話機器人不會回覆</b>。'
        ],
        copy: [{ label: 'Cron', text: '*/2 * * * *' }]
    },
    {
        title: '7. 啟動並註冊斜線指令',
        html: [
            '在瀏覽器打開：<code>{{WORKER}}/setup?key=你的存取密鑰</code>，看到「斜線指令已註冊」就成功（沒帶密鑰會顯示 401）。',
            '到 Developer Portal → <b>General Information</b> → <b>Interactions Endpoint URL</b>，填入下面的網址並儲存（Discord 會驗證，失敗代表步驟 5 的 Public Key 填錯）。'
        ],
        copy: [{ label: 'Interactions Endpoint URL', text: '{{WORKER}}/discord/webhook' }, { label: '註冊指令（要補上 ?key=密鑰）', text: '{{WORKER}}/setup?key=' }]
    },
    {
        title: '8. 在 Discord 驗證並設定 AI',
        html: [
            '先在 Discord 輸入 <code>/auth key:你的存取密鑰</code>（只有你看得到回覆）。沒通過驗證的人，機器人不會理他，私訊也只會提示一次。連續輸入錯誤 5 次會鎖 15 分鐘。朋友要一起用的話，把密鑰給他讓他自己 <code>/auth</code>。',
            '之後在伺服器任一頻道輸入斜線指令（只有伺服器管理員看得到這些指令）：',
            '<code>/configure key:API URL value:https://你的AI網址</code>（<b>不要</b>加 /v1 與後面的路徑）<br><code>/configure key:API Key value:你的金鑰</code><br><code>/configure key:Model value:模型名稱</code>',
            '用 <code>/config</code> 確認設定（金鑰只會顯示前 4 碼）。輸出的長短與格式可用 <code>/configure key:Response Mode</code> 選 discord／full／dialogue_single／dialogue_multi／custom。'
        ]
    },
    {
        title: '9. 綁定角色',
        html: [
            '開啟 Discord 的<b>開發者模式</b>（使用者設定 → 進階），在頻道上按右鍵 → <b>複製頻道 ID</b>（私訊也一樣：對私訊頻道按右鍵複製）。',
            'PWA：角色設定 → 啟用 Discord 並填入頻道 ID；回到本頁按「🔄 同步角色資料到 Worker」。',
            '或直接在 Discord 該頻道輸入 <code>/channel bind character_id:角色ID</code>。沒有綁定角色、也沒加入允許清單的頻道，機器人不會回應；想讓機器人在沒綁角色的頻道說話，用 <code>/channel allow</code>。'
        ]
    },
    {
        title: '10. 回到 PWA 完成串接',
        html: [
            '回上一頁，把 Worker 網址填進「Worker URL」、存取密鑰填進「存取密鑰」，按「測試連接」（會檢查連線、密鑰與版本，過舊會提醒你更新）。',
            '依需要按下面的按鈕：同步角色、同步用戶面具、同步世界書、🧠 同步記憶（雙向）。之後記憶每 30 分鐘會自動同步。',
            '在已綁定的頻道或私訊傳一句話，約 2 分鐘內機器人就會回覆（即時連線有啟動時更快）。'
        ]
    }
];

export const TROUBLESHOOTING = [
    ['機器人完全不回', '確認：① 步驟 6 的 Cron 有加；② 步驟 1 的 MESSAGE CONTENT INTENT 有開；③ 該頻道已綁定角色，或用 /channel allow 加入允許清單（私訊頻道也一樣）；④ 開 <code>{{WORKER}}/discord/ping</code> 應該看到 success。'],
    ['PWA 顯示 401／存取密鑰不正確', 'PWA 的「存取密鑰」要和 Cloudflare Worker 的 <code>ACCESS_KEY</code> 完全相同（不要有空白）。改了 Worker 的密鑰要重新 Deploy；Discord 那邊其他人也要重新驗證（你自己先 <code>/auth</code>，再用 <code>/auth-reset</code> 清掉舊的）。'],
    ['機器人說「請先用 /auth」', '在 Discord 輸入 <code>/auth key:存取密鑰</code>。如果說 Worker 還沒設定 ACCESS_KEY，回到步驟 5 新增。'],
    ['斜線指令沒出現', '重新打開 <code>{{WORKER}}/setup</code>；Discord 客戶端按 Ctrl/Cmd+R 重新整理。指令只有伺服器管理員看得到。'],
    ['Interactions Endpoint URL 儲存失敗', '步驟 5 的 DISCORD_PUBLIC_KEY 要和 Developer Portal 的 Public Key 完全一致（沒有多餘空白），且 Worker 已重新部署。'],
    ['回覆「資料庫尚未綁定」', '步驟 4 的 D1 綁定 Variable name 必須是大寫的 <code>DB</code>。'],
    ['回覆被拒絕或出現錯誤訊息', '多半是 AI 服務的問題（額度、模型名稱、內容過濾）。用 /config 看「最近被拒絕」紀錄；API URL 不要多加 /v1。'],
    ['更新 Worker', '本頁的版本提醒出現時，回到步驟 3 重新複製程式碼貼上並 Deploy；資料庫與設定都不會動，再開一次 <code>{{WORKER}}/setup</code> 讓新指令生效。']
];

export const SECURITY_NOTES = [
    '<b>存取密鑰（ACCESS_KEY）是第一道鎖：</b>PWA 呼叫 Worker 要帶它，Discord 使用者要先 <code>/auth</code>。請用夠長的隨機字串（教學的產生鈕就是），不要和其他密碼共用，也不要貼到公開地方。懷疑外洩：在 Cloudflare 換掉 ACCESS_KEY、重新 Deploy、PWA 改成新密鑰，並在 Discord 執行 <code>/auth-reset</code>。',
    'Token、AI 金鑰只存在你自己的 Cloudflare 與 Worker 資料庫；<b>請勿貼到公開頻道、截圖或分享</b>。懷疑外洩就到 Developer Portal 重設 Token，並在 Discord 重新 /configure。',
    'Cloudflare 免費方案通常夠個人使用（Worker 與 D1 都有免費額度）；用量大時請留意額度。'
];
