import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;
const src = readFileSync(workerUrl, 'utf8');
const H = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ isPublicRoute, safeEqual, extractAccessKey })', { URL, TextEncoder });

function makeEnv(extra = {}) {
    const db = new DatabaseSync(':memory:');
    const wrap = sql => ({
        bind: (...a) => ({ first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { db.prepare(sql).run(...a); return {}; } }),
        first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => { db.prepare(sql).run(); return {}; }
    });
    return { db, env: { DB: { prepare: wrap }, DISCORD_BOT_TOKEN: 't', DISCORD_APPLICATION_ID: '1', DISCORD_PUBLIC_KEY: 'a'.repeat(64), ACCESS_KEY: 'secret-key', ...extra } };
}
const ctx = { waitUntil() {} };
const call = (env, path, init = {}) => worker.fetch(new Request('https://w.test' + path, init), env, ctx);

// Discord 的互動事件要有 Ed25519 簽章：測試時產生一組金鑰，把公鑰設成 DISCORD_PUBLIC_KEY 再簽章
async function signedWebhook(env, event) {
    const { publicKey, privateKey } = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const raw = Buffer.from(await webcrypto.subtle.exportKey('raw', publicKey)).toString('hex');
    const env2 = { ...env, DISCORD_PUBLIC_KEY: raw };
    const body = JSON.stringify(event);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = Buffer.from(await webcrypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode(ts + body))).toString('hex');
    return worker.fetch(new Request('https://w.test/discord/webhook', { method: 'POST', headers: { 'X-Signature-Ed25519': sig, 'X-Signature-Timestamp': ts }, body }), env2, ctx);
}
const slash = (name, userId, options = []) => ({ type: 2, token: 'tok', application_id: '1', channel_id: 'chan1', data: { name, options }, member: { user: { id: userId } } });
const text = async res => (await res.json()).data?.content || '';

// ───── PWA → Worker：存取密鑰 ─────
test('純函式：公開路由、常數時間比較、從標頭／查詢取出密鑰（/backup 的 ?key 是備份金鑰，不算存取密鑰）', () => {
    for (const p of ['/', '/discord/ping', '/keepalive', '/discord/webhook']) assert.equal(H.isPublicRoute(p), true, p);
    for (const p of ['/sync/memories', '/discord/send', '/discord/clear', '/backup', '/setup', '/poll']) assert.equal(H.isPublicRoute(p), false, p);
    assert.equal(H.safeEqual('abc', 'abc'), true);
    assert.equal(H.safeEqual('abc', 'abd'), false);
    assert.equal(H.safeEqual('abc', 'abcd'), false);
    const u = p => new URL('https://w.test' + p);
    const req = (p, headers = {}, method = 'GET') => new Request('https://w.test' + p, { method, headers });
    assert.equal(H.extractAccessKey(req('/sync/x', { Authorization: 'Bearer k1' }), u('/sync/x')), 'k1');
    assert.equal(H.extractAccessKey(req('/sync/x', { 'X-Siios-Key': 'k2' }), u('/sync/x')), 'k2');
    assert.equal(H.extractAccessKey(req('/setup?key=k3'), u('/setup?key=k3')), 'k3');
    assert.equal(H.extractAccessKey(req('/backup?key=BACKUP'), u('/backup?key=BACKUP')), '');
    assert.equal(H.extractAccessKey(req('/discord/send?key=k4', {}, 'POST'), u('/discord/send?key=k4')), '');
});

