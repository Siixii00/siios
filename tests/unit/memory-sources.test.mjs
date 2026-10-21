import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MEMORY_SOURCES, MEMORY_SOURCE_IDS, DEFAULT_MEMORY_PREFS, resolveMemoryPrefs } from '../../js/core/memory-sources.js';

function walk(dir, out = []) {
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p);
    }
    return out;
}

test('每個 App 寫入記憶時用的 sourceApp 都在「記憶來源」清單裡（否則設定頁勾不到、檢索會被來源篩選擋掉）', () => {
    const used = new Map();
    for (const f of walk(new URL('../../js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
        const text = readFileSync(f, 'utf8');
        for (const m of text.matchAll(/sourceApp:\s*['"]([a-z0-9_-]+)['"]/g)) used.set(m[1], f);
        for (const m of text.matchAll(/source_app:\s*['"]([a-z0-9_-]+)['"]/g)) used.set(m[1], f);
    }
    const missing = [...used].filter(([id]) => !MEMORY_SOURCE_IDS.includes(id)).map(([id, f]) => `${id}（${f}）`);
    assert.deepEqual(missing, []);
});

test('來源清單：id 不重複、每個都有名稱與圖示', () => {
    assert.equal(new Set(MEMORY_SOURCE_IDS).size, MEMORY_SOURCES.length);
    for (const s of MEMORY_SOURCES) assert.ok(s.id && s.name && s.icon, s.id);
    for (const need of ['chat', 'discord', 'music', 'pomodoro', 'weather']) assert.ok(MEMORY_SOURCE_IDS.includes(need), need);
});

test('resolveMemoryPrefs：沒有存過設定就用預設（全部來源、不含虛構）', () => {
    const p = resolveMemoryPrefs(undefined);
    assert.deepEqual(p.selected_sources, MEMORY_SOURCE_IDS);
    assert.equal(p.include_fiction, false);
    assert.equal(p.memory_level, 'meta');
});

test('resolveMemoryPrefs：尊重使用者關掉的來源，只有「沒看過的新來源」才預設啟用', () => {
    const saved = { selected_sources: ['chat', 'youtube'], known_sources: MEMORY_SOURCE_IDS.filter(id => id !== 'music'), include_fiction: true };
    const p = resolveMemoryPrefs(saved);
    assert.ok(p.selected_sources.includes('music'), '新來源 music 應該自動加入');
    assert.ok(!p.selected_sources.includes('facebook'), '使用者看過並關掉的 facebook 不該被加回');
    assert.equal(p.include_fiction, true);
});
