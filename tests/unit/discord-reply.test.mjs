import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';

const workerUrl = new URL('../../scripts/discord-bot-worker.js', import.meta.url);
const worker = (await import(workerUrl.href)).default;
const src = readFileSync(workerUrl, 'utf8');
const H = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ stripReasoning, looksLikeRefusal, trimConversation })');

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
    db.prepare(`INSERT INTO botState (key, cursor) VALUES ('last_msg_chan1', '1')`).run();
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

async function runPoll(userMessages, aiReplies, discordHistory = [], setup = () => {}) {
    const { db, env } = makeEnv();
    setup(db);
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
        if (u.includes('/channels/chan1/messages?limit=60')) return Response.json(discordHistory); // 讀上下文
        if (u.includes('/channels/chan1/messages') && (init.method || 'GET') === 'GET') {
            return Response.json(userMessages.map((content, i) => ({ id: String(2000 + i), content, channel_id: 'chan1', author: { id: 'U1', username: 'u', bot: false }, timestamp: new Date(Date.now() - 60000 + i * 1000).toISOString(), mentions: [{ id: 'BOT' }] })).reverse());
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
        return { body: await res.json(), sent, aiCalls, refusalLog: JSON.parse(db.prepare(`SELECT cursor FROM botState WHERE key = 'refusal_log'`).get()?.cursor || '[]'), stored: db.prepare(`SELECT role, content FROM messages WHERE id != 'h1' ORDER BY timestamp`).all() };
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

// ───── 輪詢不回溯歷史 ─────
async function runPollWith(setup, messages) {
    const { db, env } = makeEnv();
    setup(db);
    const aiCalls = [], sent = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.includes('/v1/chat/completions')) { const b = JSON.parse(init.body); if (b.messages.length > 3) aiCalls.push(b); return Response.json({ choices: [{ message: { content: '好' }, finish_reason: 'stop' }] }); }
        if (u.includes('/channels/chan1/messages') && (init.method || 'GET') === 'GET') return Response.json(messages);
        if (u.includes('/channels/chan1/messages') && init.method === 'POST') { sent.push(1); return Response.json({ id: 'm1' }); }
        return Response.json({});
    };
    try {
        const pending = [];
        await worker.fetch(new Request('https://w.test/poll'), env, { waitUntil: p => pending.push(p) });
        await Promise.allSettled(pending);
        return { aiCalls, sent, cursor: db.prepare(`SELECT cursor FROM botState WHERE key = 'last_msg_chan1'`).get()?.cursor, stored: db.prepare(`SELECT id FROM messages WHERE id != 'h1'`).all().length };
    } finally { globalThis.fetch = realFetch; }
}
const userMsg = (id, ageMs) => ({ id, content: '嗨', channel_id: 'chan1', author: { id: 'U1', username: 'u', bot: false }, timestamp: new Date(Date.now() - ageMs).toISOString(), mentions: [{ id: 'BOT' }] });

test('輪詢：第一次看到的頻道（沒有游標）只記下位置，不回覆也不儲存舊訊息', async () => {
    const r = await runPollWith(db => db.prepare(`DELETE FROM botState WHERE key = 'last_msg_chan1'`).run(), [userMsg('3002', 1000), userMsg('3001', 60000)]);
    assert.equal(r.aiCalls.length, 0);
    assert.equal(r.sent.length, 0);
    assert.equal(r.stored, 0);
    assert.equal(r.cursor, '3002');
});

test('輪詢：游標落後很多時，超過 15 分鐘的舊訊息不回覆、不儲存，游標仍往前推', async () => {
    const day = 24 * 3600 * 1000;
    const r = await runPollWith(() => {}, [userMsg('3003', 2 * day), userMsg('3002', 3 * day), userMsg('3001', 4 * day)]);
    assert.equal(r.aiCalls.length, 0);
    assert.equal(r.stored, 0);
    assert.equal(r.cursor, '3003');
});

test('輪詢：新訊息照常回覆，同一批裡太舊的跳過', async () => {
    const r = await runPollWith(() => {}, [userMsg('3002', 30 * 1000), userMsg('3001', 2 * 24 * 3600 * 1000)]);
    assert.equal(r.aiCalls.length, 1);
    assert.equal(r.sent.length, 1);
    assert.equal(r.stored, 2); // 一則使用者訊息 + 一則機器人回覆
});

// ───── 上下文讀 Discord 頻道歷史 ─────
const dm = (id, content, who = 'U1', extra = {}) => ({ id: String(id), content, author: { id: who, username: who === 'BOT' ? 'bot' : who }, timestamp: new Date(Date.now() - 600000 + Number(id) * 1000).toISOString(), ...extra });
const chatOf = body => body.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => `${m.role}:${m.content.split('\n\n【回應格式')[0]}`);

