// 「我該部署哪個？」簡易問答：選一個想要的功能，告訴使用者要不要部署、部署哪個、填在哪裡。
// 所有服務都是使用者自己部署（自己的 Cloudflare 帳號、自己的金鑰），不會用到別人的伺服器。
export const DEPLOY_QUIZ = {
    question: '你想讓 App 多做到什麼？',
    options: [
        {
            id: 'chat-only',
            label: '只想聊天、玩各個 App',
            need: '不用部署任何東西',
            steps: ['到「設定 → 聊天 API 串接」填 API 網址、金鑰和模型就能用。'],
            open: { label: '開啟 API 設定', path: '/settings' }
        },
        {
            id: 'tools',
            label: '讓角色查天氣、食譜、動漫、翻譯、商品價格',
            need: '部署一個 MCP 工具 Worker（用神秘門精靈，只要瀏覽器）',
            steps: [
                '開啟神秘門，勾選要的工具，按「生成程式碼」。',
                '照「三步驟上線」：複製程式碼 → 貼到 Cloudflare 網頁 → 貼回網址。',
                '按「測試並加入」，會自動加進 MCP 設定，之後角色聊天時會自己決定要不要用。'
            ],
            open: { label: '開啟神秘門', path: '/mcp-market' }
        },
        {
            id: 'ziwei',
            label: '角色的紫微斗數命盤',
            need: '部署紫微斗數 MCP（自己部署，沒有公用服務）',
            steps: [
                '開啟神秘門，勾選「紫微斗數排盤」，按「生成程式碼」。',
                '這個工具含額外檔案，精靈會提供 ZIP 與指令版步驟，照著做。',
                '到「設定 → MCP 工具整合 → 紫微斗數服務」填網址與金鑰。'
            ],
            open: { label: '開啟神秘門', path: '/mcp-market' }
        },
        {
            id: 'synth',
            label: '語音、生圖、語音辨識，或免費的嵌入模型（讓記憶有語意搜尋）',
            need: '部署合成服務 Worker（synth-worker）',
            steps: [
                '用指令部署 synth-worker，設定 SYNTH_TOKEN（步驟在 README「合成服務」）。',
                '到「設定 → 合成服務」填 Worker 網址與 SYNTH_TOKEN。',
                '嵌入模型：到「設定 → 聊天 API 串接 → 嵌入模型設定」選「Cloudflare Workers AI（用你自己的 Worker）」。'
            ],
            open: { label: '開啟合成服務設定', path: '/settings/synth' }
        },
        {
            id: 'discord',
            label: '讓角色在 Discord 上說話',
            need: '部署 Discord 機器人 Worker',
            steps: [
                '開啟「設定 → Discord 整合」，點「第一次使用？Worker 部署教學」，照圖文步驟做（不用終端機）。',
                '部署完把 Worker 網址和存取密鑰填回同一頁，按「測試連接」。'
            ],
            open: { label: '開啟 Discord 教學', path: '/settings/discord/guide' }
        },
        {
            id: 'bilibili',
            label: '在 Bilibili 登入帳號',
            need: '通常不需要：影片用官方嵌入播放器，不用登入也不連任何 Worker',
            steps: ['真的要掃碼登入才需要自己部署 bilibili-worker（選用，步驟在 README「Bilibili」）。']
        }
    ]
};

export function findQuizAnswer(id, quiz = DEPLOY_QUIZ) {
    return quiz.options.find(o => o.id === id) || null;
}
