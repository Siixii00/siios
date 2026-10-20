import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;
const src = readFileSync(workerUrl, 'utf8');
const H = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ stripReasoning, looksLikeRefusal })');

// ───── 純函式 ─────
test('stripReasoning：世界書 ECoT 的 HTML 註解與 <thinking> 一起去掉', () => {
    const raw = '<!-- Start the ECoT -->\n<thinking>\n[輸入解構] ...\n</thinking>\n<!-- End of The ECoT -->\n\n<!-- 禁詞風險15: 無 -->\n\n*手掌輕輕放在她的頭頂*\n\n好。';
    assert.equal(H.stripReasoning(raw), '*手掌輕輕放在她的頭頂*\n\n好。');
});

test('looksLikeRefusal：認得上游的罐頭拒絕，不誤判正常的角色發言', () => {
    assert.ok(H.looksLikeRefusal('我只是一个语言模型，理解不了这个问题，因此没法帮上忙。'));
    assert.ok(H.looksLikeRefusal("I'm just a language model, I can't help with that."));
    assert.ok(H.looksLikeRefusal('作為一個AI，我無法協助這個請求'));
    assert.ok(!H.looksLikeRefusal('*低頭看著她* 我只是想抱著妳，不行嗎？'));
    assert.ok(!H.looksLikeRefusal('我是你的語言老師。'.repeat(1) + '好'.repeat(200)));
    assert.ok(!H.looksLikeRefusal(''));
});

// ───── 輪詢流程：用記憶體 SQLite 模擬 D1，用假的 fetch 模擬 Discord 與 AI ─────
const SCHEMA = `
CREATE TABLE messages (id TEXT PRIMARY KEY, chat_id TEXT, role TEXT, content TEXT, timestamp TEXT, metadata TEXT);
CREATE TABLE characters (id TEXT PRIMARY KEY, name TEXT, personality TEXT, scenario TEXT, nicknames TEXT);
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, mask TEXT, personality TEXT DEFAULT '', speech_style TEXT DEFAULT '', taboos TEXT DEFAULT '[]');
CREATE TABLE worldInfo (id TEXT PRIMARY KEY, name TEXT, content TEXT, keys TEXT, priority TEXT, enabled INTEGER DEFAULT 1, user_id TEXT, character_id TEXT);
CREATE TABLE globalSettings (id TEXT PRIMARY KEY, name TEXT, content TEXT, keys TEXT, priority TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE globalForbidden (id TEXT PRIMARY KEY, name TEXT, content TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE discordUserBindings (discord_user_id TEXT PRIMARY KEY, user_id TEXT, character_id TEXT, user_display_name TEXT, discord_username TEXT);
CREATE TABLE discord_channel_mappings (channel_id TEXT PRIMARY KEY, character_id TEXT);
CREATE TABLE memories (id TEXT PRIMARY KEY, chat_id TEXT, character_id TEXT, content TEXT, memory_type TEXT DEFAULT 'dynamic', importance REAL DEFAULT 0.5, timestamp TEXT, metadata TEXT);
CREATE TABLE channel_bindings (channel_id TEXT PRIMARY KEY, character_id TEXT, guild_id TEXT, updated_at TEXT);
CREATE TABLE botState (key TEXT PRIMARY KEY, cursor TEXT);
`;

const SECRET_KEY = 'sk-test-SECRET-1234';

function makeEnv() {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA);
    db.prepare(`INSERT INTO characters (id, name, personality) VALUES ('char1', '艾爾', '沉穩')`).run();
    db.prepare(`INSERT INTO channel_bindings (channel_id, character_id) VALUES ('chan1', 'char1')`).run();
    db.prepare(`INSERT INTO botState (key, cursor) VALUES ('bot_user_id', 'BOT')`).run();
    db.prepare(`INSERT INTO botState (key, cursor) VALUES ('commands_registered', '1')`).run();
    const cfg = { AI_API_URL: 'https://ai.test', AI_API_KEY: SECRET_KEY, AI_MODEL: 'm', REACTION_PROBABILITY: '0', INTERJECT_PROBABILITY: '0' };
    for (const [k, v] of Object.entries(cfg)) db.prepare(`INSERT INTO globalSettings (id, name, content, keys, priority, enabled) VALUES (?, ?, ?, '', 'middle', 1)`).run('cfg-' + k, 'bot_config_' + k, v);
    // 歷史裡有一則帶思考過程的舊回覆
    db.prepare(`INSERT INTO messages (id, chat_id, role, content, timestamp) VALUES ('h1', 'char1', 'assistant', ?, '2026-01-01T00:00:00.000Z')`).run('<!-- Start the ECoT -->\n<thinking>舊的思考</thinking>\n<!-- End of The ECoT -->\n\n舊的回覆');
    const wrap = sql => ({
        bind: (...a) => ({ first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }), run: async () => { db.prepare(sql).run(...a); return {}; } }),
        first: async () => db.prepare(sql).get() ?? null, all: async () => ({ results: db.prepare(sql).all() }), run: async () => ({})
    });
    return { db, env: { DB: { prepare: wrap }, DISCORD_BOT_TOKEN: 't', DISCORD_APPLICATION_ID: '1' } };
}

