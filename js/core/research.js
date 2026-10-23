// 研究參與（選填）：記錄「這週用過哪些 App」，使用者同意後每天最多上傳一次。
// 規則與保證寫在 research-core.js 和 docs/RESEARCH_DATA.md；預設關閉，未成年者與未設定網址時完全不運作。
import { SettingsDB } from '../db.js';
import { hasBirthdate, isAdult } from './age-gate.js';
import { RESEARCH_ENDPOINT, CONSENT_VERSION, INVITE_AFTER_OPENS } from './research-config.js';
import { isoWeek, isTrackedApp, cleanApps, buildPayload } from './research-core.js';

const KEY = 'research_state';
const KEEP_WEEKS = 2; // 本機只留最近兩週的清單
const defaults = () => ({ enabled: false, consentVersion: 0, pid: '', weeks: {}, lastUploadDay: '', lastUploadedSig: '', visits: 0, invited: false });

let cache = null;
let uploadTimer = null;

async function load() {
    if (!cache) cache = { ...defaults(), ...((await SettingsDB.get(KEY)) || {}) };
    return cache;
}
async function save() { await SettingsDB.set(KEY, cache); }
const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD（本機日期）

// 有設定網址、且確認是成年人才開放；其他情況完全不顯示、不記錄、不送出
export const isAvailable = () => !!RESEARCH_ENDPOINT && hasBirthdate() && isAdult();

export async function getState() {
    const s = await load();
    return { ...s, available: isAvailable(), consentCurrent: s.consentVersion === CONSENT_VERSION };
}

// 目前這一週會送出去的內容（讓使用者先看過；沒有資料時回傳 null）
export async function previewPayload() {
    const s = await load();
    return buildPayload(s.pid, isoWeek(), s.weeks[isoWeek()]);
}

export async function enable() {
    if (!isAvailable()) throw new Error('目前無法參加');
    const s = await load();
    s.enabled = true;
    s.consentVersion = CONSENT_VERSION;
    if (!s.pid) s.pid = crypto.randomUUID();
    s.invited = true;
    await save();
}

// 退出：停止記錄並清掉本機清單；deleteRemote 為 true 時，也請後端刪除這個匿名編號的資料
export async function disable({ deleteRemote = false } = {}) {
    const s = await load();
    let remote = 'skipped';
    if (deleteRemote && s.pid && RESEARCH_ENDPOINT) {
        try {
            const res = await post('/delete', { pid: s.pid });
            remote = res.ok ? 'deleted' : 'failed';
        } catch (_) { remote = 'failed'; }
    }
    if (remote !== 'failed') s.pid = ''; // 刪除成功（或沒要求刪除）就換掉匿名編號，之後再參加會是全新的編號
    s.enabled = false;
    s.consentVersion = 0;
    s.weeks = {};
    s.lastUploadedSig = '';
    await save();
    clearTimeout(uploadTimer);
    return remote;
}

export async function dismissInvite() {
    const s = await load();
    s.invited = true;
    await save();
}

// 只問一次：開過一定次數的 App、還沒表態過
export async function shouldInvite() {
    if (!isAvailable()) return false;
    const s = await load();
    return !s.enabled && !s.invited && s.visits >= INVITE_AFTER_OPENS;
}

function post(path, body) {
    return fetch(RESEARCH_ENDPOINT.replace(/\/+$/, '') + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true
    });
}

// 每次打開某個 App 時呼叫（registry 的路由處理）。沒同意就只會把本機計數加一
export async function recordAppOpen(appId) {
    if (!isAvailable()) return;
    const s = await load();
    if (!s.enabled || s.consentVersion !== CONSENT_VERSION) {
        s.visits += 1;
        await save();
        return;
    }
    if (!isTrackedApp(appId)) return;
    const week = isoWeek();
    const next = cleanApps([...(s.weeks[week] || []), appId]);
    if (next.length === (s.weeks[week] || []).length) return;
    s.weeks[week] = next;
    for (const w of Object.keys(s.weeks).sort().slice(0, -KEEP_WEEKS)) delete s.weeks[w];
    await save();
    scheduleUpload();
}

function scheduleUpload() {
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadIfDue().catch(() => {}), 5000);
}

// 每天最多上傳一次，而且只在「清單有變」時才送；失敗就算了，下次再說
export async function uploadIfDue() {
    if (!isAvailable()) return false;
    const s = await load();
    if (!s.enabled || s.consentVersion !== CONSENT_VERSION || s.lastUploadDay === today()) return false;
    const week = isoWeek();
    const payload = buildPayload(s.pid, week, s.weeks[week]);
    if (!payload) return false;
    const sig = week + ':' + payload.apps.join(',');
    if (sig === s.lastUploadedSig) return false;
    try {
        const res = await post('/collect', payload);
        if (!res.ok) return false;
        s.lastUploadDay = today();
        s.lastUploadedSig = sig;
        await save();
        return true;
    } catch (_) { return false; }
}
