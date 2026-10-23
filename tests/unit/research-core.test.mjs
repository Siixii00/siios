import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TRACKED_APPS, isoWeek, buildPayload, validatePayload, cleanApps, isTrackedApp, isValidPid } from '../../js/core/research-core.js';

const PID = '3f2b8c1e-5d7a-4c2e-9b1a-0a1b2c3d4e5f';

function readAllAppSources() {
    const root = new URL('../../js/apps/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    let all = '';
    for (const d of readdirSync(root)) {
        const p = join(root, d);
        if (!statSync(p).isDirectory()) continue;
        for (const f of readdirSync(p)) if (f.endsWith('.js')) all += readFileSync(join(p, f), 'utf8') + '\n';
    }
    return all;
}

test('isoWeek：跨年與週界的算法（ISO 8601）', () => {
    assert.equal(isoWeek(new Date('2026-10-23T12:00:00Z')), '2026-W43');
    assert.equal(isoWeek(new Date('2026-01-01T00:00:00Z')), '2026-W01');
    assert.equal(isoWeek(new Date('2024-12-30T00:00:00Z')), '2025-W01'); // 12/30 屬於隔年第 1 週
    assert.equal(isoWeek(new Date('2021-01-03T00:00:00Z')), '2020-W53');
});

test('buildPayload：只有四個欄位，App 名稱排序、去重、只留白名單內的', () => {
    const p = buildPayload(PID, '2026-W43', ['music', 'chats', 'music', '偷偷塞的內容', 'pub', 'settings']);
    assert.deepEqual(p, { v: 1, pid: PID, week: '2026-W43', apps: ['chats', 'music'] });
    assert.deepEqual(Object.keys(p).sort(), ['apps', 'pid', 'v', 'week']);
});

test('buildPayload：編號或週別格式不對、沒有任何 App 時不產生資料', () => {
    assert.equal(buildPayload('abc', '2026-W43', ['chats']), null);
    assert.equal(buildPayload(PID, '2026-43', ['chats']), null);
    assert.equal(buildPayload(PID, '2026-W43', []), null);
    assert.equal(buildPayload(PID, '2026-W43', ['pub']), null);
});

test('成人限定與系統／隱私頁面不在追蹤名單', () => {
    for (const id of ['pub', 'dating', 'ao3', 'lofter', 'settings', 'passkey', 'api-config', 'appearance', 'touch', 'help', 'activity']) {
        assert.equal(isTrackedApp(id), false, id);
    }
    assert.equal(new Set(TRACKED_APPS).size, TRACKED_APPS.length);
});

test('validatePayload：多一個欄位、白名單外名稱、重複、壞編號都拒絕', () => {
    const ok = { v: 1, pid: PID, week: '2026-W43', apps: ['chats', 'music'] };
    assert.deepEqual(validatePayload(ok), { ok: true });
    assert.equal(validatePayload({ ...ok, note: 'x' }).ok, false);
    assert.equal(validatePayload({ ...ok, apps: ['chats', 'secret-thing'] }).ok, false);
    assert.equal(validatePayload({ ...ok, apps: ['chats', 'chats'] }).ok, false);
    assert.equal(validatePayload({ ...ok, apps: [] }).ok, false);
    assert.equal(validatePayload({ ...ok, pid: 'not-a-uuid' }).ok, false);
    assert.equal(validatePayload({ ...ok, v: 2 }).ok, false);
    assert.equal(validatePayload(null).ok, false);
    assert.equal(validatePayload([ok]).ok, false);
});

test('白名單裡的名稱都是真的 App（避免打錯字），App 開啟處有接上追蹤', () => {
    const sources = readAllAppSources();
    for (const id of TRACKED_APPS) assert.ok(sources.includes(`id: '${id}'`), `找不到 App：${id}`);
    const registry = readFileSync(new URL('../../js/apps/registry.js', import.meta.url), 'utf8');
    assert.ok(registry.includes('trackAppOpen(app.id)'));
});

test('research-config 預設不啟用（沒填網址就不會有任何功能）', async () => {
    const cfg = await import('../../js/core/research-config.js');
    assert.equal(cfg.RESEARCH_ENDPOINT, '');
});

test('cleanApps／isValidPid 基本行為', () => {
    assert.deepEqual(cleanApps(['b', 'chats', 'chats']), ['chats']);
    assert.deepEqual(cleanApps('x'), []);
    assert.equal(isValidPid(PID), true);
});
