import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalize, migrateLegacy, colorTarget, effectiveDark, filterChain, inverseChain, buildCss,
    parseRgb, luminance, isDarkBackground, themeColorMeta, DEFAULTS, PRESETS
} from '../../js/core/appearance.js';

test('normalize：壞值回到預設，飽和度限制在範圍內', () => {
    assert.deepEqual(normalize(null), DEFAULTS);
    const s = normalize({ mode: 'neon', color: 'red', font: 'x', size: 'huge', saturation: 9999 });
    assert.equal(s.mode, 'light'); assert.equal(s.color, DEFAULTS.color); assert.equal(s.font, 'system'); assert.equal(s.size, 'medium');
    assert.equal(s.saturation, 160);
    assert.equal(normalize({ saturation: 'abc' }).saturation, 100);
    assert.equal(normalize({ saturation: 10 }).saturation, 50);
});

test('migrateLegacy：舊的主題設定轉成新設定', () => {
    assert.equal(migrateLegacy('dark').mode, 'dark');
    assert.equal(migrateLegacy('pink').color, '#EC4899');
    assert.equal(migrateLegacy('light', 'large').size, 'large');
    assert.deepEqual(migrateLegacy(undefined, undefined), DEFAULTS);
});

test('effectiveDark：自動模式跟著系統', () => {
    assert.equal(effectiveDark({ mode: 'dark' }, false), true);
    assert.equal(effectiveDark({ mode: 'light' }, true), false);
    assert.equal(effectiveDark({ mode: 'auto' }, true), true);
    assert.equal(effectiveDark({ mode: 'auto' }, false), false);
});

test('濾鏡串：預設沒有任何濾鏡；深色有反相；反向濾鏡的順序相反', () => {
    const base = normalize(null);
    assert.deepEqual(filterChain(base, { dark: false }), []);
    assert.deepEqual(inverseChain(base, { dark: false }), []);
    const s = normalize({ saturation: 120 });
    const f = filterChain(s, { dark: true }), inv = inverseChain(s, { dark: true });
    assert.equal(f[0], 'saturate(1.2)'); assert.equal(f[1], 'invert(1)');
    assert.equal(inv[0].startsWith('contrast('), true);
    assert.equal(inv.at(-1), 'saturate(0.833)');
    assert.equal(inv.length, f.length);
});

test('buildCss：預設什麼都不改；深色、字體、大小各自產生規則；彈窗也包含', () => {
    assert.equal(buildCss(null, false), '');
    const dark = buildCss({ mode: 'dark' }, false);
    assert.match(dark, /#app:not\(\[data-sx-native-dark\]\):not\(\[data-sx-wallpaper\]\):not\(:has\(\.lock-screen\)\) \{ filter: invert\(1\)/);
    assert.match(dark, /body > :is\(/);
    assert.match(dark, /img, video, canvas/);
    assert.equal(buildCss({ mode: 'auto' }, true), buildCss({ mode: 'dark' }, false));
    assert.equal(buildCss({ mode: 'auto' }, false), '');
    assert.match(buildCss({ font: 'serif' }), /font-family: "Noto Serif TC"/);
    assert.doesNotMatch(buildCss({ font: 'system' }), /font-family/);
    assert.match(buildCss({ size: 'large' }), /zoom: 1\.1/);
    assert.equal(buildCss({ color: '#EC4899' }), ''); // 主題色不是濾鏡，由樣式表掃描處理
    assert.match(buildCss({ saturation: 120 }), /#app \{ filter: saturate\(1\.2\)/);
});

test('isDarkBackground：多數底色偏暗才算本來就是深色', () => {
    assert.equal(isDarkBackground(['rgb(24, 24, 24)', 'rgb(30, 30, 30)', 'rgb(255, 255, 255)']), true);
    assert.equal(isDarkBackground(['rgb(250, 249, 246)', 'rgb(255, 255, 255)']), false);
    assert.equal(isDarkBackground(['rgba(0, 0, 0, 0)']), false);
    assert.equal(isDarkBackground([]), false);
    assert.deepEqual(parseRgb('rgba(1, 2, 3, 0.5)'), { r: 1, g: 2, b: 3, a: 0.5 });
    assert.ok(luminance(255, 255, 255) > 0.99);
});

test('themeColorMeta', () => {
    assert.equal(themeColorMeta({ mode: 'dark' }, false), '#141414');
    assert.equal(themeColorMeta({ mode: 'light' }, true), '#FAF9F6');
});

test('colorTarget：預設綠色不換，其他顏色回傳目標；normalize 保留自訂 CSS 並清掉壞的 App 名稱', () => {
    assert.equal(colorTarget(normalize(null)), null);
    assert.equal(colorTarget(normalize({ color: '#16a34a' })), null);
    assert.equal(colorTarget(normalize({ color: '#EC4899' })), '#EC4899');
    const s = normalize({ customCss: 'a{b:c}', appCss: { arcade: '.x{}', 'bad name!': 'y{}', empty: '  ' } });
    assert.equal(s.customCss, 'a{b:c}'); assert.deepEqual(Object.keys(s.appCss), ['arcade']);
    assert.equal(s.keepDanger, true); assert.equal(normalize({ keepDanger: false }).keepDanger, false);
});
