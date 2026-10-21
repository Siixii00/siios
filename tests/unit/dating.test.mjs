import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageFor, timeSlot, SCENES, INTERACTIONS, customScene, buildDatePrompt, parseReply, renderNarration,
    emptyRelation, applyAffection, finishDate, localSummary, clampDelta, DAILY_GAIN_CAP } from '../../js/apps/dating/dating-data.js';

test('關係階段由好感度決定，邊界正確', () => {
    assert.equal(stageFor(0).id, 'stranger');
    assert.equal(stageFor(24).id, 'stranger');
    assert.equal(stageFor(25).id, 'friend');
    assert.equal(stageFor(50).id, 'close');
    assert.equal(stageFor(100).id, 'lover');
    assert.equal(stageFor(undefined).id, 'stranger');
    assert.deepEqual(STAGES.map(s => s.min), [...STAGES.map(s => s.min)].sort((a, b) => a - b));
});

test('時段：涵蓋 24 小時，深夜跨過午夜', () => {
    const at = h => timeSlot(new Date(2026, 0, 1, h, 30)).id;
    assert.deepEqual([0, 4, 5, 9, 10, 13, 14, 16, 17, 18, 19, 22, 23].map(at),
        ['late', 'late', 'morning', 'morning', 'noon', 'noon', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night', 'late']);
});

test('場景資料完整：每個場景有活動、小插曲、氛圍，id 不重複，適合時段是合法值', () => {
    const slots = ['morning', 'noon', 'afternoon', 'evening', 'night', 'late'];
    assert.equal(new Set(SCENES.map(s => s.id)).size, SCENES.length);
    for (const s of SCENES) {
        assert.ok(s.atmosphere && s.desc && s.icon.startsWith('fa-'), s.id);
        assert.ok(s.activities.length >= 3 && s.events.length >= 3, s.id);
        assert.equal(new Set(s.activities.map(a => a.id)).size, s.activities.length, s.id + ' 活動 id');
        for (const a of s.activities) assert.ok(a.name && a.text && a.delta >= 0 && a.delta <= 3, s.id + '/' + a.id);
        for (const b of s.best) assert.ok(slots.includes(b), s.id + ' 時段 ' + b);
        assert.ok(s.unlock >= 0 && s.cost >= 0);
        assert.ok(!/[A-Za-z]{6,}/.test(s.atmosphere), s.id + ' 氛圍混入英文：' + s.atmosphere);
    }
    assert.ok(SCENES.some(s => s.unlock === 0), '一開始要有能去的場景');
    assert.ok(SCENES.some(s => s.unlock >= 45), '要有需要培養關係才能去的場景');
});

test('互動依好感度解鎖，由低到高', () => {
    const mins = INTERACTIONS.map(i => i.min);
    assert.deepEqual(mins, [...mins].sort((a, b) => a - b));
    assert.equal(mins[0], 0);
});

test('自訂場景：名稱與描述有長度上限，空白給預設值', () => {
    const c = customScene('  ' + 'x'.repeat(50), 'y'.repeat(500));
    assert.equal(c.name.length, 20);
    assert.equal(c.desc.length, 200);
    assert.equal(customScene('', '').name, '特別的地方');
    assert.ok(c.activities.length >= 3 && c.custom);
});

test('提示詞：場景、時段、關係階段、心情、禮物、規則與結尾標籤都在；開場才有開場指示', () => {
    const scene = SCENES.find(s => s.id === 'beach');
    const p = buildDatePrompt({ charName: '小雪', userName: '阿明', scene, slot: timeSlot(new Date(2026, 0, 1, 18)), affection: 55, mood: '害羞', turns: 0, gift: { name: '玫瑰花', price: 50 } });
    for (const need of ['小雪', '阿明', '海邊', '傍晚', '曖昧', '55/100', '心情：害羞', '開場', '玫瑰花', '<affection>', '<mood>', '不要提到 AI']) assert.ok(p.includes(need), need);
    const later = buildDatePrompt({ charName: '小雪', userName: '', scene, slot: timeSlot(new Date(2026, 0, 1, 18)), affection: 10, turns: 3 });
    assert.ok(!later.includes('開場'));
    assert.ok(!later.includes('剛送了你禮物'));
    assert.ok(later.includes('初識'));
});

test('parseReply：取出好感增減與心情、去掉標籤；數值被限制在範圍內；缺漏時為 null；被截斷的標籤也清掉', () => {
    const r = parseReply('（輕輕笑了）「好啊。」\n<affection>+3</affection>\n<mood>開心</mood>');
    assert.deepEqual(r, { text: '（輕輕笑了）「好啊。」', delta: 3, mood: '開心' });
    assert.equal(parseReply('嗯\n<affection>99</affection>').delta, 8);
    assert.equal(parseReply('嗯\n<affection>-40</affection>').delta, -5);
    const none = parseReply('只有文字');
    assert.deepEqual([none.delta, none.mood, none.text], [null, null, '只有文字']);
    assert.equal(parseReply('結尾被截斷\n<affection>+2</affec').text, '結尾被截斷\n<affection>+2</affec'.replace(/<\/?(affection|mood)>?/gi, '').trim());
    assert.ok(!/<\/?affection/.test(parseReply('好\n<affection>').text));
    assert.equal(clampDelta('abc'), 0);
});

test('renderNarration：跳脫 HTML（模型與使用者的文字都不可信），動作標成旁白', () => {
    const html = renderNarration('（微笑）「你好」<img src=x onerror=alert(1)> *揮手*\n第二行');
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('<span class="dt-act">（微笑）</span>'));
    assert.ok(html.includes('<span class="dt-act">*揮手*</span>'));
    assert.ok(html.includes('<br>第二行'));
});

test('好感度：每天增加有上限、下降不受限；跨日重置；0–100', () => {
    const day1 = new Date(2026, 0, 1, 12), day2 = new Date(2026, 0, 2, 12);
    let rel = { ...emptyRelation(), affection: 20 };
    let gained = 0;
    for (let i = 0; i < 6; i++) { const r = applyAffection(rel, 5, day1); rel = r.relation; gained += r.applied; }
    assert.equal(gained, DAILY_GAIN_CAP);
    assert.equal(rel.affection, 20 + DAILY_GAIN_CAP);
    const capped = applyAffection(rel, 5, day1);
    assert.equal(capped.applied, 0);
    assert.equal(capped.capped, true);
    const drop = applyAffection(rel, -4, day1);
    assert.equal(drop.applied, -4);
    assert.equal(applyAffection(drop.relation, 5, day2).applied, 5, '隔天重新計算');
    assert.equal(applyAffection({ ...emptyRelation(), affection: 2 }, -5, day1).relation.affection, 0);
    assert.equal(applyAffection({ ...emptyRelation(), affection: 99 }, 8, day1).relation.affection, 100);
});

test('約會紀錄：累計次數、最近一次、只留 30 筆、新的在前', () => {
    let rel = emptyRelation();
    for (let i = 0; i < 35; i++) rel = finishDate(rel, { id: 'd' + i, endedAt: 1000 + i, summary: 's' });
    assert.equal(rel.dates, 35);
    assert.equal(rel.history.length, 30);
    assert.equal(rel.history[0].id, 'd34');
    assert.equal(rel.lastDate, 1034);
});

test('本地摘要：依好感變化描述', () => {
    const scene = SCENES[0], slot = timeSlot(new Date(2026, 0, 1, 10));
    assert.match(localSummary({ scene, slot, turns: 5, before: 20, after: 30 }), /咖啡廳約會，聊了 5 輪，氣氛很好/);
    assert.match(localSummary({ scene, slot, turns: 2, before: 20, after: 18 }), /不太順利/);
});