async function runPoll(userMessages, aiReplies) {
    const { db, env } = makeEnv();
    const sent = [], aiCalls = [];
    let reply = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('/v1/chat/completions')) {
            const body = JSON.parse(init.body);
            if (body.messages.length <= 3) return Response.json({ choices: [{ message: { content: '' } }] }); // 記憶萃取、摘要等小呼叫
            aiCalls.push(body);
            const r = aiReplies[Math.min(reply++, aiReplies.length - 1)];
            return Response.json({ choices: [{ message: { content: r }, finish_reason: 'stop' }] });
        }
        if (u.includes('/channels/chan1/messages') && (init.method || 'GET') === 'GET') {
            return Response.json(userMessages.map((content, i) => ({ id: String(2000 + i), content, channel_id: 'chan1', author: { id: 'U1', username: 'u', bot: false }, timestamp: new Date(2026, 9, 20, 0, 0, i).toISOString(), mentions: [{ id: 'BOT' }] })).reverse());
        }
        if (u.includes('/channels/chan1/messages') && init.method === 'POST') {
            const content = JSON.parse(init.body).content;
            sent.push(content);
            return Response.json({ id: 'm' + sent.length, content });
        }
        return Response.json({});
    };
    try {
        const pending = [];
        const res = await worker.fetch(new Request('https://w.test/poll'), env, { waitUntil: p => pending.push(p) });
        await Promise.allSettled(pending);
        return { body: await res.json(), sent, aiCalls, stored: db.prepare(`SELECT role, content FROM messages WHERE id != 'h1' ORDER BY timestamp`).all() };
    } finally { globalThis.fetch = realFetch; }
}

test('輪詢：提示詞不含 bot_config_ 設定列（API 金鑰不能送給模型），舊回覆的思考過程已去掉', async () => {
    const r = await runPoll(['你好'], ['*抬頭* 嗯？']);
    assert.equal(r.aiCalls.length, 1);
    const all = JSON.stringify(r.aiCalls[0].messages);
    assert.ok(!all.includes(SECRET_KEY), 'API 金鑰出現在提示詞裡');
    assert.ok(!all.includes('bot_config_'));
    assert.ok(!all.includes('舊的思考') && !all.includes('ECoT'), '歷史裡舊的思考過程沒去掉');
    assert.ok(all.includes('舊的回覆'));
    assert.deepEqual(r.sent, ['*抬頭* 嗯？']);
});

test('輪詢：回覆裡的 ECoT／thinking 會在送出前去掉，存進歷史的也是乾淨版', async () => {
    const r = await runPoll(['你好'], ['<!-- Start the ECoT -->\n<thinking>想一想</thinking>\n<!-- End of The ECoT -->\n\n好。']);
    assert.deepEqual(r.sent, ['好。']);
    assert.equal(r.stored.find(m => m.role === 'assistant').content, '好。');
});

test('輪詢：模型回拒絕罐頭話時自動重試，只送出重試成功的那一則', async () => {
    const r = await runPoll(['戳戳。'], ['我只是一个语言模型，理解不了这个问题，因此没法帮上忙。', '我只是一个语言模型，理解不了这个问题，因此没法帮上忙。', '*低頭看她* 還不睡？']);
    assert.equal(r.aiCalls.length, 3);
    assert.deepEqual(r.sent, ['*低頭看她* 還不睡？']);
    assert.ok(!r.stored.some(m => /语言模型/.test(m.content)));
});

test('輪詢：連續拒絕時回報錯誤訊息，不存拒絕內容，而且同一輪的下一則訊息照常處理', async () => {
    const refuse = '我只是一个语言模型，理解不了这个问题，因此没法帮上忙。';
    const r = await runPoll(['第一則', '第二則'], [refuse, refuse, refuse, '第二則的回覆']);
    assert.equal(r.aiCalls.length, 4);
    assert.match(r.sent[0], /⚠️ AI 回覆時發生錯誤.*拒絕/);
    assert.equal(r.sent[1], '第二則的回覆');
    assert.ok(!r.stored.some(m => m.role === 'assistant' && /语言模型/.test(m.content)));
    assert.equal(r.body.replied, 1);
});

