import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageFor, timeSlot, SCENES, INTERACTIONS, customScene, buildDatePrompt, parseReply, renderNarration,
    emptyRelation, applyAffection, finishDate, localSummary, clampDelta, DAILY_GAIN_CAP,
    relationStage, effAffection, checkUnlock, unlockReq, interactionUnlock, chatStatsFromMessages, estimateAffinity, applyChatEstimate, setRelationship, CHAT_AFFINITY_CAP } from '../../js/apps/dating/dating-data.js';

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
        assert.ok(unlockReq(s.unlock).affection >= 0 && s.cost >= 0);
        assert.ok(!/[A-Za-z]{6,}/.test(s.atmosphere), s.id + ' 氛圍混入英文：' + s.atmosphere);
    }
    assert.ok(SCENES.some(s => unlockReq(s.unlock).affection === 0 && !unlockReq(s.unlock).dates), '一開始要有能去的場景');
    assert.ok(SCENES.some(s => unlockReq(s.unlock).affection >= 45), '要有需要培養關係才能去的場景');
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

// ───── 關係階段與手動指定 ─────
test('訂婚、已婚不會因為好感度高就自動發生；手動指定後成為最低階段，好感下降也不會消失', () => {
    assert.equal(stageFor(100).id, 'lover');
    const married = { ...emptyRelation(), affection: 40, stageFloor: 'married' };
    assert.equal(relationStage(married).id, 'married');
    assert.equal(relationStage({ ...emptyRelation(), affection: 100, stageFloor: 'friend' }).id, 'lover', '好感度算出的階段更高時用較高的');
    assert.equal(effAffection(married), 95, '解鎖用的好感度至少是該階段的門檻');
    assert.equal(effAffection({ affection: 70 }), 70);
});

test('解鎖條件可以同時要求好感度、約會次數、關係階段，並說明還缺什麼', () => {
    const rel = { ...emptyRelation(), affection: 62, dates: 1 };
    const r = checkUnlock({ affection: 60, dates: 3, stage: 'close' }, rel);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['約會 3 次']);
    assert.equal(checkUnlock({ affection: 60, dates: 3, stage: 'close' }, { ...rel, dates: 3 }).ok, true);
    assert.deepEqual(checkUnlock({ affection: 75, stage: 'lover' }, { ...emptyRelation(), affection: 30 }).missing, ['好感度 75', '關係達到「交往中」']);
    assert.equal(checkUnlock(20, { affection: 20 }).ok, true, '數字寫法＝好感度門檻');
    assert.equal(checkUnlock(undefined, emptyRelation()).ok, true);
});

test('手動指定的關係可以直接解鎖該階段的場景與互動（例如已婚的家、訂婚的戒指）', () => {
    const home = SCENES.find(s => s.id === 'newhome'), bridal = SCENES.find(s => s.id === 'bridal');
    const fresh = emptyRelation();
    assert.equal(checkUnlock(home.unlock, fresh).ok, false);
    const married = setRelationship(fresh, { stageId: 'married' });
    assert.equal(checkUnlock(home.unlock, married).ok, true);
    assert.equal(checkUnlock(bridal.unlock, married).ok, true, '手動指定曖昧以上的關係，不必再補約會次數');
    const auto = { ...emptyRelation(), affection: 80 };
    assert.ok(checkUnlock(bridal.unlock, auto).missing.includes('約會 5 次'), '自動判斷的關係仍要累積約會次數');
    assert.equal(checkUnlock(bridal.unlock, setRelationship(fresh, { stageId: 'friend' })).ok, false, '只指定到朋友不會豁免');
    const ring = INTERACTIONS.find(i => i.id === 'ring'), forehead = INTERACTIONS.find(i => i.id === 'forehead');
    assert.equal(checkUnlock(interactionUnlock(ring), setRelationship(fresh, { stageId: 'engaged' })).ok, true);
    assert.equal(checkUnlock(interactionUnlock(ring), setRelationship(fresh, { stageId: 'lover' })).ok, false);
    assert.equal(checkUnlock(interactionUnlock(forehead), setRelationship(fresh, { stageId: 'lover' })).ok, true);
});

