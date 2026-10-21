import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHsl, hslToRgb, parseColor, isAccentLike, mapColor, replaceInValue } from '../../js/core/appearance-colors.js';
import { sanitizeCss, checkBalanced, scopeCss, buildCustomCss, MAX_CSS, SNIPPETS } from '../../js/core/appearance-css.js';

test('顏色轉換：rgb ↔ hsl 來回一致', () => {
    for (const hex of ['#16A34A', '#EC4899', '#3B82F6', '#F97316', '#808080']) {
        const { r, g, b } = hexToRgb(hex); const { h, s, l } = rgbToHsl(r, g, b); const back = hslToRgb(h, s, l);
        assert.ok(Math.abs(back.r - r) <= 1 && Math.abs(back.g - g) <= 1 && Math.abs(back.b - b) <= 1, hex);
    }
    assert.equal(hexToRgb('red'), null);
});

test('parseColor：各種寫法', () => {
    assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseColor('#16A34A'), { r: 22, g: 163, b: 74, a: 1 });
    assert.equal(Math.round(parseColor('#16A34A80').a * 100), 50);
    assert.deepEqual(parseColor('rgba(1, 2, 3, 0.5)'), { r: 1, g: 2, b: 3, a: 0.5 });
    assert.deepEqual(parseColor('rgb(1 2 3 / 25%)'), { r: 1, g: 2, b: 3, a: 0.25 });
    assert.equal(parseColor('hsl(0, 100%, 50%)').r, 255);
    assert.equal(parseColor('not-a-color'), null);
});

test('isAccentLike：灰、太亮、太暗不換；警示紅預設保留', () => {
    assert.equal(isAccentLike({ r: 128, g: 128, b: 128 }), false);
    assert.equal(isAccentLike({ r: 255, g: 255, b: 255 }), false);
    assert.equal(isAccentLike({ r: 10, g: 10, b: 30 }), false);
    assert.equal(isAccentLike({ r: 22, g: 163, b: 74 }), true);
    assert.equal(isAccentLike({ r: 220, g: 38, b: 38 }), false);
    assert.equal(isAccentLike({ r: 220, g: 38, b: 38 }, { keepDanger: false }), true);
});

test('mapColor / replaceInValue：換成目標色相，保留深淺與透明度；不該換的原樣', () => {
    const out = mapColor(parseColor('#6200ea'), '#EC4899');
    const { h } = rgbToHsl(...Object.values(parseColor(out)).slice(0, 3));
    assert.ok(Math.abs(h - 330) < 4, String(h)); // 粉色的色相
    assert.equal(mapColor(parseColor('#888'), '#EC4899'), null);
    assert.match(mapColor(parseColor('rgba(22, 163, 74, 0.4)'), '#3B82F6'), /^rgba\(.*, 0\.4\)$/);
    const v = replaceInValue('1px solid #16a34a', '#EC4899');
    assert.match(v, /^1px solid rgb\(/);
    assert.equal(replaceInValue('1px solid #ccc', '#EC4899'), null);
    assert.equal(replaceInValue('none', '#EC4899'), null);
    const grad = replaceInValue('linear-gradient(90deg, #16a34a, #ffffff)', '#EC4899');
    assert.match(grad, /rgb\(.*\), #ffffff\)$/); // 白色不動
    assert.equal(replaceInValue('#dc2626', '#EC4899'), null); // 警示紅
});

test('sanitizeCss：移除 @import、expression、javascript:，並限制長度', () => {
    const r = sanitizeCss('@import url(https://evil.example/x.css);\n.a { width: expression(alert(1)); background: url(javascript:alert(1)); }');
    assert.doesNotMatch(r.css, /@import|expression|javascript:/i);
    assert.deepEqual(r.removed.sort(), ['@import', 'expression()', 'javascript:'].sort());
    assert.equal(sanitizeCss('a'.repeat(MAX_CSS + 10)).css.length, MAX_CSS);
    assert.equal(sanitizeCss('.a { color: red }').removed.length, 0);
});

test('checkBalanced：括號、註解、引號', () => {
    assert.equal(checkBalanced('.a { color: red; }').ok, true);
    assert.equal(checkBalanced('.a { color: red; ').ok, false);
    assert.equal(checkBalanced('.a { } }').ok, false);
    assert.equal(checkBalanced('/* { */ .a { content: "}" }').ok, true);
    assert.equal(checkBalanced('/* 沒關').ok, false);
});

test('scopeCss：每個選擇器加前綴；html/body 換成範圍本身；@media 遞迴；@keyframes 不動', () => {
    const scope = 'body[data-app="arcade"]';
    const out = scopeCss('.a, .b > .c { color: red }\nbody { background: #000 }\n@media (max-width: 400px) { .d { margin: 0 } }\n@keyframes spin { from { opacity: 0 } to { opacity: 1 } }\n:is(.x, .y) .z { top: 0 }', scope);
    assert.match(out, /body\[data-app="arcade"\] \.a, body\[data-app="arcade"\] \.b > \.c \{ color: red \}/);
    assert.match(out, /^body\[data-app="arcade"\] \{ background: #000 \}/m);
    assert.match(out, /@media \(max-width: 400px\) \{\nbody\[data-app="arcade"\] \.d \{ margin: 0 \}\n\}/);
    assert.match(out, /@keyframes spin \{ from \{ opacity: 0 \} to \{ opacity: 1 \} \}/);
    assert.match(out, /body\[data-app="arcade"\] :is\(\.x, \.y\) \.z/); // 括號裡的逗號不會被切開
    assert.doesNotMatch(scopeCss('/* .hidden { } */ .v { a: b }', scope), /hidden/);
});

test('buildCustomCss：全域原樣、App 加範圍；壞的段落整段略過並回報；不合法的 App 名稱略過', () => {
    const r = buildCustomCss({ customCss: '.g { color: red }', appCss: { arcade: '.a { top: 0 }', broken: '.b { top: 0', 'bad id': '.c{}' } });
    assert.match(r.css, /\.g \{ color: red \}/);
    assert.match(r.css, /body\[data-app="arcade"\] \.a/);
    assert.doesNotMatch(r.css, /\.b \{/); assert.doesNotMatch(r.css, /\.c\{/);
    assert.match(r.errors.broken, /少了/);
    assert.equal(buildCustomCss({}).css, '');
    const imp = buildCustomCss({ customCss: '@import "x.css"; .g{a:b}' });
    assert.match(imp.errors.global, /@import/); assert.match(imp.css, /\.g/);
});

test('範例片語本身都是合法的 CSS', () => {
    for (const s of SNIPPETS) assert.equal(checkBalanced(s.css).ok, true, s.name);
});

test('replaceInValue：Tailwind 的 rgb(r g b / var(--x)) 也能換，透明度變數保留', () => {
    const out = replaceInValue('rgb(168 85 247 / var(--tw-bg-opacity))', '#EC4899');
    assert.match(out, /^rgb\(\d+ \d+ \d+ \/ var\(--tw-bg-opacity\)\)$/);
    assert.notEqual(out, 'rgb(168 85 247 / var(--tw-bg-opacity))');
    assert.equal(replaceInValue('rgb(107 114 128 / var(--tw-text-opacity))', '#EC4899'), null); // 灰色
    assert.equal(replaceInValue('0 1px 2px rgb(0 0 0 / 0.1), 0 0 0 1px #16a34a', '#EC4899').includes('rgb(0 0 0 / 0.1)'), true);
});
