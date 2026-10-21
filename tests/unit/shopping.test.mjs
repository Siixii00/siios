import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOPS, SHOP_IDS, KINDS, normalizeKind, resolvePrefs, queryFor, isShopUrl, shopLinks, shopById } from '../../js/core/real-shops.js';
import { buildIdeaMessages, parseIdeas, filterIdeas, formatPriceRange, detectOccasions, planProposals, pruneProposals, describeRecentShopping, FESTIVALS, OCCASIONS, describeGiftMessage, GIFT_REPLY_HINT, giftImportance, giftMemoryText, planReturnGift, isShown } from '../../js/core/gift-ideas.js';

// ───── 平台與連結 ─────
test('平台：使用者要的 10 個都在，每個都是 https 的搜尋連結，關鍵字被正確編碼（不會破壞網址）', () => {
    assert.deepEqual(SHOP_IDS, ['shopee', 'momo', 'pchome', 'books', 'pinkoi', 'amazon', 'taobao', 'pdd', 'xianyu', 'mercari']);
    const tricky = '保溫杯 & 杯套#1 "quote" <b>x</b>?a=b%';
    for (const shop of SHOPS) {
        const url = shop.url(encodeURIComponent(tricky));
        const u = new URL(url);
        assert.equal(u.protocol, 'https:');
        assert.equal(u.hostname, shop.host, shop.id);
        assert.ok(!url.includes('<') && !url.includes('"') && !url.includes(' '), shop.id + ' 沒有編碼乾淨');
        const param = ['keyword', 'q', 'k', 'search_key'].map(k => u.searchParams.get(k)).find(Boolean);
        if (shop.id !== 'books') assert.equal(param, tricky, shop.id + ' 的關鍵字被改掉了');
        else assert.ok(u.pathname.includes(encodeURIComponent(tricky)));
    }
});

test('平台連結檢查：只接受名單裡的網域（擋掉 http、相似網域、userinfo 騙局、javascript:）', () => {
    for (const s of SHOPS) assert.equal(isShopUrl(`https://${s.host}/search?q=x`), true, s.id);
    for (const bad of ['http://shopee.tw/search?keyword=x', 'https://shopee.tw.evil.com/search', 'https://evilshopee.tw/', 'https://shopee.tw@evil.com/', 'javascript:alert(1)', 'https://example.com/?u=https://shopee.tw', '', null, 'data:text/html,hi']) {
        assert.equal(isShopUrl(bad), false, String(bad));
    }
});

test('關鍵字語言：依平台語言挑（繁中／簡中／日文／英文），缺的往別的語言補，最後退回商品名稱', () => {
    const idea = { name: '保溫杯', queries: { zh: '保溫杯 不鏽鋼', cn: '保温杯', ja: '保温マグ', en: 'insulated tumbler' } };
    assert.equal(queryFor(idea, shopById('shopee')), '保溫杯 不鏽鋼');
    assert.equal(queryFor(idea, shopById('taobao')), '保温杯');
    assert.equal(queryFor(idea, shopById('mercari')), '保温マグ');
    assert.equal(queryFor(idea, shopById('amazon')), 'insulated tumbler');
    assert.equal(queryFor({ name: '花束', queries: { zh: '花束' } }, shopById('mercari')), '花束', '沒有日文就用中文');
    assert.equal(queryFor({ name: '花束' }, shopById('amazon')), '花束');
    assert.equal(queryFor({ name: 'x', queries: { zh: 'a\nb\t c' } }, shopById('shopee')), 'a b c', '換行與多餘空白被收乾淨');
});

test('產生連結：預設全部平台；類型相符的排前面；使用者關掉的不出現；順序依使用者設定', () => {
    const book = { name: '小說', kind: 'book', queries: { zh: '小說' } };
    const all = shopLinks(book);
    assert.equal(all.length, 10);
    assert.equal(all[0].id, 'books');
    assert.ok(all[0].fit && all.every(l => isShopUrl(l.url)));
    const prefs = { enabled: ['amazon', 'shopee', 'pinkoi'] };
    assert.deepEqual(shopLinks({ name: '手作皂', kind: 'handmade', queries: { zh: '手作皂' } }, prefs).map(l => l.id), ['pinkoi', 'amazon', 'shopee']);
    assert.deepEqual(shopLinks(book, { enabled: [] }), []);
    assert.deepEqual(resolvePrefs({ enabled: ['shopee', 'nonexistent', 'shopee'] }).enabled, ['shopee']);
    assert.deepEqual(resolvePrefs(null).enabled, SHOP_IDS);
    assert.equal(normalizeKind('book'), 'book');
    assert.equal(normalizeKind('weird'), 'daily');
    assert.ok(KINDS.length >= 12);
});

