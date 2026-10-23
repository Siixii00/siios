// 研究參與（選填）的純函式：哪些 App 算、一週怎麼算、送出的資料長什麼樣子。
// 這裡不碰 IndexedDB、不碰網路，所以可以直接單元測試；送出的資料「只有」buildPayload 回傳的四個欄位。
//
// 保證：
//   - 只會記錄 TRACKED_APPS 裡的固定名稱（不會記任何使用者輸入、聊天內容、AI 生成內容、角色名稱）
//   - 時間只到「週」（YYYY-Www），沒有時間點、沒有停留時間
//   - 沒有 IP、裝置、瀏覽器資訊（也不帶 cookie／referrer）
//   - 成人限定的 App（酒館、約會、AO3、Lofter）和系統／隱私相關頁面（設定、通行密鑰…）完全不記

export const PAYLOAD_VERSION = 1;

// 只追蹤這些主畫面 App（固定白名單；後端 Worker 也有同一份，測試會確認兩邊一致）
export const TRACKED_APPS = [
    'album', 'arcade', 'bilibili', 'bubbles', 'chats', 'chrome', 'daily-recipe', 'delivery',
    'drift-bottle', 'emoji-shop', 'exchange-diary', 'facebook', 'farm', 'gift-shop', 'guzi-guide',
    'health', 'instagram', 'invest', 'kakaopay', 'match-3', 'mcp-market', 'memory', 'music',
    'payment-code', 'personal-wiki', 'phone', 'pomodoro', 'smart-painter', 'stay', 'taobao',
    'theater', 'theme-shop', 'timetree', 'twitch', 'twitter', 'weather', 'weverse', 'widget',
    'world-info', 'youtube'
];

const TRACKED = new Set(TRACKED_APPS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WEEK_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

export const isTrackedApp = id => TRACKED.has(id);
export const isValidPid = pid => typeof pid === 'string' && UUID_RE.test(pid);
export const isValidWeek = week => typeof week === 'string' && WEEK_RE.test(week);

// ISO 週別（以 UTC 計算，所以全世界同一時間算出同一週）
export function isoWeek(date = new Date()) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// 把任意清單整理成「白名單內、不重複、排序過」的 App 清單
export function cleanApps(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter(isTrackedApp))].sort();
}

// 真正送出去的資料：只有這四個欄位。格式不對就回傳 null（寧可不送）
export function buildPayload(pid, week, apps) {
    if (!isValidPid(pid) || !isValidWeek(week)) return null;
    const clean = cleanApps(apps);
    if (!clean.length) return null;
    return { v: PAYLOAD_VERSION, pid, week, apps: clean };
}

// 後端／測試共用的檢查：收到的資料是不是剛好符合上面的格式（多一個欄位也拒絕）
export function validatePayload(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'not-object' };
    const keys = Object.keys(body).sort().join(',');
    if (keys !== 'apps,pid,v,week') return { ok: false, reason: 'unexpected-fields' };
    if (body.v !== PAYLOAD_VERSION) return { ok: false, reason: 'version' };
    if (!isValidPid(body.pid)) return { ok: false, reason: 'pid' };
    if (!isValidWeek(body.week)) return { ok: false, reason: 'week' };
    if (!Array.isArray(body.apps) || body.apps.length === 0 || body.apps.length > TRACKED_APPS.length) return { ok: false, reason: 'apps' };
    if (!body.apps.every(isTrackedApp) || new Set(body.apps).size !== body.apps.length) return { ok: false, reason: 'apps' };
    return { ok: true };
}
