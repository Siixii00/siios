import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_START, CATEGORIES, ENTRIES, FAQ, searchHelp } from '../../js/apps/help/help-data.js';

test('說明資料：編號不重複、分類存在、每筆都有名稱與用途、路徑格式正確', () => {
    const ids = ENTRIES.map(e => e.id);
    assert.equal(new Set(ids).size, ids.length);
    const cats = new Set(CATEGORIES.map(c => c.id));
    for (const e of ENTRIES) {
        assert.ok(cats.has(e.cat), e.id + ' 分類不存在');
        assert.ok(e.name && e.what, e.id + ' 缺名稱或用途');
        assert.ok(Array.isArray(e.how) && Array.isArray(e.tips), e.id);
        if (e.path) assert.match(e.path, /^\/[a-z0-9-]+$/, e.id);
    }
    assert.ok(QUICK_START.length >= 4 && FAQ.length >= 5);
});

test('searchHelp：空白回傳全部；關鍵字比對名稱／步驟／提醒／常見問題；多個詞要都符合', () => {
    const all = searchHelp('');
    assert.equal(all.entries.length, ENTRIES.length);
    assert.ok(searchHelp('購物').entries.some(e => e.id === 'taobao'));
    assert.ok(searchHelp('備份').faq.length >= 1);
    assert.ok(searchHelp('三步驟').entries.some(e => e.id === 'mcp-market'));
    assert.ok(searchHelp('蝦皮 momo').entries.some(e => e.id === 'taobao'));
    assert.equal(searchHelp('蝦皮 完全不存在的詞').entries.length, 0);
    assert.equal(searchHelp('zzzzzz').entries.length + searchHelp('zzzzzz').faq.length + searchHelp('zzzzzz').quick.length, 0);
    assert.ok(searchHelp('SXIOS-NOT').entries.length === 0);
});