// ───── 解析 AI 的回覆 ─────
const good = (o = {}) => ({ name: '保溫杯', reason: '你最近老是忘記喝水', message: '這個給你', price_min: 400, price_max: 900, kind: 'daily', queries: { zh: '保溫杯', cn: '保温杯', ja: '保温マグ', en: 'tumbler' }, ...o });

test('解析：容忍前後文字與思考標籤；欄位被限制長度；價格對調；類型不合法時改為生活用品；最多 3 個', () => {
    const text = `<thinking>先想想</thinking>好的，這是我挑的：\n${JSON.stringify([good(), good({ name: '香氛蠟燭', price_min: 900, price_max: 300, kind: '???', reason: '很長'.repeat(100) }), good({ name: '小說', kind: 'book' }), good({ name: '第四個' })])}\n希望你喜歡`;
    const r = parseIdeas(text);
    assert.equal(r.length, 3);
    assert.deepEqual([r[0].priceMin, r[0].priceMax], [400, 900]);
    assert.deepEqual([r[1].priceMin, r[1].priceMax], [300, 900], '最小最大對調');
    assert.equal(r[1].kind, 'daily');
    assert.ok(r[1].reason.length <= 90);
    assert.equal(r[2].kind, 'book');
    assert.ok(r.every(i => i.id && i.queries.zh));
    assert.equal(new Set(r.map(i => i.id)).size, 3);
});

test('解析：壞掉的輸出不會丟錯；沒名字的、重複的略過；缺價格時顯示「請以商店為準」', () => {
    assert.deepEqual(parseIdeas('沒有 JSON'), []);
    assert.deepEqual(parseIdeas('[壞掉的'), []);
    assert.deepEqual(parseIdeas('{"name":"不是陣列"}'), []);
    assert.deepEqual(parseIdeas(null), []);
    const r = parseIdeas(JSON.stringify([good({ name: '' }), good({ name: '保溫杯' }), good({ name: '保溫杯 ' }), good({ name: '襪子', price_min: null, price_max: null })]));
    assert.deepEqual(r.map(i => i.name), ['保溫杯', '襪子']);
    assert.equal(r[1].priceMin, null);
    assert.equal(formatPriceRange(r[1]), '價格請以商店為準');
    assert.equal(formatPriceRange({ priceMin: 400, priceMax: 900 }), '約 $400～$900');
    assert.equal(formatPriceRange({ priceMin: 500, priceMax: 500 }), '約 $500');
});

test('過濾：超出預算太多的、和用戶討厭的事有關的、重複送過的，都會拿掉', () => {
    const mk = (name, lo, hi) => ({ name, priceMin: lo, priceMax: hi, queries: { zh: name } });
    const ideas = [mk('保溫杯', 400, 900), mk('名牌包', 8000, 12000), mk('香菜餅乾', 100, 200), mk('蛋糕', 300, 600), mk('耳機', null, null)];
    const out = filterIdeas(ideas, { budget: { min: 100, max: 1500 }, dislikes: [{ text: '香菜' }], past: ['蛋糕'] });
    assert.deepEqual(out.map(i => i.name), ['保溫杯', '耳機']);
    assert.equal(filterIdeas(ideas, {}).length, 5);
    assert.equal(filterIdeas(null, {}).length, 0);
});

// ───── 提示詞 ─────
test('提示詞：角色、對象、場合、預算、類別、願望清單、已送過的、規則與 JSON 格式都在；系統提示詞放在最前面', () => {
    const m = buildIdeaMessages({ systemPrompt: '（角色設定）', charName: '小雪', userName: '阿明', occasion: 'user_birthday', label: '你的生日', budget: { min: 200, max: 2000 }, kinds: ['書', '食物飲料'], wishlist: [{ name: '降噪耳機' }], past: ['保溫杯'], extra: '最近天氣變冷' });
    assert.equal(m[0].role, 'system');
    assert.ok(m[0].content.startsWith('（角色設定）'));
    for (const need of ['小雪', '阿明', '你的生日', '200～2000', '書、食物飲料', '降噪耳機', '保溫杯', '最近天氣變冷', '現實世界買得到', '不要編造品牌型號', '用戶討厭的事', 'price_min', 'queries', 'zh', 'cn', 'ja', 'en']) assert.ok(m[0].content.includes(need), need);
    assert.equal(m[1].role, 'user');
    assert.ok(!/\n\n\n/.test(m[0].content));
    const plain = buildIdeaMessages({ charName: '小雪' });
    assert.ok(!plain[0].content.includes('願望清單') && !plain[0].content.includes('已經送過'));
    assert.ok(Object.keys(OCCASIONS).includes('return'));
});

