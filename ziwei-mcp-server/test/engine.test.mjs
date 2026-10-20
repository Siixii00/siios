import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// 排盤引擎是 TypeScript，這裡先用 esbuild 打包成暫存的 ESM 再載入（Worker 部署時 wrangler 也是用 esbuild）
const here = dirname(fileURLToPath(import.meta.url));
let engine;
const golden = JSON.parse(readFileSync(join(here, 'golden.json'), 'utf8'));

before(async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'ziwei-')), 'engine.mjs');
    await build({ entryPoints: [join(here, '../src/lib/ziwei-engine.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'silent' });
    engine = await import(pathToFileURL(out).href);
});

const MAJOR = new Set(['紫微', '天機', '太陽', '武曲', '天同', '廉貞', '天府', '太陰', '貪狼', '巨門', '天相', '天梁', '七殺', '破軍']);
const AUX = ['左輔', '右弼', '文昌', '文曲', '祿存', '擎羊', '陀羅', '天魁', '天鉞', '火星', '鈴星', '地劫', '地空'];

test('黃金資料：40 組生日的命宮、五行局、每宮主星／輔星／天干／大限、本命四化與 iztro 一致', async () => {
    for (const c of golden.cases) {
        const r = await engine.analyzeBirth(c.input, new Date(c.now));
        const ctx = JSON.stringify(c.input);
        assert.equal(r.chart.ming_gong.branch, c.expected.ming_branch, '命宮 ' + ctx);
        assert.equal(r.chart.element, c.expected.element, '五行局 ' + ctx);
        for (const p of r.chart.twelve_palaces) {
            const e = c.expected.palaces[p.branch];
            assert.deepEqual(p.stars.slice().sort(), e.major, `主星 @${p.branch} ${ctx}`);
            assert.deepEqual(p.minor_stars.filter(s => AUX.includes(s)).sort(), e.aux, `輔星 @${p.branch} ${ctx}`);
            assert.equal(p.stem, e.stem, `天干 @${p.branch} ${ctx}`);
            assert.equal(p.decade.from, e.decade_from, `大限 @${p.branch} ${ctx}`);
        }
        for (const k of ['祿', '權', '科', '忌']) assert.equal(r.chart.sihua[k], c.expected.sihua[k], `四化${k} ${ctx}`);
    }
});

test('黃金資料：流年、流月、流日命宮與流年四化與 iztro 一致', async () => {
    for (const c of golden.cases) {
        const r = await engine.analyzeBirth(c.input, new Date(c.now));
        const at = b => r.chart.twelve_palaces.find(p => p.branch === b).name;
        assert.equal(r.runtime.liu_nian_temple, at(c.expected.runtime.year_branch), '流年 ' + c.now);
        assert.equal(r.runtime.liu_yue_temple, at(c.expected.runtime.month_branch), '流月 ' + c.now);
        assert.equal(r.runtime.liu_ri_temple, at(c.expected.runtime.day_branch), '流日 ' + c.now);
        assert.deepEqual(['祿', '權', '科', '忌'].map(k => r.runtime.liu_nian_sihua[k]), c.expected.runtime.year_sihua);
    }
});

test('結構性質：每顆主星恰好出現一次、十二宮各一個、大限涵蓋 12 段連續十年', async () => {
    const r = await engine.analyzeBirth({ birth_date: '1995-06-15', birth_time: '14:30', calendar_type: 'solar', gender: 'female' });
    const all = r.chart.twelve_palaces.flatMap(p => p.stars);
    assert.equal(all.length, 14);
    assert.deepEqual(new Set(all), MAJOR);
    assert.equal(new Set(r.chart.twelve_palaces.map(p => p.name)).size, 12);
    assert.equal(new Set(r.chart.twelve_palaces.map(p => p.branch)).size, 12);
    const starts = r.chart.twelve_palaces.map(p => p.decade.from).sort((a, b) => a - b);
    starts.forEach((s, i) => { if (i) assert.equal(s - starts[i - 1], 10); });
    assert.ok(r.chart.twelve_palaces[0].decade.from === starts[0]);
});

test('不再是假資料：不同生日會得到不同星盤，且摘要是命盤事實而不是吉凶斷語', async () => {
    const a = await engine.analyzeBirth({ birth_date: '1995-06-15', birth_time: '14:30', calendar_type: 'solar', gender: 'female' });
    const b = await engine.analyzeBirth({ birth_date: '1988-11-02', birth_time: '03:10', calendar_type: 'solar', gender: 'male' });
    assert.notDeepEqual(a.chart.twelve_palaces.map(p => p.stars), b.chart.twelve_palaces.map(p => p.stars));
    assert.match(a.fortune_summary.base, /命宮在.*主星.*局.*本命四化/);
    assert.match(a.fortune_summary.daily, /流日命宮在「.+宮」/);
    assert.doesNotMatch(JSON.stringify(a.fortune_summary), /財運平穩|人際關係和諧|適合發展領導能力/); // 舊版假摘要的句子
    assert.deepEqual(a.events, []);
});

test('輸入檢查：格式錯誤與缺少性別會回報清楚的錯誤', async () => {
    await assert.rejects(() => engine.analyzeBirth({ birth_date: '1995/06/15', birth_time: '14:30', calendar_type: 'solar', gender: 'male' }), /出生日期格式/);
    await assert.rejects(() => engine.analyzeBirth({ birth_date: '1995-06-15', birth_time: '2pm', calendar_type: 'solar', gender: 'male' }), /出生時間格式/);
    await assert.rejects(() => engine.analyzeBirth({ birth_date: '1995-06-15', birth_time: '14:30', calendar_type: 'solar', gender: 'other' }), /性別/);
});

test('已知例子：水二局初一紫微在丑、金四局初一在亥', () => {
    // 直接驗證紫微定位的公式（locateZiwei 沒有輸出，這裡用兩個已知排盤驗證結果）
    const known = [{ day: 1, ju: 2, branch: 1 }, { day: 1, ju: 4, branch: 11 }];
    for (const k of known) {
        let x = 0;
        while ((k.day + x) % k.ju !== 0) x++;
        const q = (k.day + x) / k.ju;
        const pos = (((q + 1 + (x % 2 === 0 ? x : -x)) % 12) + 12) % 12;
        assert.equal(pos, k.branch);
    }
});