// ───── /clear 細項：只刪罐頭／錯誤訊息、只刪最近幾則 ─────
const REFUSAL = '我只是一个语言模型，理解不了这个问题，因此没法帮上忙。';
async function runClear(mode, count, { dbRows, discordMsgs }) {
    const { db, env } = makeEnv();
    for (const r of dbRows) db.prepare(`INSERT INTO messages (id, chat_id, role, content, timestamp, metadata) VALUES (?, 'char1', 'assistant', ?, ?, ?)`).run(r.id, r.content, r.ts, JSON.stringify(r.chunk_ids ? { chunk_ids: r.chunk_ids } : {}));
    const deleted = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('/messages?limit=100')) return Response.json(discordMsgs.map(m => ({ ...m, author: { id: m.bot === false ? 'U1' : 'BOT' } })));
        if (u.endsWith('/bulk-delete')) { deleted.push(...JSON.parse(init.body).messages); return new Response(null, { status: 204 }); }
        if (init.method === 'DELETE') { deleted.push(u.split('/').pop()); return new Response(null, { status: 204 }); }
        return Response.json({});
    };
    try {
        const res = await worker.fetch(new Request('https://w.test/discord/clear', { method: 'POST', body: JSON.stringify({ channel_id: 'chan1', mode, count }) }), env, { waitUntil() {} });
        const body = await res.json();
        return { body, deleted: deleted.sort(), left: db.prepare(`SELECT id FROM messages WHERE id != 'h1' ORDER BY timestamp`).all().map(r => r.id) };
    } finally { globalThis.fetch = realFetch; }
}
const snow = ms => String((BigInt(ms - 1420070400000) << 22n) + 1n);
const t0 = Date.now() - 3600 * 1000;

test('/clear canned：只刪罐頭與錯誤訊息，正常回覆與使用者訊息都留著', async () => {
    const [a, b, c, d, e] = [0, 1, 2, 3, 4].map(i => snow(t0 + i * 1000));
    const r = await runClear('canned', undefined, {
        dbRows: [{ id: 'x1', content: REFUSAL, ts: '2026-10-20T01:00:00Z' }, { id: 'x2', content: '*抬頭* 嗯？', ts: '2026-10-20T01:01:00Z' }],
        discordMsgs: [{ id: e, content: '*抬頭* 嗯？' }, { id: d, content: '⚠️ AI 回覆時發生錯誤：AI API 500' }, { id: c, content: '戳戳', bot: false }, { id: b, content: REFUSAL }, { id: a, content: '你好' }]
    });
    assert.ok(r.body.success, JSON.stringify(r.body));
    assert.deepEqual(r.deleted, [b, d].sort());
    assert.deepEqual(r.left, ['x2']);
    assert.match(r.body.result, /罐頭／錯誤/);
});

test('/clear canned：沒有罐頭訊息時不刪任何東西', async () => {
    const r = await runClear('canned', undefined, { dbRows: [{ id: 'x1', content: '正常', ts: '2026-10-20T01:00:00Z' }], discordMsgs: [{ id: snow(t0), content: '正常' }] });
    assert.deepEqual(r.deleted, []);
    assert.deepEqual(r.left, ['x1']);
    assert.match(r.body.result, /沒有找到/);
});

test('/clear last：只刪最近 N 則機器人回覆（含切段與沒有記錄 id 的舊資料）', async () => {
    const [a, b, c, d] = [0, 1, 2, 3].map(i => snow(t0 + i * 1000));
    const r = await runClear('last', 2, {
        dbRows: [
            { id: 'old', content: '最舊的回覆', ts: '2026-10-20T01:00:00Z', chunk_ids: [a] },
            { id: 'mid', content: '舊資料沒有 id', ts: '2026-10-20T01:01:00Z' },
            { id: 'new', content: '最新的第一段第二段', ts: '2026-10-20T01:02:00Z', chunk_ids: [c, d] }
        ],
        discordMsgs: [{ id: d, content: '第二段' }, { id: c, content: '最新的第一段' }, { id: b, content: '舊資料沒有 id' }, { id: a, content: '最舊的回覆' }]
    });
    assert.deepEqual(r.deleted, [b, c, d].sort());
    assert.deepEqual(r.left, ['old']);
});

test('/clear last：不給數量預設只刪一則', async () => {
    const [a, b] = [0, 1].map(i => snow(t0 + i * 1000));
    const r = await runClear('last', undefined, {
        dbRows: [{ id: 'old', content: '舊', ts: '2026-10-20T01:00:00Z', chunk_ids: [a] }, { id: 'new', content: '新', ts: '2026-10-20T01:01:00Z', chunk_ids: [b] }],
        discordMsgs: [{ id: b, content: '新' }, { id: a, content: '舊' }]
    });
    assert.deepEqual(r.deleted, [b]);
    assert.deepEqual(r.left, ['old']);
});
