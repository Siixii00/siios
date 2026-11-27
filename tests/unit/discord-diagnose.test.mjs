// 「診斷記憶管線」：Worker 的 GET /sync/diagnose 回報什麼、PWA 怎麼判斷哪一關沒過。
// Worker 端用真正的程式碼，D1 用記憶體 SQLite；判斷邏輯是純函式，直接餵資料。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { judgeMemoryPipeline } from '../../js/core/discord-diagnose.js';

const worker = (await import(new URL('../../scripts/discord-bot-worker.js', import.meta.url).href)).default;

const CHAN = '111111111111111111'; // 像真的 Discord 頻道 ID
const STRAY = '222222222222222222'; // 沒綁角色的頻道

function makeEnv(extraEnv = {}) {
    const db = new DatabaseSync(':memory:');
    const wrap = sql => ({
        bind: (...a) => ({ first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { db.prepare(sql).run(...a); return {}; } }),
        first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => { db.prepare(sql).run(); return {}; }
    });
    return { db, env: { DB: { prepare: wrap }, DISCORD_BOT_TOKEN: 't', DISCORD_APPLICATION_ID: '1', ACCESS_KEY: 'k', ...extraEnv } };
}

const diagnose = (env, key = 'k') => worker.fetch(new Request('https://w.test/sync/diagnose', { headers: key ? { Authorization: 'Bearer ' + key } : {} }), env, { waitUntil() {} });

// 先打一次 ping 讓 Worker 建好資料表，再塞資料
async function seeded() {
    const { db, env } = makeEnv();
    await worker.fetch(new Request('https://w.test/discord/ping'), env, { waitUntil() {} });
    const cfg = (k, v) => db.prepare(`INSERT INTO globalSettings (id, name, content, keys, priority, enabled) VALUES (?, ?, ?, '', 'middle', 1)`).run('cfg-' + k, 'bot_config_' + k, v);
    cfg('AI_API_URL', 'https://ai.test'); cfg('AI_API_KEY', 'sk-secret-value');
    db.prepare(`INSERT INTO authorizedUsers (discord_user_id, authorized_at) VALUES ('U1', 't'), ('U2', 't')`).run();
    db.prepare(`INSERT INTO channel_bindings (channel_id, character_id, guild_id, updated_at) VALUES (?, 'char1', 'g', 't')`).run(CHAN);
    db.prepare(`INSERT INTO discord_channel_mappings (channel_id, character_id) VALUES ('mapchan', 'char2')`).run();
    const mem = (id, charId, content, type, source, ts) => db.prepare(`INSERT INTO memories (id, chat_id, character_id, content, memory_type, importance, timestamp, metadata) VALUES (?, ?, ?, ?, ?, 0.5, ?, ?)`).run(id, charId, charId, content, type, ts, JSON.stringify({ source, platform: source }));
    mem('m1', 'char1', '使用者喜歡綠茶', 'dynamic', 'discord', '2026-11-01T00:00:00.000Z');
    mem('m2', 'char1', '約好週末看電影', 'plan', 'discord', '2026-11-05T00:00:00.000Z');
    mem('m3', 'char1', '[Siios 聊天] 從 PWA 推上去的', 'dynamic', 'siios', '2026-11-02T00:00:00.000Z');
    mem('m4', 'char1', '原始對話', 'raw', 'discord', '2026-11-06T00:00:00.000Z'); // 不算
    mem('m5', 'char1', '[Discord 聊天] 逐字稿', 'dynamic', 'discord', '2026-11-06T00:00:00.000Z'); // 不算
    mem('dislikes-char1', 'char1', '討厭香菜', 'permanent', 'siios', '2026-11-06T00:00:00.000Z'); // 不算
    mem('m7', STRAY, '存在頻道 ID 底下的記憶', 'dynamic', 'discord', '2026-11-03T00:00:00.000Z');
    const msg = (id, chat, role, source) => db.prepare(`INSERT INTO messages (id, chat_id, role, content, timestamp, metadata) VALUES (?, ?, ?, 'x', '2026-11-05T00:00:00.000Z', ?)`).run(id, chat, role, JSON.stringify({ source }));
    msg('a1', 'char1', 'user', 'discord'); msg('a2', 'char1', 'user', 'discord'); msg('a3', 'char1', 'assistant', 'discord');
    msg('a4', 'char1', 'user', 'siios'); // 不是 Discord 來的，不算
    msg('a5', STRAY, 'user', 'discord');
    return { db, env };
}

