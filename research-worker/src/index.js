// 研究參與（選填）的接收端：只收「匿名編號＋週別＋用過的 App 名稱」，其他一律拒絕。
// 驗證規則與 PWA 共用同一份（js/core/research-core.js），所以多一個欄位、白名單外的名稱都會被擋下。
// 刻意不讀、不存：來源位址、瀏覽器與裝置資訊、Cookie、時間戳記。
import { validatePayload, isValidPid, cleanApps } from '../../js/core/research-core.js';

const MAX_BODY = 2048;

function cors(env, request) {
    const allowed = (env.ALLOWED_ORIGIN || '').trim();
    const origin = request.headers.get('Origin') || '';
    return {
        'Access-Control-Allow-Origin': allowed || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Cache-Control': 'no-store',
        Vary: 'Origin',
        _ok: !allowed || origin === allowed
    };
}

const json = (status, obj, headers) => {
    const { _ok, ...h } = headers;
    return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...h } });
};

async function readJson(request) {
    const text = await request.text();
    if (text.length > MAX_BODY) return { error: 'too-large' };
    try { return { body: JSON.parse(text) }; } catch (_) { return { error: 'bad-json' }; }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const headers = cors(env, request);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: Object.fromEntries(Object.entries(headers).filter(([k]) => k !== '_ok')) });
        if (request.method === 'GET' && url.pathname === '/') return json(200, { ok: true }, headers);
        if (request.method !== 'POST') return json(405, { error: 'method' }, headers);
        if (!headers._ok) return json(403, { error: 'origin' }, headers);
        if (!env.DB) return json(503, { error: 'not-configured' }, headers);

        const parsed = await readJson(request);
        if (parsed.error) return json(parsed.error === 'too-large' ? 413 : 400, { error: parsed.error }, headers);

        if (url.pathname === '/collect') {
            const v = validatePayload(parsed.body);
            if (!v.ok) return json(400, { error: v.reason }, headers);
            const { pid, week, apps } = parsed.body;
            const row = await env.DB.prepare('SELECT apps FROM app_usage WHERE pid = ? AND week = ?').bind(pid, week).first();
            let merged = apps;
            if (row) { try { merged = cleanApps([...JSON.parse(row.apps), ...apps]); } catch (_) { merged = apps; } }
            await env.DB.prepare('INSERT INTO app_usage (pid, week, apps) VALUES (?, ?, ?) ON CONFLICT(pid, week) DO UPDATE SET apps = excluded.apps')
                .bind(pid, week, JSON.stringify(merged)).run();
            return json(200, { ok: true }, headers);
        }

        if (url.pathname === '/delete') {
            const b = parsed.body;
            if (!b || typeof b !== 'object' || Object.keys(b).join(',') !== 'pid' || !isValidPid(b.pid)) return json(400, { error: 'bad-request' }, headers);
            await env.DB.prepare('DELETE FROM app_usage WHERE pid = ?').bind(b.pid).run();
            return json(200, { ok: true }, headers);
        }

        return json(404, { error: 'not-found' }, headers);
    }
};