// ───── 重要日子 ─────
const D = (y, m, d) => new Date(y, m - 1, d, 10);

test('重要日子：使用者生日（今天、前幾天、一週內都算；太遠或過太久不算；跨年正確）', () => {
    const occ = now => detectOccasions({ now, userBirthday: '1995-10-25' }).filter(o => o.type === 'user_birthday');
    assert.deepEqual(occ(D(2026, 10, 21)).map(o => o.diff), [4]);
    assert.deepEqual(occ(D(2026, 10, 25)).map(o => o.diff), [0]);
    assert.deepEqual(occ(D(2026, 10, 27)).map(o => o.diff), [-2]);
    assert.equal(occ(D(2026, 10, 30)).length, 0, '過了五天不補');
    assert.equal(occ(D(2026, 10, 10)).length, 0, '還有 15 天');
    assert.deepEqual(detectOccasions({ now: D(2026, 12, 30), userBirthday: '1990-01-02' }).filter(o => o.type === 'user_birthday').map(o => [o.diff, o.key]), [[3, 'ubday-2027']]);
    assert.deepEqual(detectOccasions({ now: D(2026, 1, 1), userBirthday: '1990-12-30' }).filter(o => o.type === 'user_birthday').length, 0);
});

test('重要日子：紀念日（填的優先；沒填用第一次聊天；認識不到 25 天不算；100 天與週年）、節日、行事曆裡的生日／紀念', () => {
    const since = D(2025, 7, 1).getTime();
    const a = detectOccasions({ now: D(2026, 6, 28), chatSince: since }).filter(o => o.type === 'anniversary');
    assert.deepEqual(a.map(o => [o.label, o.diff]), [['認識 1 週年', 3]]);
    const hundred = detectOccasions({ now: D(2025, 10, 5), chatSince: since }).filter(o => o.type === 'anniversary');
    assert.equal(hundred.length, 1);
    assert.equal(hundred[0].label, '認識 100 天');
    assert.equal(detectOccasions({ now: D(2025, 7, 10), chatSince: D(2025, 7, 1).getTime() }).filter(o => o.type === 'anniversary').length, 0, '才認識 9 天');
    const own = detectOccasions({ now: D(2026, 3, 8), anniversaryDate: '2024-03-10', chatSince: since }).filter(o => o.type === 'anniversary');
    assert.deepEqual(own.map(o => o.label), ['認識 2 週年'], '使用者填的日期優先，不是第一次聊天');
    const fests = detectOccasions({ now: D(2026, 2, 12) }).filter(o => o.type === 'festival');
    assert.deepEqual(fests.map(o => [o.label, o.diff]), [['情人節', 2]]);
    assert.ok(FESTIVALS.some(f => f.id === '520'));
    const ev = detectOccasions({ now: D(2026, 5, 1), events: [{ id: 1, title: '媽媽生日', date: D(2026, 5, 4).toISOString() }, { id: 2, title: '開會', date: D(2026, 5, 3).toISOString() }, { id: 3, title: '結婚紀念日', date: D(2026, 5, 20).toISOString() }] }).filter(o => o.type === 'event');
    assert.deepEqual(ev.map(o => o.label), ['媽媽生日'], '只看生日、紀念這類標題，而且要在一週內');
});

// ───── 主動提議 ─────
const chars = (freq, extra = {}) => [{ id: 'c1', frequency: freq, chatSince: D(2025, 1, 1).getTime(), ...extra }];

