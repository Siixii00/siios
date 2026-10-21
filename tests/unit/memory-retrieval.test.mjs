import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDb, loadMemorySystem } from './_memory-harness.mjs';

const DAY = 24 * 3600 * 1000;

async function setup(settings = {}) {
    const db = makeFakeDb();
    globalThis.__fakeMemoryDb = db;
    const { MemorySystem } = await loadMemorySystem();
    return { db, ms: new MemorySystem({ embedding: null, ...settings }) };
}
const add = (db, o) => db.MemoryDB.create({ character_id: 'c1', source_app: 'chat', ...o });

test('沒有查詢句時（多數 App 的呼叫）：取這個角色近期、重要的記憶，不是空的', async () => {
    const { db, ms } = await setup();
    await add(db, { content: '舊的小事', importance: 0.3, timestamp: Date.now() - 80 * DAY });
    await add(db, { content: '昨天一起看了電影', importance: 0.6, timestamp: Date.now() - 1 * DAY, source_app: 'youtube' });
    await add(db, { content: '別的角色的記憶', character_id: 'c2' });
    await add(db, { content: '使用者買了蛋糕', character_id: '', shared: true, importance: 0.5, source_app: 'taobao' });
    const r = await ms.retrieveMemories('', null, 5, { character_id: 'c1' });
    const texts = r.map(m => m.content);
    assert.ok(texts.includes('昨天一起看了電影'));
    assert.ok(texts.includes('使用者買了蛋糕'), '共用記憶也要在');
    assert.ok(!texts.includes('別的角色的記憶'));
    assert.ok(texts.indexOf('昨天一起看了電影') < texts.indexOf('舊的小事'), '近期的排在前面');
});

test('沒有查詢句時仍然遵守「記憶設定」：來源沒勾的不取、虛構內容預設不取', async () => {
    const { db, ms } = await setup();
    await add(db, { content: 'YouTube 的記憶', source_app: 'youtube' });
    await add(db, { content: '番茄鐘的記憶', source_app: 'pomodoro' });
    await add(db, { content: '同人小說裡的情節', source_app: 'ao3', is_fiction: true });
    const r = await ms.retrieveMemories('   ', null, 5, { character_id: 'c1', selected_sources: ['youtube'], include_fiction: false });
    assert.deepEqual(r.map(m => m.content), ['YouTube 的記憶']);
});

test('有查詢句時仍以相關性為主（不會被「近期」蓋過）', async () => {
    const { db, ms } = await setup();
    await add(db, { content: '我最喜歡吃草莓蛋糕', importance: 0.6, timestamp: Date.now() - 10 * DAY });
    await add(db, { content: '今天天氣不錯去散步了', importance: 0.6, timestamp: Date.now() });
    const r = await ms.retrieveMemories('草莓蛋糕', null, 5, { character_id: 'c1' });
    assert.deepEqual(r.map(m => m.content), ['我最喜歡吃草莓蛋糕']);
});

test('記憶層級 meta：displayContent 用摘要；full：用完整內容', async () => {
    const { db, ms } = await setup();
    await add(db, { content: '很長的完整內容……', meta_content: '簡短摘要', importance: 0.6 });
    const meta = await ms.retrieveMemories('', null, 5, { character_id: 'c1', memory_level: 'meta' });
    assert.equal(meta[0].displayContent, '簡短摘要');
    const full = await ms.retrieveMemories('', null, 5, { character_id: 'c1', memory_level: 'full' });
    assert.equal(full[0].displayContent, '很長的完整內容……');
});

test('聊天記憶的摘要（meta_content）取訊息前面的文字，不是固定一句沒有資訊的話', async () => {
    const { ms } = await setup();
    const m = await ms.processMessage('我下個月要去京都旅行，想帶你推薦的那本書一起去', 'chat1', 'c1');
    assert.match(m.meta_content, /^我下個月要去京都旅行/);
    const long = await ms.processMessage('很長的訊息'.repeat(30), 'chat1', 'c1');
    assert.ok(long.meta_content.length <= 41 && long.meta_content.endsWith('…'), long.meta_content);
});

// ───── 衰退 ─────
test('睡眠週期：超過 24 小時沒跑過就補跑（手機 PWA 凌晨不會開著），24 小時內不重複', async () => {
    const { db, ms } = await setup();
    await add(db, { content: '舊記憶', importance: 0.3, timestamp: Date.now() - 400 * DAY, created_at: Date.now() - 400 * DAY });
    const now = Date.now();
    assert.equal(await ms.runSleepCycleIfDue({ lastRun: now - 3600 * 1000, now }), null);
    const r = await ms.runSleepCycleIfDue({ lastRun: now - 30 * 3600 * 1000, now });
    assert.equal(r.totalProcessed, 1);
    assert.equal(await ms.runSleepCycleIfDue({ lastRun: null, now }), null, '剛跑過，記在記憶系統自己身上');
    const fresh = (await setup()).ms;
    assert.ok(await fresh.runSleepCycleIfDue({ lastRun: null, now }), '從沒跑過也要跑');
});

test('睡眠週期跑完會通知（App 用來記下上次時間）', async () => {
    const { ms } = await setup();
    let at = null;
    ms.onSleepCycleDone = ts => { at = ts; };
    await ms.runSleepCycle();
    assert.ok(Math.abs(at - Date.now()) < 5000);
});

test('遺忘門檻設定真的生效：低於門檻且不受保護才刪；門檻設得高就刪得多', async () => {
    const make = async threshold => {
        const { db, ms } = await setup({ decayRate: 0.01, forgetThreshold: threshold });
        const old = Date.now() - 100 * DAY;
        await add(db, { content: '一百天前的小事', importance: 0.3, timestamp: old, created_at: old });
        await add(db, { content: '一百天前的重要事', importance: 0.9, timestamp: old, created_at: old });
        await ms.runSleepCycle();
        return (await db.MemoryDB.getAll()).map(m => m.content);
    };
    assert.deepEqual((await make(0.01)).sort(), ['一百天前的小事', '一百天前的重要事']); // 係數約 0.47，高於 0.01
    assert.deepEqual(await make(0.6), ['一百天前的重要事']); // 係數低於 0.6 的刪掉，重要的受保護
});

test('衰減率沒設定時，用和設定頁一樣的預設值 0.01', async () => {
    const { ms } = await setup({});
    assert.equal(ms.decayEngine.decayRate, 0.01);
});
