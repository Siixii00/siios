import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImport, parseTranscript, parseSendDate, fillMacros, fillTimes, chunkConversation, readPngText, isPng } from '../../js/core/importers/parse.js';
import { planSend, buildChatRecipeMessages, parseChatRecipe, isSafeRegexSource, parseCharacterResponse, CHAT_SAMPLE_CHARS } from '../../js/core/importers/ai-assist.js';

const enc = s => new TextEncoder().encode(s);
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

// 組一張假 PNG（只有簽名＋tEXt＋IEND；解析器不檢查 CRC）
function fakePng(keyword, value) {
    const chunk = (type, data) => {
        const out = new Uint8Array(12 + data.length);
        new DataView(out.buffer).setUint32(0, data.length);
        out.set(enc(type), 4); out.set(data, 8);
        return out;
    };
    const text = new Uint8Array([...enc(keyword), 0, ...enc(value)]);
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', new Uint8Array(13)), chunk('tEXt', text), chunk('IEND', new Uint8Array(0))];
    const total = parts.reduce((n, p) => n + p.length, 0);
    const all = new Uint8Array(total); let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    return all;
}

const V2_CARD = {
    spec: 'chara_card_v2', spec_version: '2.0',
    data: {
        name: '小薰', description: '{{char}} 是一位咖啡店店員，對 {{user}} 很溫柔。', personality: '溫柔、愛撒嬌',
        scenario: '下雨天的咖啡店', first_mes: '歡迎回來，{{user}}！', mes_example: '<START>\n{{user}}: 早安\n{{char}}: 早安呀',
        system_prompt: '請用繁體中文回覆', tags: ['日常', '咖啡'],
        character_book: { entries: [{ keys: ['咖啡'], content: '店裡的招牌是拿鐵', enabled: true }] }
    }
};

test('Tavern 角色卡 v2（JSON）：欄位對應、巨集替換、對話範例與系統提示附在說明後', () => {
    const r = parseImport({ name: 'xiaoxun.json', text: JSON.stringify(V2_CARD) });
    assert.equal(r.format, 'tavern-card');
    const c = r.characters[0];
    assert.equal(c.name, '小薰');
    assert.ok(c.description.startsWith('小薰 是一位咖啡店店員，對 使用者 很溫柔。'));
    assert.ok(c.description.includes('【對話範例】') && c.description.includes('早安呀') && !c.description.includes('<START>'));
    assert.ok(!c.description.includes('角色補充設定') && !c.description.includes('請用繁體中文回覆')); // 額外指令預設不併入
    assert.equal(c.extra.system_prompt, '請用繁體中文回覆');
    assert.equal(c.origin, 'sillytavern');
    assert.equal(c.first_message, '歡迎回來，使用者！');
    assert.equal(c.personality, '溫柔、愛撒嬌');
    assert.deepEqual(c.tags, ['日常', '咖啡']);
    assert.equal(c.book.entries.length, 1);
});

test('Tavern 角色卡 v1（欄位在最外層）也認得', () => {
    const r = parseImport({ text: JSON.stringify({ name: 'Bob', description: 'a guy', personality: 'calm', scenario: '', first_mes: 'Hi', mes_example: '' }) });
    assert.equal(r.format, 'tavern-card');
    assert.equal(r.characters[0].name, 'Bob');
    assert.equal(r.characters[0].first_message, 'Hi');
});

test('Tavern 角色卡（PNG）：讀出內嵌資料並帶頭像', () => {
    const png = fakePng('chara', b64(JSON.stringify(V2_CARD)));
    assert.equal(isPng(png), true);
    assert.equal(readPngText(png).chara, b64(JSON.stringify(V2_CARD)));
    const r = parseImport({ name: 'card.png', bytes: png });
    assert.equal(r.format, 'tavern-card-png');
    assert.equal(r.characters[0].name, '小薰');
    assert.ok(r.characters[0].avatar.startsWith('data:image/png;base64,'));
});

test('PNG 裡沒有角色卡資料：回報無法辨識而不是丟錯', () => {
    const r = parseImport({ bytes: fakePng('Comment', 'hello') });
    assert.equal(r.format, 'unknown');
    assert.ok(r.warnings.length);
});

