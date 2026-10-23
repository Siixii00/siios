import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../../research-worker/src/index.js';

const PID = '3f2b8c1e-5d7a-4c2e-9b1a-0a1b2c3d4e5f';

// 極簡的假 D1：只實作 worker 用到的三種語句
function fakeDb() {
    const rows = new Map();
    return {
        rows,
        prepare(sql) {
            let args = [];
            const stmt = {
                bind(...a) { args = a; return stmt; },
                async first() { const r = rows.get(args[0] + '|' + args[1]); return r ? { apps: r } : null; },
                async run() {
                    if (/^INSERT/.test(sql)) rows.set(args[0] + '|' + args[1], args[2]);
                    if (/^DELETE/.test(sql)) for (const k of [...rows.keys()]) if (k.startsWith(args[0] + '|')) rows.delete(k);
                }
            };
            return stmt;
        }
    };
}

const req = (path, body, init = {}) => new Request('https://r.example' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body)
});

test('收下正確格式的資料，同一週再送會合併 App 清單', async () => {
    const env = { DB: fakeDb() };
    let r = await worker.fetch(req('/collect', { v: 1, pid: PID, week: '2026-W43', apps: ['chats'] }), env);
    assert.equal(r.status, 200);
    r = await worker.fetch(req('/collect', { v: 1, pid: PID, week: '2026-W43', apps: ['music'] }), env);
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(env.DB.rows.get(PID + '|2026-W43')), ['chats', 'music']);
});

test('多餘欄位、白名單外的名稱、過大的內容、壞 JSON 都被拒絕，且不寫入', async () => {
    const env = { DB: fakeDb() };
    const bad = [
        { v: 1, pid: PID, week: '2026-W43', apps: ['chats'], text: '聊天內容' },
        { v: 1, pid: PID, week: '2026-W43', apps: ['chats', '角色小美'] },
        { v: 1, pid: PID, week: '2026-W43', apps: ['pub'] },
        { v: 1, pid: 'x', week: '2026-W43', apps: ['chats'] }
    ];
    for (const b of bad) assert.equal((await worker.fetch(req('/collect', b), env)).status, 400);
    assert.equal((await worker.fetch(req('/collect', 'not json'), env)).status, 400);
    assert.equal((await worker.fetch(req('/collect', 'x'.repeat(5000)), env)).status, 413);
    assert.equal(env.DB.rows.size, 0);
});

test('/delete 刪掉這個編號的全部資料；格式不對不處理', async () => {
    const env = { DB: fakeDb() };
    await worker.fetch(req('/collect', { v: 1, pid: PID, week: '2026-W42', apps: ['chats'] }), env);
    await worker.fetch(req('/collect', { v: 1, pid: PID, week: '2026-W43', apps: ['music'] }), env);
    assert.equal((await worker.fetch(req('/delete', { pid: PID, extra: 1 }), env)).status, 400);
    assert.equal(env.DB.rows.size, 2);
    assert.equal((await worker.fetch(req('/delete', { pid: PID }), env)).status, 200);
    assert.equal(env.DB.rows.size, 0);
});

test('設定了 ALLOWED_ORIGIN 時，其他來源被拒絕', async () => {
    const env = { DB: fakeDb(), ALLOWED_ORIGIN: 'https://me.github.io' };
    const body = { v: 1, pid: PID, week: '2026-W43', apps: ['chats'] };
    assert.equal((await worker.fetch(req('/collect', body, { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
    assert.equal((await worker.fetch(req('/collect', body, { headers: { Origin: 'https://me.github.io' } }), env)).status, 200);
});

test('沒有資料庫設定、不支援的方法與路徑、預檢請求', async () => {
    assert.equal((await worker.fetch(req('/collect', {}), {})).status, 503);
    assert.equal((await worker.fetch(new Request('https://r.example/collect', { method: 'GET' }), { DB: fakeDb() })).status, 405);
    assert.equal((await worker.fetch(req('/other', {}), { DB: fakeDb() })).status, 404);
    const pre = await worker.fetch(new Request('https://r.example/collect', { method: 'OPTIONS' }), {});
    assert.equal(pre.status, 204);
});

test('程式碼完全沒有讀取 IP／User-Agent／國家等資訊', () => {
    const src = readFileSync(new URL('../../research-worker/src/index.js', import.meta.url), 'utf8').toLowerCase();
    for (const word of ['cf-connecting-ip', 'user-agent', 'x-forwarded-for', 'cf.country', 'request.cf']) assert.equal(src.includes(word), false, word);
});