test('主動提議：少＝只有生日與紀念日；普通＝加上節日與行事曆；不主動＝什麼都沒有；卡片 id 穩定、已經有的不重複建立', () => {
    const now = D(2026, 2, 13); // 明天情人節
    const ids = f => planProposals({ now, characters: chars(f), userBirthday: '1990-02-15' }).map(p => p.key);
    assert.deepEqual(ids('off'), []);
    assert.deepEqual(ids('few'), ['ubday-2026']);
    assert.deepEqual(ids('normal').sort(), ['fest-valentine-2026', 'ubday-2026']);
    const first = planProposals({ now, characters: chars('normal'), userBirthday: '1990-02-15' });
    assert.equal(first[0].id, `c1:${first[0].key}`);
    assert.ok(first.every(p => p.status === 'pending' && p.ideas === null));
    const again = planProposals({ now, characters: chars('normal'), userBirthday: '1990-02-15', existing: first });
    assert.deepEqual(again.filter(p => !['care'].includes(p.type)), [], '已經有的不再建立');
});

test('主動提議：每個角色一次最多 2 張、全部最多 4 張；過了兩天以上的日子不補', () => {
    const now = D(2026, 5, 18);
    const many = planProposals({ now, characters: Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, frequency: 'normal', anniversaryDate: '2024-05-19', chatSince: 1 })), userBirthday: '1990-05-20' });
    assert.ok(many.length <= 4);
    assert.ok(Object.values(many.reduce((m, p) => { m[p.characterId] = (m[p.characterId] || 0) + 1; return m; }, {})).every(n => n <= 2));
    assert.deepEqual(planProposals({ now: D(2026, 2, 17), characters: chars('normal') }).filter(p => p.type === 'festival'), [], '情人節過了三天');
});

test('主動提議：「偶爾沒事送」只在「常常」或「普通」頻率、同一週只判斷一次、至少間隔 10 天、同樣的日期永遠同樣的結果', () => {
    let hit = 0, total = 0;
    for (let w = 0; w < 52; w++) {
        const now = new Date(2026, 0, 1 + w * 7, 10);
        const p = planProposals({ now, characters: [{ id: 'cx', frequency: 'many', chatSince: 1 }] }).filter(x => x.type === 'care');
        total++; hit += p.length;
        const q = planProposals({ now, characters: [{ id: 'cx', frequency: 'many', chatSince: 1 }] }).filter(x => x.type === 'care');
        assert.deepEqual(p.map(x => x.id), q.map(x => x.id), '同一天重複判斷結果不變');
    }
    assert.ok(hit > 12 && hit < 40, `常常：52 週裡出現 ${hit} 次`);
    assert.equal(planProposals({ now: D(2026, 3, 3), characters: [{ id: 'cx', frequency: 'few', chatSince: 1 }] }).filter(p => p.type === 'care').length, 0);
    // 10 天內剛有過就不再出現
    const recent = [{ id: 'cx:care-old', characterId: 'cx', type: 'care', createdAt: D(2026, 3, 1).getTime(), status: 'pending' }];
    for (let d = 2; d <= 9; d++) assert.equal(planProposals({ now: D(2026, 3, d), characters: [{ id: 'cx', frequency: 'many', chatSince: 1 }], existing: recent }).filter(p => p.type === 'care').length, 0);
});

test('清理：還沒處理的提議過兩週就丟掉，處理過的留 60 天', () => {
    const now = D(2026, 6, 1).getTime(), day = 86400000;
    const list = [
        { id: 'a', status: 'pending', dueAt: now - 5 * day }, { id: 'b', status: 'pending', dueAt: now - 20 * day },
        { id: 'c', status: 'accepted', resolvedAt: now - 30 * day }, { id: 'd', status: 'declined', resolvedAt: now - 90 * day }, { id: 'e', status: 'ready', dueAt: now - 1 * day }
    ];
    assert.deepEqual(pruneProposals(list, now).map(p => p.id), ['a', 'c', 'e']);
});

// ───── 給 AI 的近況 ─────
test('給 AI 的近況：只有最近 3 天、這個角色、已經決定的事；沒有就是空字串；語氣是背景資訊', () => {
    const now = Date.now(), h = 3600000;
    const rec = [
        { characterId: 'c1', name: '保溫杯', status: 'bought', at: now - 2 * h },
        { characterId: 'c1', name: '玩偶', status: 'declined', reason: '家裡放不下', at: now - 5 * h },
        { characterId: 'c1', name: '舊的', status: 'bought', at: now - 100 * h },
        { characterId: 'c2', name: '別人的', status: 'bought', at: now - h },
        { characterId: 'c1', name: '收下', status: 'accepted', at: now - h }
    ];
    const s = describeRecentShopping(rec, 'c1', now);
    assert.match(s, /背景資訊/);
    assert.match(s, /收下了你挑的「保溫杯」，而且真的去買了/);
    assert.match(s, /「玩偶」，用戶這次不需要（家裡放不下）/);
    assert.match(s, /「收下」（還沒說有沒有買）/);
    assert.ok(!s.includes('舊的') && !s.includes('別人的'));
    assert.equal(describeRecentShopping([], 'c1', now), '');
    assert.equal(describeRecentShopping(rec, 'c3', now), '');
});