// ───── Worker 端 ─────
test('/sync/diagnose 需要存取密鑰（沒帶或帶錯都是 401）', async () => {
    const { env } = await seeded();
    assert.equal((await diagnose(env, '')).status, 401);
    assert.equal((await diagnose(env, 'wrong')).status, 401);
    assert.equal((await diagnose(env)).status, 200);
});

test('/sync/diagnose 回報的數量正確：不算對話日誌、不算討厭的事、不算 PWA 推上去的訊息', async () => {
    const { env } = await seeded();
    const r = await (await diagnose(env)).json();
    assert.equal(r.success, true);
    assert.deepEqual(r.ai_configured, { url: true, key: true });
    assert.equal(r.authorized_users, 2);
    assert.deepEqual(r.bindings.map(b => [b.channel_id, b.character_id, b.via]).sort(), [[CHAN, 'char1', 'bind'], ['mapchan', 'char2', 'mapping']].sort());
    const mem = id => r.memories.find(m => m.character_id === id);
    assert.deepEqual(mem('char1'), { character_id: 'char1', total: 3, discord: 2, last_discord_at: '2026-11-05T00:00:00.000Z' }); // m1 m2 m3
    assert.equal(mem(STRAY).discord, 1);
    const msg = id => r.messages.find(m => m.chat_id === id);
    assert.equal(msg('char1').user_msgs, 2);
    assert.equal(msg('char1').ai_msgs, 1);
    assert.equal(msg(STRAY).user_msgs, 1);
});

test('/sync/diagnose 不洩漏記憶內容與任何金鑰', async () => {
    const { env } = await seeded();
    const text = JSON.stringify(await (await diagnose(env)).json());
    for (const secret of ['sk-secret-value', 'https://ai.test', '使用者喜歡綠茶', '約好週末看電影', 'DISCORD_BOT_TOKEN']) assert.ok(!text.includes(secret), '不應包含：' + secret);
});

test('/sync/diagnose：AI 設定只設一半時，分開回報 url 與 key', async () => {
    const { env } = makeEnv({ AI_API_URL: 'https://ai.test' }); // 只有環境變數的 URL，沒有 key
    const r = await (await diagnose(env)).json();
    assert.deepEqual(r.ai_configured, { url: true, key: false });
    assert.equal(r.authorized_users, 0);
    assert.deepEqual(r.memories, []);
});

// ───── PWA 端的判斷 ─────
const chars = [{ id: 'c1', name: '艾爾', discord_enabled: true, discord_channel_id: CHAN }];
const okReport = (over = {}) => ({ ai_configured: { url: true, key: true }, authorized_users: 1, bindings: [{ channel_id: CHAN, character_id: 'c1', via: 'bind' }], memories: [], messages: [], ...over });
const judge = (report, localChars = chars, localDiscordMemories = 0) => judgeMemoryPipeline({ report, localChars, localDiscordMemories });
const find = (checks, text) => checks.find(c => c.title.includes(text));

test('一切正常：Worker 有 Discord 記憶、本機也拉下來了 → 沒有任何警告或錯誤', () => {
    const checks = judge(okReport({ memories: [{ character_id: 'c1', total: 5, discord: 4, last_discord_at: '2026-11-05T00:00:00.000Z' }], messages: [{ chat_id: 'c1', user_msgs: 9, ai_msgs: 9 }] }), chars, 4);
    assert.deepEqual(checks.filter(c => c.status !== 'ok'), []);
    assert.ok(find(checks, '4 筆 Discord 記憶'));
});

test('Worker 沒設 AI、沒有人通過 /auth → 兩個都是 bad，且排在最前面', () => {
    const checks = judge(okReport({ ai_configured: { url: true, key: false }, authorized_users: 0 }));
    assert.equal(find(checks, '沒有設定 AI').status, 'bad');
    assert.equal(find(checks, '/auth').status, 'bad');
    assert.deepEqual(checks.slice(0, 2).map(c => c.status), ['bad', 'bad']);
});

