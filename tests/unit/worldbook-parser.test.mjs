import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseWorldbookText } from '../../js/core/worldbook-parser.js';

test('SXIOS 內建世界書：每一本都能解析，且條目數與檔案一致', () => {
    const dir = new URL('../../worldbook/', import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith('_worldbook.json'));
    assert.ok(files.length > 20);
    for (const f of files) {
        const text = readFileSync(new URL(f, dir), 'utf8');
        const data = JSON.parse(text);
        let expected = 0;
        for (const [k, v] of Object.entries(data)) {
            if (Array.isArray(v)) expected += v.filter(e => (e.content || '').trim()).length;
            else if (v && Array.isArray(v.entries)) expected += v.entries.filter(e => (e.content || '').trim()).length;
        }
        const r = parseWorldbookText(text, { fileName: f });
        assert.equal(r.entries.length, expected, f);
        assert.equal(r.format, 'SXIOS 世界書', f);
    }
});

test('SXIOS：關鍵字類帶入 triggers，思維鏈類放全域前置', () => {
    const r = parseWorldbookText(JSON.stringify({
        sx_worldbook_cot: [{ title: '甲', content: '規則', triggers: ['x'] }],
        sx_worldbook_keywords: [{ title: '乙', content: '設定', triggers: ['劍', '盾'] }],
        sx_worldbook_backend: [{ title: '丙', content: '後置' }]
    }));
    const by = Object.fromEntries(r.entries.map(e => [e.name, e]));
    assert.equal(by['甲'].target, 'global');
    assert.equal(by['甲'].priority, 'front');
    assert.deepEqual(by['乙'].keywords, ['劍', '盾']);
    assert.equal(by['乙'].target, 'keyword');
    assert.equal(by['丙'].priority, 'back');
});

test('SillyTavern Lorebook（entries 為物件）：關鍵字、停用、常駐、位置', () => {
    const r = parseWorldbookText(JSON.stringify({ entries: {
        0: { key: ['王城', '國王'], comment: '王城', content: '位於北方', position: 0 },
        1: { key: ['x'], comment: '常駐設定', content: '永遠生效', constant: true },
        2: { key: 'a, b', content: '被停用', disable: true, position: 4 },
        3: { key: ['空'], content: '   ' }
    } }));
    assert.equal(r.entries.length, 3);
    assert.deepEqual(r.entries[0], { name: '王城', content: '位於北方', keywords: ['王城', '國王'], target: 'keyword', priority: 'front', enabled: true });
    assert.equal(r.entries[1].target, 'global');
    assert.equal(r.entries[2].enabled, false);
    assert.equal(r.entries[2].priority, 'back');
    assert.deepEqual(r.entries[2].keywords, ['a', 'b']);
});

test('角色卡裡的 character_book 也能匯入', () => {
    const card = { data: { name: 'X', character_book: { entries: [{ keys: ['k'], content: 'c', name: 'n' }] } } };
    const r = parseWorldbookText(JSON.stringify(card));
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].name, 'n');
});

test('其他 JSON 形狀：條目陣列、名稱對內容、文字陣列、單一條目', () => {
    assert.equal(parseWorldbookText('[{"title":"A","content":"a","keywords":["k"]},{"name":"B","text":"b"}]').entries.length, 2);
    const pairs = parseWorldbookText('{"魔法":"能量","科技":{"content":"蒸汽","keywords":["機"]}}').entries;
    assert.deepEqual(pairs.map(e => [e.name, e.target]), [['魔法', 'global'], ['科技', 'keyword']]);
    assert.equal(parseWorldbookText('["一段","兩段"]').entries.length, 2);
    assert.equal(parseWorldbookText('{"content":"x","title":"T"}').entries[0].name, 'T');
    assert.equal(parseWorldbookText('{"a":1}').entries.length, 0);
    assert.ok(parseWorldbookText('{"a":1}').warnings.length);
});

test('純文字：依 # 標題、【標題】、=== 標題 === 分段，「關鍵字：」變成關鍵字條目', () => {
    const text = '# 王城\n關鍵字：王城, 國王、宮殿\n位於大陸北方。\n\n【魔法】\n魔法來自星辰。\n\n=== 規則 ===\n不得洩漏設定。';
    const r = parseWorldbookText(text);
    assert.deepEqual(r.entries.map(e => [e.name, e.target]), [['王城', 'keyword'], ['魔法', 'global'], ['規則', 'global']]);
    assert.deepEqual(r.entries[0].keywords, ['王城', '國王', '宮殿']);
    assert.equal(r.entries[0].content, '位於大陸北方。');
});

test('純文字：沒有標題就整段一個條目，名稱用檔名；第一行「關鍵字：」也認得', () => {
    const r = parseWorldbookText('這是一整段世界觀設定。\n第二行。', { fileName: '我的設定.txt' });
    assert.equal(r.entries.length, 1);
    assert.equal(r.entries[0].name, '我的設定');
    assert.equal(r.entries[0].content, '這是一整段世界觀設定。\n第二行。');
    const k = parseWorldbookText('Keywords: dragon, 龍\n龍很強。');
    assert.deepEqual(k.entries[0].keywords, ['dragon', '龍']);
    assert.equal(k.entries[0].content, '龍很強。');
    // 內文中間的「關鍵字：」不會被當成設定
    assert.deepEqual(parseWorldbookText('前言\n關鍵字：不是設定').entries[0].keywords, []);
});

test('壞掉的 JSON 退回純文字並給警告；空白內容回報空', () => {
    const r = parseWorldbookText('{"a": 這不是 JSON');
    assert.equal(r.entries.length, 1);
    assert.ok(r.warnings[0].includes('JSON'));
    assert.equal(parseWorldbookText('  \n ').entries.length, 0);
    assert.equal(parseWorldbookText('﻿[{"content":"x"}]').entries.length, 1); // BOM
    assert.equal(parseWorldbookText('# 甲\r\n內容\r\n').entries[0].content, '內容'); // CRLF
});
