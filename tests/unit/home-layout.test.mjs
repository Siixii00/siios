import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLayout, arrange, moveTo, setHidden, setDock, pageCount, isCustomized, MAX_DOCK } from '../../js/core/home-layout.js';

const items = ['a', 'b', 'c', 'd', 'e', 'f'].map(p => ({ path: '/' + p }));
const paths = list => list.map(i => i.path.slice(1)).join('');

test('normalizeLayout：壞資料變成空的，重複與過長的會整理', () => {
    assert.deepEqual(normalizeLayout(null), { order: [], hidden: [], dock: null });
    assert.deepEqual(normalizeLayout({ order: ['/a', '/a', 5, ''], hidden: 'x', dock: ['/a', '/b', '/c', '/d', '/e'] }), { order: ['/a'], hidden: [], dock: ['/a', '/b', '/c', '/d'] });
    assert.equal(normalizeLayout({ dock: 'x' }).dock, null);
});

test('arrange：沒設定時照原順序、Dock 是前 3 個', () => {
    const r = arrange(items, null);
    assert.equal(paths(r.grid), 'abcdef'); assert.equal(paths(r.dock), 'abc'); assert.equal(r.hidden.length, 0);
});

test('arrange：照設定排序，新增的 App 排最後，不見的略過，隱藏的分開放', () => {
    const r = arrange(items, { order: ['/c', '/x', '/a'], hidden: ['/b'] });
    assert.equal(paths(r.grid), 'cadef'); assert.equal(paths(r.hidden), 'b');
    assert.equal(paths(r.dock), 'cad'); // 沒設定 Dock：網格的前 3 個
    assert.equal(paths(arrange(items, { dock: ['/e', '/zzz', '/a'] }).dock), 'ea');
});

test('moveTo：移到指定位置，隱藏的不受影響', () => {
    let l = moveTo(items, null, '/d', 0);
    assert.equal(paths(arrange(items, l).grid), 'dabcef');
    l = moveTo(items, l, '/a', 5);
    assert.equal(paths(arrange(items, l).grid), 'dbcefa');
    l = setHidden(items, l, '/c', true);
    l = moveTo(items, l, '/f', 1);
    const r = arrange(items, l);
    assert.equal(paths(r.grid), 'dfbea'); assert.equal(paths(r.hidden), 'c');
    assert.deepEqual(moveTo(items, l, '/nope', 0), normalizeLayout(l)); // 不存在的路徑：不變
});

test('setHidden：隱藏會移出 Dock；還原放到最後面', () => {
    let l = setDock(items, null, '/a', true); // 展開 Dock：a b c，再加 a（已在）
    l = setHidden(items, l, '/a', true);
    assert.ok(!arrange(items, l).dock.some(i => i.path === '/a'));
    assert.equal(paths(arrange(items, l).hidden), 'a');
    l = setHidden(items, l, '/a', false);
    assert.equal(paths(arrange(items, l).grid), 'bcdefa');
    assert.deepEqual(setHidden(items, null, '/nope', true), normalizeLayout(null));
});

test('setDock：加入、移出、位置、上限；隱藏的 App 不能放進 Dock', () => {
    let l = setDock(items, null, '/e', true);
    assert.equal(paths(arrange(items, l).dock), 'abce');
    l = setDock(items, l, '/f', true); // 滿了：最後一個擠出去
    assert.equal(arrange(items, l).dock.length, MAX_DOCK);
    assert.equal(paths(arrange(items, l).dock), 'abce');
    l = setDock(items, null, '/e', true, 0);
    assert.equal(paths(arrange(items, l).dock), 'eabc'.slice(0, MAX_DOCK));
    l = setDock(items, l, '/a', false);
    assert.equal(paths(arrange(items, l).dock), 'ebc');
    const h = setHidden(items, null, '/d', true);
    assert.equal(paths(arrange(items, setDock(items, h, '/d', true)).dock), 'abc');
});

test('pageCount / isCustomized', () => {
    assert.equal(pageCount(0, 8), 1); assert.equal(pageCount(8, 8), 1); assert.equal(pageCount(9, 8), 2);
    assert.equal(isCustomized(null), false); assert.equal(isCustomized({ hidden: ['/a'] }), true);
});