test('PWA 沒有任何角色啟用 Discord（只填了設定頁的頻道映射不算）→ bad，並說明原因', () => {
    const checks = judge(okReport(), [{ id: 'c1', name: '艾爾', discord_enabled: false, discord_channel_id: '' }]);
    const c = find(checks, '沒有任何角色啟用 Discord');
    assert.equal(c.status, 'bad');
    assert.ok(c.hint.includes('頻道映射'));
});

test('角色在 PWA 啟用了 Discord，但 Worker 沒有它的綁定 → bad；頻道 ID 不一致 → warn', () => {
    assert.equal(find(judge(okReport({ bindings: [] })), '沒有同步到 Worker').status, 'bad');
    const other = judge(okReport({ bindings: [{ channel_id: '999999999999999999', character_id: 'c1', via: 'bind' }] }));
    assert.equal(find(other, '綁的頻道不同').status, 'warn');
});

test('Worker 從沒收到這個頻道的訊息 → bad，提示檢查 /auth 與 MESSAGE CONTENT INTENT', () => {
    const c = find(judge(okReport()), '從沒收到');
    assert.equal(c.status, 'bad');
    assert.ok(c.hint.includes('/auth') && c.hint.includes('MESSAGE CONTENT INTENT'));
});

test('收到訊息但機器人沒回覆過 → warn；有對話但沒記憶 → warn（說明是 AI 沒挑到值得記的事）', () => {
    const noReply = find(judge(okReport({ messages: [{ chat_id: 'c1', user_msgs: 3, ai_msgs: 0 }] })), '沒回覆過');
    assert.equal(noReply.status, 'warn');
    const noMem = find(judge(okReport({ messages: [{ chat_id: 'c1', user_msgs: 3, ai_msgs: 3 }] })), '還沒學到記憶');
    assert.equal(noMem.status, 'warn');
    assert.ok(noMem.hint.includes('值得記'));
});

test('記憶存在頻道 ID 底下（頻道沒綁角色）→ warn，指出頻道與數量', () => {
    const checks = judge(okReport({ memories: [{ character_id: STRAY, total: 2, discord: 2 }], messages: [{ chat_id: STRAY, user_msgs: 3, ai_msgs: 2 }] }));
    const c = find(checks, STRAY);
    assert.equal(c.status, 'warn');
    assert.ok(c.title.includes('5 則訊息') && c.title.includes('2 筆記憶'));
});

test('已經綁在某個本機角色上的頻道 ID，不會被當成「沒綁角色」', () => {
    // 角色 id 剛好是純數字（例如從別處匯入）時，不該被誤判
    const numeric = [{ id: CHAN, name: '數字 id 角色', discord_enabled: true, discord_channel_id: CHAN }];
    const checks = judge(okReport({ bindings: [{ channel_id: CHAN, character_id: CHAN, via: 'bind' }], memories: [{ character_id: CHAN, total: 1, discord: 1 }] }), numeric, 1);
    assert.equal(find(checks, '存在頻道'), undefined);
});

test('Worker 有記憶但本機一筆都還沒拉 → warn，提示按同步', () => {
    const report = okReport({ memories: [{ character_id: 'c1', total: 2, discord: 2, last_discord_at: '2026-11-05T00:00:00.000Z' }], messages: [{ chat_id: 'c1', user_msgs: 1, ai_msgs: 1 }] });
    assert.equal(find(judge(report, chars, 0), '還沒拉下來').status, 'warn');
    assert.equal(find(judge(report, chars, 2), '還沒拉下來'), undefined);
});

test('Worker 真正的回報可以直接餵給判斷：char1 正常、另一個頻道沒綁角色', async () => {
    const { env } = await seeded();
    const report = await (await diagnose(env)).json();
    const checks = judgeMemoryPipeline({
        report,
        localChars: [{ id: 'char1', name: '艾爾', discord_enabled: true, discord_channel_id: CHAN }],
        localDiscordMemories: 2
    });
    assert.equal(find(checks, '2 筆 Discord 記憶').status, 'ok');
    assert.equal(find(checks, STRAY).status, 'warn');
    assert.equal(checks.filter(c => c.status === 'bad').length, 0);
});
