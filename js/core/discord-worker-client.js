// 呼叫自己的 Discord Worker：自動帶上存取密鑰（設定 → Discord 整合 → 存取密鑰，要和 Worker 的 ACCESS_KEY 相同）
import { SettingsDB } from './db.js';

export async function workerFetch(url, init = {}) {
    const key = String((await SettingsDB.get('discord_worker_key')) || '').trim();
    const headers = { ...(init.headers || {}) };
    if (key) headers.Authorization = `Bearer ${key}`;
    return fetch(url, { ...init, headers });
}

// 產生一組隨機的存取密鑰（32 個位元組 → 43 字元，只含英數與 - _）
export function generateAccessKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// 回傳 { ok, message }：先確認 Worker 在線，再確認密鑰通過
export async function testWorkerAccess(workerUrl) {
    const base = String(workerUrl || '').replace(/\/+$/, '');
    if (!base) return { ok: false, message: '請先填 Worker 網址' };
    let ping;
    try { ping = await (await fetch(`${base}/discord/ping`)).json(); } catch (e) { return { ok: false, message: '連不到 Worker：' + e.message }; }
    if (!ping?.success) return { ok: false, message: 'Worker 回應異常' };
    if (ping.access_key_configured === false) return { ok: false, message: 'Worker 還沒有設定 ACCESS_KEY（到 Cloudflare 的 Variables and Secrets 新增 Secret）', ping };
    const res = await workerFetch(`${base}/discord/auth-check`);
    if (res.status === 401) return { ok: false, message: '存取密鑰不正確（要和 Worker 的 ACCESS_KEY 完全相同）', ping };
    if (!res.ok) return { ok: false, message: 'Worker 回應 ' + res.status, ping };
    return { ok: true, message: 'Worker 連線與存取密鑰都正常（版本 ' + (ping.version || '?') + '）', ping };
}