test('沒有帶密鑰、密鑰錯誤 → 401；密鑰正確才能用（標頭、X-Siios-Key、網址 ?key= 三種）', async () => {
    const { env } = makeEnv();
    for (const path of ['/sync/memories?character_id=x', '/discord/history?channel_id=1', '/backup', '/discord/auth-check']) {
        assert.equal((await call(env, path)).status, 401, path + ' 沒帶密鑰');
        assert.equal((await call(env, path, { headers: { Authorization: 'Bearer wrong' } })).status, 401, path + ' 密鑰錯誤');
    }
    assert.equal((await call(env, '/discord/clear', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await call(env, '/discord/send', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await call(env, '/sync/characters', { method: 'POST', body: '{"characters":[]}' })).status, 401);
    const ok1 = await call(env, '/discord/auth-check', { headers: { Authorization: 'Bearer secret-key' } });
    assert.deepEqual(await ok1.json(), { success: true, authorized: true });
    assert.equal((await call(env, '/discord/auth-check', { headers: { 'X-Siios-Key': 'secret-key' } })).status, 200);
    assert.notEqual((await call(env, '/poll?key=secret-key')).status, 401);
    assert.equal((await call(env, '/poll?key=wrong')).status, 401);
});

test('公開的路由不需要密鑰：狀態頁、ping（只回版本與是否已設定密鑰）、keepalive；OPTIONS 預檢帶 X-Siios-Key', async () => {
    const { env } = makeEnv();
    assert.equal((await call(env, '/')).status, 200);
    const ping = await (await call(env, '/discord/ping')).json();
    assert.equal(ping.success, true);
    assert.equal(ping.access_key_configured, true);
    assert.ok(!JSON.stringify(ping).includes('secret-key'));
    assert.equal((await call(env, '/keepalive')).status, 200);
    const pre = await call(env, '/sync/memories', { method: 'OPTIONS' });
    assert.match(pre.headers.get('Access-Control-Allow-Headers'), /X-Siios-Key/);
});

test('Worker 沒有設定 ACCESS_KEY：所有非公開的介面回 503（預設安全，不會變成開放的）', async () => {
    const { env } = makeEnv({ ACCESS_KEY: undefined });
    const res = await call(env, '/sync/memories?character_id=x', { headers: { Authorization: 'Bearer anything' } });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'access_key_not_set');
    assert.equal((await (await call(env, '/discord/ping')).json()).access_key_configured, false);
});

test('Discord 簽章：沒有設定 DISCORD_PUBLIC_KEY 時不再放行（否則任何人都能偽造事件）', async () => {
    const { env } = makeEnv({ DISCORD_PUBLIC_KEY: undefined });
    const res = await call(env, '/discord/webhook', { method: 'POST', body: JSON.stringify({ type: 1 }) });
    assert.equal(res.status, 401);
    const bad = await call(makeEnv().env, '/discord/webhook', { method: 'POST', headers: { 'X-Signature-Ed25519': 'ab', 'X-Signature-Timestamp': '1' }, body: JSON.stringify({ type: 1 }) });
    assert.equal(bad.status, 401);
});

// ───── Discord 端：/auth ─────
test('/auth：密鑰正確才通過；沒通過的人下其他指令會被擋；通過後可以用', async () => {
    const { env, db } = makeEnv();
    await call(env, '/discord/ping'); // 觸發建表
    assert.match(await text(await signedWebhook(env, slash('config', 'U9'))), /請先用 `\/auth`/);
    assert.match(await text(await signedWebhook(env, slash('auth', 'U9', [{ name: 'key', value: 'wrong' }]))), /不正確/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM authorizedUsers WHERE discord_user_id = 'U9'").get().n, 0);
    assert.match(await text(await signedWebhook(env, slash('auth', 'U9', [{ name: 'key', value: 'secret-key' }]))), /驗證成功/);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM authorizedUsers WHERE discord_user_id = 'U9'").get().n, 1);
    const cfg = await text(await signedWebhook(env, slash('config', 'U9')));
    assert.match(cfg, /目前設定/);
    assert.match(cfg, /AccessKey:\s+已設定/);
    assert.ok(!cfg.includes('secret-key'));
});

test('/auth 連續錯誤 5 次會鎖 15 分鐘，鎖定期間連正確的密鑰也不收', async () => {
    const { env } = makeEnv();
    await call(env, '/discord/ping');
    for (let i = 0; i < 4; i++) assert.match(await text(await signedWebhook(env, slash('auth', 'U8', [{ name: 'key', value: 'x' + i }]))), /不正確/);
    assert.match(await text(await signedWebhook(env, slash('auth', 'U8', [{ name: 'key', value: 'x5' }]))), /15 分鐘/);
    assert.match(await text(await signedWebhook(env, slash('auth', 'U8', [{ name: 'key', value: 'secret-key' }]))), /15 分鐘/);
});

test('沒有設定 ACCESS_KEY 時 /auth 說明原因；其他指令也不能用', async () => {
    const { env } = makeEnv({ ACCESS_KEY: undefined });
    await call(env, '/discord/ping');
    assert.match(await text(await signedWebhook(env, slash('auth', 'U1', [{ name: 'key', value: 'x' }]))), /還沒有設定存取密鑰/);
    assert.match(await text(await signedWebhook(env, slash('config', 'U1'))), /還沒有設定存取密鑰/);
});

test('升級時，已經綁定 Siios 用戶的人自動視為已驗證，不會突然被擋下', async () => {
    const { env, db } = makeEnv();
    db.exec('CREATE TABLE discordUserBindings (discord_user_id TEXT PRIMARY KEY, user_id TEXT, character_id TEXT, user_display_name TEXT, discord_username TEXT)');
    db.prepare("INSERT INTO discordUserBindings (discord_user_id, user_id) VALUES ('OLD1', 'u'), ('', 'x')").run();
    await call(env, '/discord/ping');
    const rows = db.prepare('SELECT discord_user_id FROM authorizedUsers').all().map(r => r.discord_user_id);
    assert.deepEqual(rows, ['OLD1']);
});

test('/auth-reset：只保留自己，其他人要重新驗證', async () => {
    const { env, db } = makeEnv();
    await call(env, '/discord/ping');
    db.prepare("INSERT INTO authorizedUsers VALUES ('A', 'x'), ('B', 'x'), ('C', 'x')").run();
    assert.match(await text(await signedWebhook(env, slash('auth-reset', 'A'))), /已清除其他人/);
    assert.deepEqual(db.prepare('SELECT discord_user_id FROM authorizedUsers').all().map(r => r.discord_user_id), ['A']);
    assert.match(await text(await signedWebhook(env, slash('auth-reset', 'ZZ'))), /請先用 `\/auth`/);
});

test('沒驗證的人傳訊息：機器人不回、不存歷史；私訊會提示一次（每小時最多一次），頻道完全不理', async () => {
    const { env, db } = makeEnv();
    await call(env, '/discord/ping');
    const sent = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => { if (String(url).includes('/messages') && init.method === 'POST') sent.push(JSON.parse(init.body).content); return Response.json({ id: 'm1' }); };
    try {
        const dm = (id, who) => ({ t: 'MESSAGE_CREATE', d: { id, channel_id: 'dm1', content: '嗨', author: { id: who, username: 'x' }, timestamp: new Date().toISOString() } });
        const guild = { t: 'MESSAGE_CREATE', d: { id: 'g1', channel_id: 'chan1', guild_id: 'G', content: '嗨', author: { id: 'STRANGER', username: 'x' }, timestamp: new Date().toISOString() } };
        const r1 = await signedWebhook(env, dm('1', 'STRANGER'));
        assert.equal((await r1.json()).status, 'unauthorized');
        await signedWebhook(env, dm('2', 'STRANGER'));
        await signedWebhook(env, guild);
        assert.equal(sent.length, 1, JSON.stringify(sent));
        assert.match(sent[0], /\/auth/);
        assert.equal(db.prepare('SELECT COUNT(*) n FROM messages').get().n, 0);
    } finally { globalThis.fetch = real; }
});
