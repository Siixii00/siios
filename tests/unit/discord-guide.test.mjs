import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { EXPECTED_WORKER_VERSION, WORKER_CODE_PATH, INVITE_PERMISSIONS, buildInviteUrl, GUIDE_STEPS } from '../../js/apps/settings/discord-guide-data.js';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;

test('PWA 期待的 Worker 版本與 Worker 程式碼裡的 WORKER_VERSION 一致（改 Worker 時兩邊要一起改）', () => {
    const m = /const WORKER_VERSION = '([^']+)'/.exec(readFileSync(workerUrl, 'utf8'));
    assert.ok(m, '找不到 WORKER_VERSION');
    assert.equal(m[1], EXPECTED_WORKER_VERSION);
});

test('教學頁提供下載的 Worker 程式碼檔案存在', () => {
    assert.ok(existsSync(new URL('../../' + WORKER_CODE_PATH, import.meta.url)));
});

test('邀請連結：權限數值與格式正確，Application ID 不是數字時不產生連結', () => {
    assert.equal(INVITE_PERMISSIONS, 76864);
    assert.equal(buildInviteUrl('1234567890123456789'), 'https://discord.com/oauth2/authorize?client_id=1234567890123456789&scope=bot%20applications.commands&permissions=76864');
    assert.equal(buildInviteUrl(' 1234567890123456789 ').includes('client_id=1234567890123456789'), true);
    assert.equal(buildInviteUrl('abc'), '');
    assert.equal(buildInviteUrl(''), '');
});

test('教學步驟：涵蓋必要設定（D1 變數名 DB、三個變數、Cron、setup、webhook、MESSAGE CONTENT INTENT）', () => {
    const all = JSON.stringify(GUIDE_STEPS);
    for (const need of ['MESSAGE CONTENT INTENT', 'DISCORD_BOT_TOKEN', 'DISCORD_APPLICATION_ID', 'DISCORD_PUBLIC_KEY', '*/2 * * * *', '/setup', '/discord/webhook', '"DB"', 'Variable name']) {
        assert.ok(all.includes(need), '教學缺少：' + need);
    }
    assert.equal(GUIDE_STEPS.length, 11); // 0～10
});

// ───── Worker：空的 D1（新使用者）第一次請求會自動建好全部資料表 ─────
function emptyEnv() {
    const db = new DatabaseSync(':memory:');
    const wrap = sql => ({
        bind: (...a) => ({ first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { db.prepare(sql).run(...a); return {}; } }),
        first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => { db.prepare(sql).run(); return {}; }
    });
    return { db, env: { DB: { prepare: wrap }, DISCORD_BOT_TOKEN: 't', DISCORD_APPLICATION_ID: '1' } };
}

test('空資料庫：/discord/ping 會自動建立資料表並回報版本', async () => {
    const { db, env } = emptyEnv();
    const res = await worker.fetch(new Request('https://w.test/discord/ping'), env, { waitUntil() {} });
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.version, EXPECTED_WORKER_VERSION);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all().map(r => r.name).sort();
    for (const t of ['botState', 'channel_bindings', 'characters', 'discordUserBindings', 'discord_channel_mappings', 'globalForbidden', 'globalSettings', 'memories', 'messages', 'users', 'worldInfo']) {
        assert.ok(tables.includes(t), '缺少資料表 ' + t);
    }
    // 重複呼叫不會出錯（資料不受影響）
    db.prepare(`INSERT INTO botState (key, cursor) VALUES ('k', 'v')`).run();
    const again = await worker.fetch(new Request('https://w.test/discord/ping'), env, { waitUntil() {} });
    assert.equal((await again.json()).success, true);
    assert.equal(db.prepare(`SELECT cursor FROM botState WHERE key = 'k'`).get().cursor, 'v');
});

test('空資料庫：同步角色後可以正常寫入與讀回（表結構與程式碼相符）', async () => {
    const { env } = emptyEnv();
    const post = (path, body) => worker.fetch(new Request('https://w.test' + path, { method: 'POST', body: JSON.stringify(body) }), env, { waitUntil() {} });
    const chars = await (await post('/sync/characters', { characters: [{ id: 'c1', name: '艾爾', personality: '沉穩', scenario: '圖書館' }] })).json();
    assert.equal(chars.success, true, JSON.stringify(chars));
    const mem = await (await post('/sync/memories', { memories: [{ id: 'm1', chat_id: 'chat', character_id: 'c1', content: '她喜歡草莓', memory_type: 'permanent', importance: 0.9, timestamp: Date.now() }] })).json();
    assert.equal(mem.success, true, JSON.stringify(mem));
    const got = await (await worker.fetch(new Request('https://w.test/sync/memories?character_id=c1'), env, { waitUntil() {} })).json();
    assert.equal(got.memories.length, 1);
});

test('沒有 DB 綁定時，不需要資料庫的 ping 仍可回應（不會崩潰）', async () => {
    const res = await worker.fetch(new Request('https://w.test/discord/ping'), { DISCORD_BOT_TOKEN: 't' }, { waitUntil() {} });
    assert.equal(res.status, 200); // ensureSchema 沒有 DB 時略過，ping 本身不需要資料庫
});