test('setRelationship：指定階段會設好感起點並關閉自動；auto 清除指定、依聊天重新評估；說明文字限制長度', () => {
    const r = setRelationship({ ...emptyRelation(), affection: 33 }, { stageId: 'married', note: '從小一起長大，婚後同居'.repeat(50) });
    assert.equal(r.stageFloor, 'married');
    assert.equal(r.autoChat, false);
    assert.equal(r.affection, 97);
    assert.ok(r.note.length <= 300);
    const low = setRelationship({ ...emptyRelation(), affection: 90 }, { stageId: 'stranger' });
    assert.equal(low.stageFloor, null);
    assert.equal(low.affection, 5, '指定較低的階段就是調低');
    const back = setRelationship(r, { stageId: 'auto' }, { userMsgs: 300, activeDays: 40, lastAt: Date.now() });
    assert.equal(back.stageFloor, null);
    assert.equal(back.autoChat, true);
    assert.ok(back.affection >= 97 || back.affection > 40, '回到自動後，好感度只會被往上拉，不會被直接砍掉');
});

// ───── 用聊天室判斷好感度 ─────
const msg = (role, daysAgo, text = '你好呀今天過得好嗎', id) => ({ id, role, content: text, timestamp: Date.now() - daysAgo * 86400000 });

test('聊天統計：只算使用者與角色的訊息、太短的略過、同 id 不重複、統計天數與最後時間', () => {
    const s = chatStatsFromMessages([msg('user', 3, undefined, 'a'), msg('assistant', 3, undefined, 'b'), msg('user', 2, undefined, 'c'), msg('user', 2, undefined, 'c'),
        msg('user', 1, '嗯'), msg('system', 1, '系統訊息'), null]);
    assert.equal(s.userMsgs, 2);
    assert.equal(s.charMsgs, 1);
    assert.equal(s.activeDays, 2);
    assert.ok(s.lastAt > s.firstAt);
    assert.deepEqual(chatStatsFromMessages([]), { userMsgs: 0, charMsgs: 0, activeDays: 0, firstAt: 0, lastAt: 0 });
});

test('聊天評估：聊得多、聊得久分數高但有上限；太少為 0；很久沒聊會扣；單調不減', () => {
    const now = Date.now();
    const at = (userMsgs, activeDays, idle = 0) => estimateAffinity({ userMsgs, activeDays, lastAt: now - idle * 86400000 }, now);
    assert.equal(at(3, 3), 0);
    const levels = [at(10, 2), at(50, 8), at(150, 20), at(400, 60), at(5000, 400)];
    assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
    assert.ok(levels[0] > 0 && levels[0] < 15, String(levels[0]));
    assert.equal(levels.at(-1), CHAT_AFFINITY_CAP);
    assert.ok(at(150, 20, 120) < at(150, 20, 0), '很久沒聊要扣');
    assert.ok(at(150, 20, 200) >= 0);
});

test('套用聊天評估：好感度只往上拉；手動指定（autoChat 關）時不動；會記下評估內容', () => {
    const now = Date.now();
    const stats = { userMsgs: 200, activeDays: 30, lastAt: now };
    const est = estimateAffinity(stats, now);
    const up = applyChatEstimate({ ...emptyRelation(), affection: 10 }, stats, now);
    assert.equal(up.affection, est);
    assert.deepEqual([up.chat.estimate, up.chat.userMsgs, up.chat.activeDays], [est, 200, 30]);
    assert.equal(applyChatEstimate({ ...emptyRelation(), affection: 90 }, stats, now).affection, 90, '不會往下扣');
    const manual = applyChatEstimate({ ...emptyRelation(), affection: 10, autoChat: false }, stats, now);
    assert.equal(manual.affection, 10);
    assert.equal(manual.chat.estimate, est, '仍然記下評估值，讓畫面可以顯示');
});

test('提示詞：使用者指定的階段與補充說明會帶進去（以補充說明為準）', () => {
    const scene = SCENES[0], slot = timeSlot(new Date(2026, 0, 1, 10));
    const married = STAGES.find(s => s.id === 'married');
    const p = buildDatePrompt({ charName: '小雪', userName: '阿明', scene, slot, affection: 60, stage: married, note: '從小一起長大，婚後同居', turns: 2 });
    assert.ok(p.includes('已婚') && p.includes('夫妻') && p.includes('從小一起長大，婚後同居') && p.includes('以此為準'));
    assert.ok(!buildDatePrompt({ charName: '小雪', scene, slot, affection: 60, turns: 2 }).includes('補充說明'));
});