test('SillyTavern 聊天（.jsonl）：標頭、角色、時間、系統訊息', () => {
    const lines = [
        { user_name: '阿明', character_name: '小薰', create_date: '2024-06-05' },
        { name: '小薰', is_user: false, is_system: false, send_date: 'June 5, 2024 10:14pm', mes: '晚安，{{user}}' },
        { name: '阿明', is_user: true, send_date: 1717596900000, mes: '晚安' },
        { name: 'System', is_system: true, mes: '系統提示' },
        { name: '小薰', is_user: false, send_date: '2024-06-05 @22h 20m 03s', mes: '' }
    ].map(o => JSON.stringify(o)).join('\n');
    const r = parseImport({ name: 'chat.jsonl', text: lines });
    assert.equal(r.format, 'st-chat');
    const chat = r.chats[0];
    assert.equal(chat.characterName, '小薰');
    assert.equal(chat.userName, '阿明');
    assert.equal(chat.messages.length, 2);
    assert.deepEqual(chat.messages.map(m => m.role), ['assistant', 'user']);
    assert.equal(chat.messages[0].content, '晚安，阿明');
    assert.equal(new Date(chat.messages[0].time).getHours(), 22);
    assert.equal(chat.messages[1].time, 1717596900000);
});

test('parseSendDate：各種格式與無法解析', () => {
    assert.equal(new Date(parseSendDate('2024-06-05 @22h 14m 03s')).getMinutes(), 14);
    assert.equal(new Date(parseSendDate('June 5, 2024 10:14am')).getHours(), 10);
    assert.equal(parseSendDate(1717596900), 1717596900000);
    assert.equal(parseSendDate('不是日期'), null);
    assert.equal(parseSendDate(''), null);
});

test('ChatGPT 匯出：依 current_node 走出目前那條分支，略過 system／tool', () => {
    const conv = [{
        title: '旅行規劃', current_node: 'a3',
        mapping: {
            root: { id: 'root', parent: null, message: null },
            a1: { id: 'a1', parent: 'root', message: { author: { role: 'system' }, content: { parts: ['sys'] }, create_time: 1 } },
            a2: { id: 'a2', parent: 'a1', message: { author: { role: 'user' }, content: { parts: ['去京都要注意什麼？'] }, create_time: 1700000000 } },
            a3: { id: 'a3', parent: 'a2', message: { author: { role: 'assistant' }, content: { parts: ['春天人很多'] }, create_time: 1700000010 } },
            b3: { id: 'b3', parent: 'a2', message: { author: { role: 'assistant' }, content: { parts: ['（另一條分支）'] }, create_time: 1700000020 } }
        }
    }];
    const r = parseImport({ name: 'conversations.json', text: JSON.stringify(conv) });
    assert.equal(r.format, 'chatgpt');
    assert.equal(r.chats[0].title, '旅行規劃');
    assert.deepEqual(r.chats[0].messages.map(m => m.content), ['去京都要注意什麼？', '春天人很多']);
    assert.equal(r.chats[0].messages[0].time, 1700000000000);
});

test('Claude 匯出：human／assistant 對應成 user／assistant', () => {
    const conv = [{ name: '寫程式', chat_messages: [
        { sender: 'human', text: '幫我寫排序', created_at: '2025-01-02T03:04:05Z' },
        { sender: 'assistant', text: '', content: [{ type: 'text', text: '好的，這是快速排序' }], created_at: '2025-01-02T03:04:20Z' }
    ] }];
    const r = parseImport({ text: JSON.stringify(conv) });
    assert.equal(r.format, 'claude');
    assert.deepEqual(r.chats[0].messages.map(m => m.role), ['user', 'assistant']);
    assert.equal(r.chats[0].messages[1].content, '好的，這是快速排序');
});

test('我們自己的備份檔：辨識出來並導向備份還原', () => {
    const r = parseImport({ text: JSON.stringify({ version: 2, data: { chats: [], characters: [] } }) });
    assert.equal(r.format, 'ours');
});

