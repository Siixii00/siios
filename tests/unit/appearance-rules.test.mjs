import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    isSafeSelector, sanitizeRule, sanitizeAppRules, ruleToCss, compileRules, upsertRule,
    sanitizeSticker, sanitizeStickers, stickersFor, stickerStyle, sanitizeImages, MAX_RULES_PER_APP, MAX_STICKERS
} from '../../js/core/appearance-rules.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('isSafeSelector：一般選擇器可以，夾帶規則或 at-rule 不行', () => {
    for (const s of ['.page', 'div.card > span:nth-of-type(2)', 'button[data-id="a"]', '.a, .b', '.中文']) assert.equal(isSafeSelector(s), true, s);
    for (const s of ['.a { color: red }', '.a; b', '@import x', '', '   ', '.a\\9','x'.repeat(400)]) assert.equal(isSafeSelector(s), false, s);
});

test('sanitizeRule：只留合法屬性，值會被檢查與限縮；沒有任何合法屬性就丟掉', () => {
    const r = sanitizeRule({ sel: '.card', props: { color: '#ff0000', bg: 'red', radius: 999, fontSize: 10, bold: true, hide: false, evil: 'x', opacity: 50 } });
    assert.deepEqual(r.props, { color: '#ff0000', radius: 80, fontSize: 50, bold: true, opacity: 50 });
    assert.equal(sanitizeRule({ sel: '.card', props: { bg: 'red' } }), null);
    assert.equal(sanitizeRule({ sel: '.a{}', props: { color: '#fff000' } }), null);
    assert.equal(sanitizeRule(null), null);
    assert.equal(sanitizeRule({ sel: '.a', props: { padding: 0 } }).props.padding, 0); // 0 是合法的值
});

test('ruleToCss / compileRules：加上 App 範圍，全部 !important；圖片只在圖片庫有時才輸出', () => {
    const rule = sanitizeRule({ sel: '.card, .tile', props: { bg: '#112233', bgImage: 'img1', bgFit: 'cover', radius: 12 } });
    const css = ruleToCss(rule, 'body[data-app="x"]', { img1: PNG });
    assert.match(css, /^body\[data-app="x"\] \.card, body\[data-app="x"\] \.tile \{/);
    assert.match(css, /background-color: #112233 !important/);
    assert.ok(css.includes(`background-image: url("${PNG}") !important`));
    assert.ok(css.includes("background-repeat: no-repeat !important"));
    assert.match(css, /border-radius: 12px !important; overflow: hidden !important/);
    assert.doesNotMatch(ruleToCss(rule, 'body', {}), /background-image/);
    const all = compileRules({ a: [rule], b: [sanitizeRule({ sel: 'p', props: { hide: true } })] }, { img1: PNG });
    assert.match(all, /body\[data-app="a"\]/); assert.match(all, /body\[data-app="b"\] p \{ display: none !important; \}/);
    assert.equal(compileRules({}, {}), '');
});

test('sanitizeAppRules：壞的 App 名稱、壞的規則略過，每個 App 有數量上限', () => {
    const many = Array.from({ length: MAX_RULES_PER_APP + 20 }, (_, i) => ({ sel: '.c' + i, props: { bold: true } }));
    const out = sanitizeAppRules({ arcade: many, 'bad name': [{ sel: '.a', props: { bold: true } }], empty: [{ sel: '.a', props: {} }], x: 'no' });
    assert.deepEqual(Object.keys(out), ['arcade']);
    assert.equal(out.arcade.length, MAX_RULES_PER_APP);
});

test('upsertRule：同一個選擇器合併、值為 null/false 會移除屬性、全部移除就刪掉規則', () => {
    let rules = upsertRule([], { sel: '.card' }, { bg: '#ff0000' });
    rules = upsertRule(rules, { sel: '.card' }, { radius: 10 });
    assert.equal(rules.length, 1); assert.deepEqual(rules[0].props, { bg: '#ff0000', radius: 10 });
    rules = upsertRule(rules, { sel: '.other' }, { bold: true });
    assert.equal(rules.length, 2);
    rules = upsertRule(rules, { sel: '.card' }, { bg: null });
    assert.deepEqual(rules[0].props, { radius: 10 });
    rules = upsertRule(rules, { sel: '.other' }, { bold: false });
    assert.equal(rules.length, 1);
    rules = upsertRule(rules, { sel: '.card' }, { radius: null });
    assert.deepEqual(rules, []);
});

test('貼紙：欄位限縮、App 或 * 才算合法、只取該 App 與全域的', () => {
    const s = sanitizeSticker({ app: 'arcade', img: 'i1', x: 500, y: -500, w: 1, rot: 999, opacity: 0 });
    assert.deepEqual([s.x, s.y, s.w, s.rot, s.opacity], [120, -20, 3, 180, 5]);
    assert.equal(sanitizeSticker({ app: 'bad app', img: 'i1' }), null);
    assert.equal(sanitizeSticker({ app: '*', img: 'bad id!' }), null);
    assert.equal(sanitizeSticker({ app: '*', img: 'i1' }).w, 30);
    const list = sanitizeStickers([{ id: 'a', app: 'arcade', img: 'i1' }, { id: 'b', app: '*', img: 'i1' }, { id: 'c', app: 'farm', img: 'i1' }, null]);
    assert.deepEqual(stickersFor(list, 'arcade').map(x => x.id), ['a', 'b']);
    assert.equal(sanitizeStickers(Array.from({ length: MAX_STICKERS + 5 }, () => ({ app: '*', img: 'i' }))).length, MAX_STICKERS);
    assert.match(stickerStyle(s), /left: 120%; top: -20%; width: 3%; opacity: 0\.05; transform: translate\(-50%, -50%\) rotate\(180deg\)/);
});

test('sanitizeImages：只收 data:image，代號要合法', () => {
    const out = sanitizeImages({ ok: PNG, svg: 'data:image/svg+xml;base64,AAAA', http: 'https://x/y.png', 'bad id': PNG, js: 'javascript:alert(1)' });
    assert.deepEqual(Object.keys(out), ['ok']);
});
