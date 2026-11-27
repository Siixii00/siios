// Discord 記憶「為什麼拉不回來」的診斷。
// Worker 的 GET /sync/diagnose 只回數量與時間（不含記憶內容、也不含任何金鑰），這裡把它和本機設定對照，逐關列出哪裡沒過。
// 純函式、不碰 IndexedDB，tests/unit/discord-diagnose.test.mjs 直接測。

const isChannelId = id => /^\d{15,}$/.test(String(id || '')); // Discord 頻道 ID（雪花 ID）；PWA 的角色 id 不是純數字
const check = (status, title, hint = '') => ({ status, title, hint });
const fmtTime = ts => { const t = Date.parse(ts); return Number.isFinite(t) ? new Date(t).toLocaleString('zh-TW', { hour12: false }) : '未知時間'; };

// report：Worker 的診斷回報；localChars：PWA 的角色；localDiscordMemories：本機已經有幾筆從 Discord 拉下來的記憶
// 回傳 [{ status: 'ok' | 'warn' | 'bad', title, hint }]，依資料流的順序排列
export function judgeMemoryPipeline({ report, localChars, localDiscordMemories = 0 }) {
    const out = [];
    const bound = localChars.filter(c => c.discord_enabled && c.discord_channel_id);
    const memOf = id => (report.memories || []).find(m => m.character_id === id);
    const msgOf = id => (report.messages || []).find(m => m.chat_id === id);

    out.push(report.ai_configured?.url && report.ai_configured?.key
        ? check('ok', 'Worker 已設定 AI')
        : check('bad', 'Worker 沒有設定 AI（AI_API_URL、AI_API_KEY）', '機器人靠它回覆，也靠它從對話裡萃取記憶，沒設就不會有任何記憶。到 Cloudflare 的 Variables and Secrets 新增，或在 Discord 用 /configure 設定。'));

    out.push(report.authorized_users > 0
        ? check('ok', `已有 ${report.authorized_users} 位使用者通過 /auth`)
        : check('bad', '還沒有任何人通過 /auth', '沒通過的人，訊息會被機器人直接忽略（不回覆、也不存記憶）。在 Discord 打 /auth，key 填 PWA 的「存取密鑰」。'));

    if (!bound.length) {
        out.push(check('bad', 'PWA 裡沒有任何角色啟用 Discord', '到角色設定頁打開 Discord、填頻道 ID 並儲存。只有這樣的角色，PWA 才會去 Worker 拉記憶（設定頁的「頻道映射」只存在本機，不算）。'));
    }
    for (const c of bound) {
        const name = c.name || '未命名角色';
        const bind = (report.bindings || []).find(b => b.character_id === c.id);
        if (!bind) {
            out.push(check('bad', `「${name}」的頻道綁定沒有同步到 Worker`, '到該角色設定頁再按一次儲存（會把綁定送到 Worker）。'));
            continue;
        }
        if (bind.channel_id !== c.discord_channel_id) {
            out.push(check('warn', `「${name}」在 PWA 與 Worker 綁的頻道不同`, `PWA 是 ${c.discord_channel_id}，Worker 是 ${bind.channel_id}。到角色設定頁重新儲存。`));
        }
        const mem = memOf(c.id);
        const msg = msgOf(c.id);
        const learned = mem?.discord || 0, users = msg?.user_msgs || 0, ais = msg?.ai_msgs || 0;
        if (learned > 0) {
            out.push(check('ok', `「${name}」：Worker 上有 ${learned} 筆 Discord 記憶`, `最近一筆：${fmtTime(mem.last_discord_at)}`));
        } else if (!users) {
            out.push(check('bad', `「${name}」：Worker 從沒收到這個頻道的 Discord 訊息`, '確認：① 你已通過 /auth；② 有在綁定的頻道說話或 @機器人；③ Discord 開發者後台已開 MESSAGE CONTENT INTENT；④ 機器人已用 /setup 啟動。'));
        } else if (!ais) {
            out.push(check('warn', `「${name}」：收到你的 ${users} 則訊息，但機器人沒回覆過`, '多半是 AI 設定或模型出錯。在頻道 @機器人 說一句，看有沒有錯誤訊息。'));
        } else {
            out.push(check('warn', `「${name}」：有對話（你 ${users} 則、機器人 ${ais} 則），但還沒學到記憶`, '記憶是 AI 從對話挑「值得記的事」，閒聊太短可能一則都沒有。聊幾句具體的事（約定、喜好、發生的事）再診斷一次。'));
        }
    }

    // 頻道沒綁角色時，訊息與記憶會存在「頻道 ID」底下，PWA 用角色 id 去拉就拉不到
    const known = new Set(localChars.map(c => c.id));
    const strays = new Map();
    for (const m of report.memories || []) if (isChannelId(m.character_id) && !known.has(m.character_id) && m.discord > 0) strays.set(m.character_id, { memories: m.discord, messages: 0 });
    for (const m of report.messages || []) if (isChannelId(m.chat_id) && !known.has(m.chat_id)) strays.set(m.chat_id, { memories: strays.get(m.chat_id)?.memories || 0, messages: (m.user_msgs || 0) + (m.ai_msgs || 0) });
    for (const [id, n] of strays) {
        out.push(check('warn', `有 ${n.messages} 則訊息、${n.memories} 筆記憶存在頻道 ${id} 底下`, '那個頻道當時沒有綁定角色，資料沒有歸屬，所以拉不回來。到想用的角色設定頁綁定該頻道；已經存下的舊資料不會自動歸過去。'));
    }

    const workerDiscord = bound.reduce((sum, c) => sum + (memOf(c.id)?.discord || 0), 0);
    if (workerDiscord > 0 && localDiscordMemories === 0) {
        out.push(check('warn', 'Worker 有記憶，但本機還沒拉下來', '按「🧠 同步記憶（雙向）」。'));
    }
    return out;
}