test('主動提議：還沒聊過的角色（沒有第一次聊天的時間）不會突然送禮', () => {
    assert.deepEqual(planProposals({ now: D(2026, 2, 13), characters: [{ id: 'new', frequency: 'many' }], userBirthday: '1990-02-15' }), []);
});

// ───── 你送給角色的禮物 ─────
test('送禮：給 AI 的描述帶價值與「花錢買的」；沒價格就只有名稱；提示不誇張、不要立刻說回禮', () => {
    assert.equal(describeGiftMessage({ name: '玫瑰花', price: 50 }), '[禮物：玫瑰花（價值 $50，是用戶花錢買來送你的）]');
    assert.equal(describeGiftMessage({ name: '戒指', price: 1200 }), '[禮物：戒指（價值 $1,200，是用戶花錢買來送你的）]');
    assert.equal(describeGiftMessage({}, '蛋糕'), '[禮物：蛋糕]');
    assert.equal(describeGiftMessage({ name: '舊禮物' }), '[禮物：舊禮物]');
    assert.match(GIFT_REPLY_HINT, /不要過度誇張/);
    assert.match(GIFT_REPLY_HINT, /不要在這時說「我也要回禮」/);
});

test('送禮：記憶的重要度隨價格增加但有上下限；記憶文字帶角色名與禮物名', () => {
    assert.equal(giftImportance(0), 0.35);
    assert.ok(giftImportance(100) > giftImportance(10));
    assert.equal(giftImportance(100000), 0.75);
    assert.equal(giftImportance(undefined), 0.35);
    assert.equal(giftMemoryText('小雪', '玫瑰花', 50), '用戶送了小雪禮物「玫瑰花」（價值 $50）。');
    assert.equal(giftMemoryText('小雪', '信件', 0), '用戶送了小雪禮物「信件」。');
});

test('回禮：不是立刻（1～6 天後才出現）；機率隨價值提高；已經有一份在等就不再排；同樣的亂數結果一樣', () => {
    const now = new Date(2026, 5, 1, 10).getTime(), DAYMS = 86400000;
    const rate = price => { let n = 0; for (let k = 0; k < 400; k++) { let i = 0; const seq = [Math.random(), Math.random()]; if (planReturnGift({ now, characterId: 'c', giftName: 'x', price, rng: () => seq[i++ % 2] })) n++; } return n / 400; };
    const lo = rate(10), mid = rate(50), hi = rate(200);
    assert.ok(lo < mid && mid < hi, `機率應該遞增：${lo} ${mid} ${hi}`);
    assert.ok(lo > 0.2 && lo < 0.45 && hi > 0.8, `${lo} ${hi}`);
    const days = new Set();
    for (let k = 0; k < 300; k++) {
        const p = planReturnGift({ now, characterId: 'c', giftName: '玫瑰花', price: 300, rng: Math.random });
        if (!p) continue;
        const d = Math.round((p.dueAt - now) / DAYMS);
        days.add(d);
        assert.ok(d >= 1 && d <= 6, '回禮要過 1～6 天：' + d);
        assert.equal(p.type, 'return');
        assert.equal(p.showAt, p.dueAt);
        assert.equal(isShown(p, now), false, '送完當下不會出現');
        assert.equal(isShown(p, p.dueAt), true);
        assert.match(p.extra, /用戶前幾天送了你「玫瑰花」/);
    }
    assert.ok(days.size >= 4, '天數有變化');
    const waiting = [{ characterId: 'c', type: 'return', status: 'pending' }];
    assert.equal(planReturnGift({ now, characterId: 'c', giftName: 'x', price: 500, existing: waiting, rng: () => 0 }), null);
    assert.ok(planReturnGift({ now, characterId: 'other', giftName: 'x', price: 500, existing: waiting, rng: () => 0 }), '別的角色不受影響');
    assert.ok(planReturnGift({ now, characterId: 'c', giftName: 'x', price: 500, existing: [{ characterId: 'c', type: 'return', status: 'resolved' }], rng: () => 0 }), '之前的處理完了就可以再排');
    const seq = () => { let i = 0; const v = [0.1, 0.5]; return () => v[i++ % 2]; };
    assert.deepEqual(planReturnGift({ now, characterId: 'c', giftName: 'x', price: 100, rng: seq() }), planReturnGift({ now, characterId: 'c', giftName: 'x', price: 100, rng: seq() }));
});

