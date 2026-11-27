import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ART, COLS, ROWS, TEA_AT, canPlace, autoPlace, normalize, itemAt, snap, waOf } from '../../js/apps/home/room.js';

const src = readFileSync(new URL('../../js/apps/home/index.js', import.meta.url), 'utf8');

test('宅家：每件家具都有格子尺寸與圖塊，且圖塊落在素材表範圍內', () => {
    const ids = [...src.matchAll(/\{ id: '([a-z]+\d)', name: '[^']*', icon: '[^']*', price:/g)].map(m => m[1]);
    assert.equal(ids.length, 18);
    assert.deepEqual(Object.keys(ART).sort(), [...ids].sort());
    for (const [id, a] of Object.entries(ART)) {
        assert.ok(a.w >= 1 && a.h >= 1 && a.w <= COLS && a.h <= ROWS, id);
        assert.ok(a.tile[0] + a.w <= 27 && a.tile[1] + a.h <= 18, id + ' 超出素材表');
    }
});

test('canPlace：不能超出房間、不能疊在實心家具上，地毯可被踩', () => {
    const placed = { bed: 'bed2', rug: 'rug1', tv: 'tv1' };
    const pos = { bed: { x: 0, y: 0 }, rug: { x: 0, y: 0 }, tv: { x: 3, y: 3 } };
    assert.equal(canPlace(placed, pos, 'bed', COLS - 1, 0), false); // 2 格寬，會超出右邊
    assert.equal(canPlace(placed, pos, 'bed', 0, ROWS), false);
    assert.equal(canPlace(placed, pos, 'tv', 1, 0), false); // 壓到床
    assert.equal(canPlace(placed, pos, 'tv', 2, 0), true);
    assert.equal(canPlace(placed, pos, 'rug', 0, 0), true); // 地毯和床重疊沒關係
    assert.equal(canPlace(placed, pos, 'bed', 0, 0), true); // 床也可以停在地毯上
});

test('autoPlace：一般家具靠上、地毯靠下；舊位置被占就換下一格', () => {
    const placed = { bed: 'bed1', rug: 'rug1' };
    assert.deepEqual(autoPlace(placed, {}, 'bed'), { x: 0, y: 0 });
    assert.deepEqual(autoPlace(placed, {}, 'rug'), { x: 0, y: ROWS - 1 });
    assert.deepEqual(autoPlace({ bed: 'bed1', tv: 'tv1' }, { bed: { x: 0, y: 0 } }, 'tv'), { x: 1, y: 0 });
});

test('normalize：舊存檔沒有位置也能排好；有效位置保留，壞位置重排', () => {
    const placed = { bed: 'bed1', desk: 'desk1' };
    assert.deepEqual(normalize(placed), { bed: { x: 0, y: 0 }, desk: { x: 1, y: 0 } });
    assert.deepEqual(normalize(placed, { bed: { x: 5, y: 3 }, desk: { x: 5, y: 3 } }), { bed: { x: 5, y: 3 }, desk: { x: 0, y: 0 } });
    assert.deepEqual(normalize(placed, { bed: { x: 99, y: 99 }, desk: { x: 4, y: 2 } }).desk, { x: 4, y: 2 });
});

test('normalize：最大的一組家具全放進房間也不會疊在一起', () => {
    const placed = { bed: 'bed3', desk: 'desk2', sofa: 'sofa3', tv: 'tv2', plant: 'pl3', rug: 'rug2', lamp: 'lamp2', shelf: 'shelf1' };
    const pos = normalize(placed);
    for (const slot of Object.keys(placed)) {
        assert.ok(pos[slot], slot);
        assert.ok(canPlace(placed, pos, slot, pos[slot].x, pos[slot].y), slot);
    }
});

test('itemAt：點到實心家具優先，只有地毯才回傳地毯，空地回傳 null', () => {
    const placed = { bed: 'bed1', rug: 'rug2' };
    const pos = { bed: { x: 0, y: 2 }, rug: { x: 0, y: 2 } };
    assert.equal(itemAt(placed, pos, 0, 2), 'bed');
    assert.equal(itemAt(placed, pos, 1, 2), 'rug');
    assert.equal(itemAt(placed, pos, 4, 4), null);
});

test('snap：把家具拉回房間內', () => {
    assert.deepEqual(snap('desk2', 6, -3), { x: COLS - 3, y: 0 });
    assert.deepEqual(snap('tv1', 99, 99), { x: COLS - 1, y: ROWS - 1 });
});

test('和風度：素雅的便宜家具也能解鎖茶室，貴的西式家具分數低', () => {
    assert.equal(waOf({}), 0);
    assert.equal(waOf({ bed: 'bed1', desk: 'desk1' }), 20);
    assert.ok(waOf({ bed: 'bed1', desk: 'desk1', lamp: 'lamp2', rug: 'rug1', plant: 'pl2' }) >= TEA_AT);
    assert.ok(waOf({ bed: 'bed3', desk: 'desk2', sofa: 'sofa3', tv: 'tv2' }) < waOf({ bed: 'bed1', desk: 'desk1' }));
});
