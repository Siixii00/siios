import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_STYLES, DEFAULT_STYLE, allowedSizes, normalizePrefs, sizeOf, withSize, withStyle, moveItem } from '../../js/core/widget-layout.js';

const W = [
    { id: 'a', size: 'small', sizes: ['small', 'medium'] },
    { id: 'b', size: 'medium', sizes: ['medium', 'large'] },
    { id: 'c', size: 'large' } // 沒指定 sizes：只有預設尺寸
];

test('預設風格是「紙」，三種風格都存在', () => {
    assert.equal(DEFAULT_STYLE, 'paper');
    assert.deepEqual(WIDGET_STYLES.map(s => s.id), ['paper', 'ink', 'glass']);
});

test('allowedSizes：有指定用指定的，沒指定就只有預設尺寸，不認得的尺寸會被濾掉', () => {
    assert.deepEqual(allowedSizes(W[0]), ['small', 'medium']);
    assert.deepEqual(allowedSizes(W[2]), ['large']);
    assert.deepEqual(allowedSizes({ id: 'x', size: 'small', sizes: ['small', 'huge'] }), ['small']);
});

test('normalizePrefs：沒資料、壞資料都回到預設；不合法的風格與尺寸被丟掉；已移除的小工具不留', () => {
    assert.deepEqual(normalizePrefs(undefined, W), { style: 'paper', sizes: {} });
    assert.deepEqual(normalizePrefs('壞掉', W), { style: 'paper', sizes: {} });
    assert.deepEqual(normalizePrefs({ style: 'neon', sizes: { a: 'huge', b: 'large', c: 'small', gone: 'small' } }, W), { style: 'paper', sizes: { b: 'large' } });
    assert.equal(normalizePrefs({ style: 'ink' }, W).style, 'ink');
});

test('normalizePrefs：和預設尺寸相同的設定不留（資料不會越存越多）', () => {
    assert.deepEqual(normalizePrefs({ sizes: { a: 'small' } }, W).sizes, {});
});

test('sizeOf：有設定用設定，沒有用預設', () => {
    assert.equal(sizeOf({ style: 'paper', sizes: { a: 'medium' } }, W[0]), 'medium');
    assert.equal(sizeOf({ style: 'paper', sizes: {} }, W[0]), 'small');
});

test('withSize：只能選允許的尺寸；選回預設尺寸會把設定拿掉；不改動原本的物件', () => {
    const base = { style: 'paper', sizes: {} };
    const medium = withSize(base, W[0], 'medium');
    assert.deepEqual(medium.sizes, { a: 'medium' });
    assert.deepEqual(base.sizes, {});
    assert.equal(withSize(medium, W[0], 'large'), medium); // 不允許：原樣回傳
    assert.deepEqual(withSize(medium, W[0], 'small').sizes, {});
});

test('withStyle：不認得的風格忽略', () => {
    const base = { style: 'paper', sizes: {} };
    assert.equal(withStyle(base, 'ink').style, 'ink');
    assert.equal(withStyle(base, 'neon'), base);
});

test('moveItem：往前、往後移；超出範圍或沒移動原樣回傳；不改動原陣列', () => {
    const ids = ['a', 'b', 'c', 'd'];
    assert.deepEqual(moveItem(ids, 3, 0), ['d', 'a', 'b', 'c']);
    assert.deepEqual(moveItem(ids, 0, 2), ['b', 'c', 'a', 'd']);
    assert.equal(moveItem(ids, 1, 1), ids);
    assert.equal(moveItem(ids, -1, 2), ids);
    assert.equal(moveItem(ids, 0, 9), ids);
    assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
});