test('提議何時顯示：重要日子建立就看得到；回禮到時間才出現；處理過的不顯示', () => {
    const now = Date.now();
    assert.equal(isShown({ status: 'pending', showAt: now - 1 }, now), true);
    assert.equal(isShown({ status: 'ready', showAt: now }, now), true);
    assert.equal(isShown({ status: 'pending', showAt: now + 1000 }, now), false);
    assert.equal(isShown({ status: 'resolved', showAt: 0 }, now), false);
    assert.equal(isShown({ status: 'pending', dueAt: now - 5 }, now), true, '舊資料沒有 showAt 就看 dueAt');
});

test('parsePrice：各種價格字串轉數字，不合理的是 null', async () => {
    const { parsePrice } = await import('../../js/core/gift-ideas.js');
    assert.equal(parsePrice('NT$1,280'), 1280);
    assert.equal(parsePrice(450.4), 450);
    assert.equal(parsePrice('$ 99.9'), 100);
    assert.equal(parsePrice('免費'), null);
    assert.equal(parsePrice(0), null);
    assert.equal(parsePrice(null), null);
});

test('pickProduct：挑價格在估價附近、連結正常的商品；沒有就回 null，估價維持不變', async () => {
    const { pickProduct, formatPriceRange } = await import('../../js/core/gift-ideas.js');
    const idea = { name: '馬克杯', priceMin: 300, priceMax: 600 };
    const results = [
        { title: '太便宜', price: 20, link: 'https://a.example/1' },
        { title: '連結怪怪', price: 400, link: 'javascript:alert(1)' },
        { title: '太貴', price: 5000, link: 'https://a.example/2' },
        { title: '剛好的杯子', price: 'NT$480', source: '某商店', link: 'https://shop.example/3' }
    ];
    const p = pickProduct(results, idea);
    assert.equal(p.title, '剛好的杯子');
    assert.equal(p.price, 480);
    assert.equal(p.source, '某商店');
    assert.equal(pickProduct(results.slice(0, 3), idea), null);
    assert.equal(pickProduct(null, idea), null);
    assert.match(formatPriceRange({ ...idea, real: p }), /實際約 \$480（某商店）/);
    assert.match(formatPriceRange(idea), /約 \$300～\$600/);
});

test('年齡限制商品：酒、菸、成人用品會被辨識，酒杯、酒精之類不會', async () => {
    const { isAgeRestricted, ideaIsRestricted } = await import('../../js/core/age-restricted.js');
    for (const t of ['精釀啤酒禮盒', '日本威士忌', '電子菸', '古巴雪茄', '情趣用品', 'single malt whisky', 'craft beer set', 'vape pen']) assert.equal(isAgeRestricted(t), true, t);
    for (const t of ['玻璃酒杯', '開瓶器', '酒精濕巾', '保溫杯', '煙燻鮭魚', '煙火', '酒窩貼紙', '料理酒', '馬克杯', 'wine glass set']) assert.equal(isAgeRestricted(t), false, t);
    assert.equal(ideaIsRestricted({ name: '禮盒', queries: { zh: '清酒 禮盒' } }), true);
    assert.equal(ideaIsRestricted({ name: '馬克杯', queries: { zh: '馬克杯' } }), false);
});

test('filterIdeas / buildIdeaMessages：未成年擋掉限制商品，成年留著；提示詞依年齡不同', async () => {
    const ideas = [{ name: '單一麥芽威士忌', priceMin: 800, priceMax: 1200, queries: {} }, { name: '保溫杯', priceMin: 300, priceMax: 600, queries: {} }];
    assert.deepEqual(filterIdeas(ideas, { adult: false }).map(i => i.name), ['保溫杯']);
    assert.equal(filterIdeas(ideas, { adult: true }).length, 2);
    assert.equal(filterIdeas(ideas).length, 2);
    const minor = buildIdeaMessages({ adult: false })[0].content;
    const adult = buildIdeaMessages({ adult: true })[0].content;
    assert.match(minor, /用戶未成年/);
    assert.match(adult, /用戶已成年/);
    assert.match(buildIdeaMessages({})[0].content, /用戶未成年/); // 沒傳就當未成年（保守）
});