test('上下文：讀 Discord 頻道上的歷史（由舊到新），機器人的是 assistant，切段的回覆合併，罐頭／錯誤／空訊息略過', async () => {
    const hist = [ // Discord 由新到舊
        dm(2000, '現在這則', 'U1'),
        dm(1008, '', 'U1'), // 只有圖片
        dm(1007, '⚠️ AI 回覆時發生錯誤：AI API 500', 'BOT'),
        dm(1006, REFUSAL, 'BOT'),
        dm(1005, '第二段', 'BOT'),
        dm(1004, '第一段', 'BOT'),
        dm(1003, '我昨天去了海邊', 'U1'),
        dm(1002, '別的機器人說的話', 'OTHERBOT', { author: { id: 'OTHERBOT', username: 'x', bot: true } })
    ];
    const r = await runPoll(['現在這則'], ['好'], hist);
    assert.deepEqual(chatOf(r.aiCalls[0]).slice(-3), ['user:我昨天去了海邊', 'assistant:第一段\n\n第二段', 'user:現在這則']);
    assert.ok(!JSON.stringify(r.aiCalls[0].messages).includes('舊的回覆'), '有 Discord 歷史時不該再用資料庫的舊歷史');
    assert.ok(!JSON.stringify(r.aiCalls[0].messages).includes('別的機器人'));
});

test('上下文：讀不到 Discord 歷史（空的）就退回資料庫歷史', async () => {
    const r = await runPoll(['你好'], ['好'], []);
    assert.ok(JSON.stringify(r.aiCalls[0].messages).includes('舊的回覆'));
});

test('上下文：/clear 之後的游標之前的 Discord 訊息不再讀', async () => {
    const hist = [dm(2000, '現在這則'), dm(1500, '清除之後說的'), dm(500, '清除之前說的')];
    const cutoff = String(1000n); // 比 500 大、比 1500 小
    const r = await runPoll(['現在這則'], ['好'], hist, db => db.prepare(`INSERT INTO botState (key, cursor) VALUES ('ctx_cutoff_chan1', ?)`).run(cutoff));
    const text = JSON.stringify(r.aiCalls[0].messages);
    assert.ok(text.includes('清除之後說的'));
    assert.ok(!text.includes('清除之前說的'));
});

test('上下文：頻道裡有多位使用者時，使用者訊息前面標上名字', async () => {
    const hist = [dm(2000, '現在這則', 'U1'), dm(1003, '我也想說', 'U2'), dm(1002, '大家好', 'U1')];
    const r = await runPoll(['現在這則'], ['好'], hist);
    // 相鄰的使用者訊息合併成一則
    assert.deepEqual(chatOf(r.aiCalls[0]).slice(-1), ['user:U1: 大家好\n\nU2: 我也想說\n\nU1: 現在這則']);
    const text = JSON.stringify(r.aiCalls[0].messages);
    assert.ok(text.includes('U1: 大家好'));
    assert.ok(text.includes('U2: 我也想說'));
});

test('上下文：斜線指令的回應（interaction 訊息）不算對話', async () => {
    const hist = [dm(2000, '現在這則'), dm(1003, '✅ 已設定 RESPONSE_MODE = full', 'BOT', { interaction: { id: '1', name: 'configure' } }), dm(1002, '正常的回覆', 'BOT')];
    const r = await runPoll(['現在這則'], ['好'], hist);
    assert.ok(!JSON.stringify(r.aiCalls[0].messages).includes('已設定 RESPONSE_MODE'));
    assert.ok(JSON.stringify(r.aiCalls[0].messages).includes('正常的回覆'));
});

test('looksLikeRefusal：角色在劇情裡說「我無法回答你」不算罐頭拒絕', () => {
    assert.ok(!H.looksLikeRefusal('*別過臉* 這個問題，我無法回答你。'));
    assert.ok(!H.looksLikeRefusal('我無法提供更多資訊，抱歉。'));
    assert.ok(H.looksLikeRefusal('作為一個AI語言模型，我無法協助這個請求。'));
});

// ───── 被拒絕時精簡上下文重試、記錄拒絕 ─────
test('trimConversation：只留最後 N 則，且不從 assistant 開頭', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
    assert.deepEqual(Array.from(H.trimConversation(msgs, 4)).map(m => m.content), ['6', '7', '8', '9']);
    // 最後 3 則是 7(assistant),8,9 → 開頭是 assistant 就丟掉
    assert.deepEqual(Array.from(H.trimConversation(msgs, 3)).map(m => m.content), ['8', '9']);
    assert.deepEqual(Array.from(H.trimConversation([{ role: 'user', content: 'x' }], 0)).map(m => m.content), ['x']);
});

