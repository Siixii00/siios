import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalize, migrateLegacy, hueOf, hueShiftFor, effectiveDark, filterChain, inverseChain, buildCss,
    parseRgb, luminance, isDarkBackground, themeColorMeta, BASE_HUE, DEFAULTS, PRESETS
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

test('hueOf / hueShiftFor：預設綠色不偏移，其他顏色偏移到該色相，灰色不偏移', () => {
    assert.equal(hueOf('#FF0000'), 0); assert.equal(hueOf('#00FF00'), 120); assert.equal(hueOf('#0000FF'), 240);
    assert.equal(hueOf('#888888'), BASE_HUE);
    assert.equal(hueShiftFor('#16A34A'), 0);
    assert.equal(hueShiftFor('#888888'), 0);
    for (const p of PRESETS) { const d = hueShiftFor(p.color); assert.ok(d >= -180 && d <= 180, p.id); }
    // 偏移後的主色色相要接近選的顏色
    const shift = hueShiftFor('#3B82F6');
    assert.ok(Math.abs(((BASE_HUE + shift - hueOf('#3B82F6') + 540) % 360) - 180) < 3);
});

test('effectiveDark：自動模式跟著系統', () => {
    assert.equal(effectiveDark({ mode: 'dark' }, false), true);
    assert.equal(effectiveDark({ mode: 'light' }, true), false);
    assert.equal(effectiveDark({ mode: 'auto' }, true), true);
    assert.equal(effectiveDark({ mode: 'auto' }, false), false);
});

test('濾鏡串：預設淺色沒有任何濾鏡；深色有反相；反向濾鏡的順序相反', () => {
    const base = normalize(null);
    assert.deepEqual(filterChain(base, { dark: false }), []);
    assert.deepEqual(inverseChain(base, { dark: false }), []);
    const s = normalize({ color: '#3B82F6', saturation: 120 });
    const f = filterChain(s, { dark: true }), inv = inverseChain(s, { dark: true });
    assert.match(f[0], /^hue-rotate\(/); assert.equal(f[1], 'saturate(1.2)'); assert.equal(f[2], 'invert(1)');
    assert.match(inv.at(-1), /^hue-rotate\(-/);
    assert.equal(inv[0].startsWith('contrast('), true);
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
    assert.match(buildCss({ color: '#EC4899' }), /#app \{ filter: hue-rotate\(/);
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