test('純文字對話：「名字：內容」，多行訊息與使用者判斷', () => {
    const text = '我: 今天好累\n小薰: 辛苦了，\n要不要喝杯熱茶？\n我: 好啊\n小薰：我去泡';
    const r = parseImport({ text });
    assert.equal(r.format, 'transcript');
    const chat = r.chats[0];
    assert.equal(chat.userName, '我');
    assert.equal(chat.characterName, '小薰');
    assert.deepEqual(chat.messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
    assert.equal(chat.messages[1].content, '辛苦了，\n要不要喝杯熱茶？');
});

test('認不得的內容：回報 unknown（交給 AI 或手動處理），不會硬湊', () => {
    assert.equal(parseImport({ text: '這只是一段普通的文字，沒有任何對話格式。\n第二行也是。' }).format, 'unknown');
    assert.equal(parseImport({ text: '{"foo": 1}' }).format, 'unknown');
    assert.equal(parseImport({ text: '   ' }).format, 'unknown');
});

test('chunkConversation：依長度與則數切段，超長單則自己切開，保留第一則時間', () => {
    const msgs = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: '訊息' + i, time: 1000 + i }));
    const chunks = chunkConversation(msgs, { charName: '小薰', userName: '阿明', maxMsgs: 10 });
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].time, 1000);
    assert.ok(chunks[0].text.startsWith('阿明：訊息0\n小薰：訊息1'));
    const long = chunkConversation([{ role: 'user', content: 'x'.repeat(2000), time: null }], { maxChars: 800 });
    assert.equal(long.length, 3);
    assert.ok(long.every(c => c.text.length <= 800 + 10));
});

test('fillTimes：沒有時間的訊息補上遞增的時間，順序不會亂', () => {
    const t = fillTimes([{ time: null }, { time: 5000 }, { time: null }, { time: 4000 }], 99999);
    assert.deepEqual(t.map(m => m.time), [4000, 5000, 6000, 6001]);
    for (let i = 1; i < t.length; i++) assert.ok(t[i].time > t[i - 1].time);
    const none = fillTimes([{ time: null }, { time: null }], 10000);
    assert.ok(none[1].time > none[0].time && none[1].time <= 10000);
});

test('fillMacros：{{char}}／{{user}}／<BOT>／<USER>', () => {
    assert.equal(fillMacros('{{char}} 對 {{user}} 說 <BOT>/<USER>', { char: 'A', user: 'B' }), 'A 對 B 說 A/B');
});

// ───── AI 協助 ─────
test('planSend：只送樣本上限內的字，並告知有沒有被截斷', () => {
    const p = planSend('a'.repeat(10000), 'chat');
    assert.equal(p.chars, CHAT_SAMPLE_CHARS);
    assert.equal(p.truncated, true);
    assert.equal(planSend('短', 'chat').truncated, false);
    assert.equal(buildChatRecipeMessages('a'.repeat(10000))[1].content.length < 4000, true);
});

test('parseChatRecipe：合格的規則可以用來切整份對話，並接進 parseImport 的純文字流程', () => {
    const reply = '```json\n{"line_regex":"^\\\\[(.+?)\\\\] (.*)$","user_speakers":["Amy"],"character_name":"Bot"}\n```';
    const recipe = parseChatRecipe(reply);
    assert.ok(recipe);
    assert.deepEqual(recipe.match('[Amy] hello'), { speaker: 'Amy', text: 'hello' });
    const text = '[Amy] hi\n[Bot] hello there\nsecond line\n[Amy] bye\n[Bot] see you';
    assert.equal(parseImport({ text }).format, 'unknown'); // 本機規則認不得 [名字] 格式
    const r = parseTranscript(text, { recipe });         // 套用模型給的規則後就能切
    assert.equal(r.chats.length, 1);
    assert.equal(r.chats[0].userName, 'Amy');
    assert.equal(r.chats[0].characterName, 'Bot');
    assert.deepEqual(r.chats[0].messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
    assert.equal(r.chats[0].messages[1].content, 'hello there\nsecond line');
});

test('isSafeRegexSource：擋掉巢狀量詞、反向參照、過長與壞掉的規則', () => {
    assert.equal(isSafeRegexSource('^(.+?): (.*)$'), true);
    assert.equal(isSafeRegexSource('(a+)+$'), false);
    assert.equal(isSafeRegexSource('(.*)*x'), false);
    assert.equal(isSafeRegexSource('^(a)\\1$'), false);
    assert.equal(isSafeRegexSource('('), false);
    assert.equal(isSafeRegexSource('a'.repeat(300)), false);
    assert.equal(parseChatRecipe('{"line_regex":"^(.+)$","user_speakers":[],"character_name":"x"}'), null); // 只有一個捕獲群組
    assert.equal(parseChatRecipe('不是 JSON'), null);
});

test('parseCharacterResponse：整理成角色欄位；沒有名字就視為失敗', () => {
    const c = parseCharacterResponse('好的：\n{"name":"阿良","description":"鐵匠","personality":"沉默","scenario":"","first_message":"要打什麼？"}');
    assert.equal(c.name, '阿良');
    assert.equal(c.first_message, '要打什麼？');
    assert.equal(parseCharacterResponse('{"name":"","description":"x"}'), null);
});