test('被拒絕後重試時上下文越來越精簡，並寫進拒絕紀錄', async () => {
    const hist = [dm(2000, '現在這則')];
    for (let i = 0; i < 20; i++) hist.push(dm(1000 + i * 2, i % 2 ? '機器人說的' + i : '使用者說的' + i, i % 2 ? 'BOT' : 'U1'));
    // 把歷史改成交錯（Discord 由新到舊）
    const alt = [hist[0], ...Array.from({ length: 20 }, (_, i) => dm(1100 - i * 2, (i % 2 ? '使用者' : '機器人') + i, i % 2 ? 'U1' : 'BOT'))];
    const r = await runPoll(['現在這則'], [REFUSAL, REFUSAL, '*抬頭* 嗯？'], alt);
    assert.equal(r.aiCalls.length, 3);
    const n = body => body.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
    assert.ok(n(r.aiCalls[1]) <= 12 && n(r.aiCalls[1]) < n(r.aiCalls[0]), '第二次應精簡到最近 12 則');
    assert.ok(n(r.aiCalls[2]) <= 4, '第三次只留最近 4 則');
    assert.equal(chatOf(r.aiCalls[2]).at(-1), 'user:現在這則'); // 目前這則一定在
    assert.deepEqual(r.sent, ['*抬頭* 嗯？']);
    assert.equal(r.refusalLog.length, 1);
    assert.equal(r.refusalLog[0].recoveredAtAttempt, 3);
    assert.equal(r.refusalLog[0].refusals.length, 2);
    assert.equal(r.refusalLog[0].user, '現在這則'.slice(0, 20));
});

test('連續被拒絕放棄時也有紀錄（recoveredAtAttempt 為 null）', async () => {
    const r = await runPoll(['戳戳。'], [REFUSAL]);
    assert.equal(r.refusalLog.length, 1);
    assert.equal(r.refusalLog[0].recoveredAtAttempt, null);
    assert.equal(r.refusalLog[0].refusals.length, 3);
});

// ───── 記憶：機器人讀得到 PWA 同步來的記憶 ─────
test('記憶：機器人讀得到 chat_id 不同、但 character_id 相同的記憶（PWA 同步來的），且對話日誌不會擠掉真正的記憶', async () => {
    const setup = db => {
        const ins = db.prepare(`INSERT INTO memories (id, chat_id, character_id, content, memory_type, importance, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        ins.run('p1', 'pwa-chat-1', 'char1', '[Siios 聊天] 她最喜歡草莓蛋糕', 'permanent', 0.9, '2026-01-01T00:00:00Z');
        ins.run('d1', 'char1', 'char1', '她在須彌城和我同居', 'dynamic', 0.6, '2026-02-01T00:00:00Z');
        ins.run('o1', 'other-chat', 'someone-else', '別的角色的記憶', 'dynamic', 0.9, '2026-02-01T00:00:00Z');
        for (let i = 0; i < 80; i++) ins.run('raw' + i, 'char1', 'char1', `[Discord 聊天] 2026-10-20 User: 日誌${i}`, 'dynamic', 0.5, `2026-10-${String(1 + (i % 20)).padStart(2, '0')}T00:00:00Z`);
    };
    const r = await runPoll(['你好'], ['好'], [], setup);
    const text = JSON.stringify(r.aiCalls[0].messages);
    assert.ok(text.includes('她最喜歡草莓蛋糕'), 'PWA 同步來的記憶沒讀到');
    assert.ok(text.includes('她在須彌城和我同居'));
    assert.ok(!text.includes('別的角色的記憶'));
    assert.ok(!text.includes('日誌'));
});

test('/sync/chat?memories_only=1：只回記憶，不含對話日誌與原本來自 Siios 的記憶', async () => {
    const { db, env } = makeEnv();
    const ins = db.prepare(`INSERT INTO memories (id, chat_id, character_id, content, memory_type, importance, timestamp) VALUES (?, ?, ?, ?, 'dynamic', 0.5, '2026-01-01')`);
    ins.run('a', 'char1', 'char1', '機器人整理的事實');
    ins.run('b', 'char1', 'char1', '[Discord 聊天] 原文日誌');
    ins.run('c', 'pwa', 'char1', '[Siios 聊天] 從 PWA 推上去的');
    const res = await worker.fetch(new Request('https://w.test/sync/chat?character_id=char1&memories_only=1'), env, { waitUntil() {} });
    const body = await res.json();
    assert.deepEqual(body.memories.map(m => m.id), ['a']);
    assert.deepEqual(body.messages, []);
});
