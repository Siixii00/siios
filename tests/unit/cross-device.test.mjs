import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Encryption } from '../../js/core/cross-device/encryption.js';
import { GitHubSync } from '../../js/core/cross-device/github-sync.js';
import { formatActivityContext } from '../../js/core/activity-format.js';
import { CloudSync } from '../../activity-extension/src/utils/cloud-sync.js';
import { ActivitySync } from '../../activity-extension/src/utils/sync.js';
import { ActivityStorage } from '../../activity-extension/src/utils/storage.js';

// ───── 假的 GitHub Gist 服務（只實作這裡用到的部分）─────
function installFakeGithub(gists) {
    const real = globalThis.fetch;
    const log = [];
    globalThis.fetch = async (url, init = {}) => {
        const u = new URL(String(url));
        const method = init.method || 'GET';
        log.push(method + ' ' + u.pathname);
        const m = /^\/gists\/(\w+)$/.exec(u.pathname);
        if (u.host === 'api.github.com' && m) {
            const gist = gists[m[1]];
            if (!gist) return new Response('{"message":"Not Found"}', { status: 404 });
            if (method === 'PATCH') {
                for (const [name, f] of Object.entries(JSON.parse(init.body).files)) gist.files[name] = { content: f.content };
                return Response.json({ id: m[1] });
            }
            const files = {};
            for (const [name, f] of Object.entries(gist.files)) {
                files[name] = gist.bigFile === name ? { truncated: true, raw_url: 'https://gist.githubusercontent.com/raw/' + name, content: f.content.slice(0, 20) } : { content: f.content };
            }
            return Response.json({ id: m[1], files });
        }
        if (u.host === 'gist.githubusercontent.com') return new Response(Object.values(gists)[0].files['activities.json'].content, { status: 200 });
        return new Response('{}', { status: 404 });
    };
    return { log, restore: () => { globalThis.fetch = real; } };
}

test('PWA 與瀏覽器擴充功能的加密互通：任一邊加密、另一邊都能解開', async () => {
    const key = await Encryption.generateKey();
    const data = { activities: [{ id: 'a1', platform: 'youtube', timestamp: 1 }], uploaded_at: 5 };
    assert.deepEqual(await CloudSync.decrypt(await Encryption.encrypt(data, key), key), data);
    assert.deepEqual(await Encryption.decrypt(await CloudSync.encrypt(data, key), key), data);
    const wrongKey = await Encryption.generateKey();
    const sealed = await Encryption.encrypt(data, key);
    await assert.rejects(() => Encryption.decrypt(sealed, wrongKey));
});

test('擴充功能同步：下載遠端、合併去重、加密上傳；本機清空；PWA 解得開', async () => {
    const key = await Encryption.generateKey();
    const remote = [{ id: 'pwa1', platform: 'twitter', activity_type: 'view', timestamp: 1000 }, { id: 'ext_old', platform: 'youtube', activity_type: 'watch', timestamp: 2000 }];
    const gists = { g1: { files: { 'metadata.json': { content: '{"devices":[]}' }, 'activities.json': { content: JSON.stringify(await Encryption.encrypt({ activities: remote }, key)) } } } };
    const fake = installFakeGithub(gists);
    // 假的 chrome.storage
    let local = [{ id: 'ext_new', platform: 'youtube', activity_type: 'watch', title: '新影片', content: 'x', timestamp: 3000 }, { id: 'ext_old', platform: 'youtube', activity_type: 'watch', timestamp: 2000 }];
    const settings = { enabled: true, github_token: 't', gist_id: 'g1', encryption_key: key, privacy_level: 'detailed' };
    const origGet = ActivityStorage.getSettings, origActs = ActivityStorage.getActivities, origClear = ActivityStorage.clearActivities;
    ActivityStorage.getSettings = async () => settings;
    ActivityStorage.getActivities = async () => local;
    ActivityStorage.clearActivities = async () => { local = []; };
    try {
        const r = await ActivitySync.sync();
        assert.equal(r.success, true, JSON.stringify(r));
        assert.equal(r.synced, 2);
        assert.equal(r.total, 3); // pwa1、ext_old（去重）、ext_new
        assert.deepEqual(local, []);
        const uploaded = await Encryption.decrypt(JSON.parse(gists.g1.files['activities.json'].content), key);
        assert.deepEqual(uploaded.activities.map(a => a.id), ['ext_new', 'ext_old', 'pwa1']); // 最新的在前
        assert.equal(uploaded.activities[0].title, '新影片');
        assert.equal(gists.g1.files['metadata.json'].content, '{"devices":[]}'); // 不動 PWA 的裝置資訊
    } finally {
        ActivityStorage.getSettings = origGet; ActivityStorage.getActivities = origActs; ActivityStorage.clearActivities = origClear;
        fake.restore();
    }
});

test('擴充功能同步：沒設定、沒有新活動、金鑰錯誤的處理', async () => {
    const origGet = ActivityStorage.getSettings, origActs = ActivityStorage.getActivities;
    try {
        ActivityStorage.getSettings = async () => ({ enabled: true });
        assert.equal((await ActivitySync.sync()).success, false);
        const key = await Encryption.generateKey();
        ActivityStorage.getSettings = async () => ({ enabled: true, github_token: 't', gist_id: 'g1', encryption_key: key });
        ActivityStorage.getActivities = async () => [];
        assert.deepEqual(await ActivitySync.sync(), { success: true, synced: 0 });
        // 金鑰錯誤：解不開遠端資料，必須失敗而不是把遠端蓋掉
        const gists = { g1: { files: { 'activities.json': { content: JSON.stringify(await Encryption.encrypt({ activities: [{ id: 'x', timestamp: 1 }] }, await Encryption.generateKey())) } } } };
        const fake = installFakeGithub(gists);
        const before = gists.g1.files['activities.json'].content;
        ActivityStorage.getActivities = async () => [{ id: 'n', platform: 'twitter', activity_type: 'view', timestamp: 5 }];
        const r = await ActivitySync.sync();
        assert.equal(r.success, false);
        assert.equal(gists.g1.files['activities.json'].content, before);
        fake.restore();
    } finally { ActivityStorage.getSettings = origGet; ActivityStorage.getActivities = origActs; }
});

test('ActivitySync.merge：同一個 id 取較新的、最多保留 1000 筆', () => {
    const m = ActivitySync.merge([{ id: 'a', timestamp: 1, v: 'old' }], [{ id: 'a', timestamp: 2, v: 'new' }, { id: 'b', timestamp: 3 }]);
    assert.deepEqual(m.map(x => x.id + ':' + (x.v || '')), ['b:', 'a:new']);
    const many = Array.from({ length: 1200 }, (_, i) => ({ id: 'i' + i, timestamp: i }));
    assert.equal(ActivitySync.merge(many, []).length, 1000);
});

test('GitHubSync.readFile：檔案被截斷（超過 1MB）時改抓完整內容', async () => {
    const gists = { g1: { bigFile: 'activities.json', files: { 'activities.json': { content: '{"encrypted":false,"activities":[{"id":"big"}]}' } } } };
    const fake = installFakeGithub(gists);
    try {
        const gh = new GitHubSync('t');
        const gist = await gh.getGist('g1');
        assert.ok(gist.files['activities.json'].truncated);
        const text = await gh.readFile(gist, 'activities.json');
        assert.equal(JSON.parse(text).activities[0].id, 'big');
        assert.equal(await gh.readFile(gist, 'nope.json'), null);
        // 擴充功能那邊同樣處理
        const viaExt = await CloudSync.downloadFromGitHub('t', 'g1', 'unused-key');
        assert.equal(viaExt.activities[0].id, 'big');
    } finally { fake.restore(); }
});

// ───── 活動紀錄進聊天提示詞 ─────
const NOW = Date.parse('2026-10-21T12:00:00Z');
const acts = [
    { id: '1', platform: 'youtube', activity_type: 'watch', title: '海邊日出 4K', content: '很療癒的影片', timestamp: NOW - 20 * 60000 },
    { id: '2', platform: 'twitter', activity_type: 'like', title: '某則推文', timestamp: NOW - 3 * 3600000 },
    { id: '3', platform: 'youtube', activity_type: 'watch', title: '海邊日出 4K', timestamp: NOW - 25 * 60000 },
    { id: '4', platform: 'facebook', activity_type: 'view', title: '舊的', timestamp: NOW - 40 * 3600000 }
];

test('活動摘要：basic 只有平台與次數，不含標題', () => {
    const t = formatActivityContext(acts, { level: 'basic', now: NOW });
    assert.match(t, /共 3 次/);
    assert.match(t, /YouTube 2 次/);
    assert.ok(!t.includes('海邊日出'));
    assert.ok(!t.includes('舊的'), '超過 24 小時的不算');
});

test('活動摘要：summary 有標題（去重）、detailed 還有內容片段；沒有活動回傳 null', () => {
    const s = formatActivityContext(acts, { level: 'summary', now: NOW });
    assert.equal((s.match(/海邊日出 4K/g) || []).length, 1);
    assert.match(s, /YouTube：觀看「海邊日出 4K」（20 分鐘前）/);
    assert.ok(!s.includes('很療癒'));
    assert.match(formatActivityContext(acts, { level: 'detailed', now: NOW }), /很療癒的影片/);
    assert.equal(formatActivityContext([], { now: NOW }), null);
    assert.equal(formatActivityContext([{ platform: 'x', timestamp: NOW - 99 * 3600000 }], { now: NOW }), null);
});

import { activitiesForAi } from '../../js/core/activity-format.js';
test('活動給 AI 看之前要有授權：開啟活動同步＋允許 AI 存取，而且排除被關掉的平台', () => {
    const list = [{ platform: 'youtube', id: 1 }, { platform: 'Twitter', id: 2 }, { platform: 'facebook', id: 3 }];
    assert.deepEqual(activitiesForAi(list, null), []);
    assert.deepEqual(activitiesForAi(list, { global_enabled: true }), []);
    assert.deepEqual(activitiesForAi(list, { global_enabled: false, ai_access_enabled: true }), []);
    assert.equal(activitiesForAi(list, { global_enabled: true, ai_access_enabled: true }).length, 3);
    const some = activitiesForAi(list, { global_enabled: true, ai_access_enabled: true, platforms: { twitter: { enabled: false }, youtube: { enabled: true } } });
    assert.deepEqual(some.map(a => a.id), [1, 3]);
});

test('活動摘要：認得瀏覽器擴充功能「摘要」等級的格式（標題在 summary.title）', () => {
    const t = formatActivityContext([{ platform: 'youtube', activity_type: 'watch', summary: { title: '擴充功能傳來的標題', count: 1 }, timestamp: NOW - 60000 }], { level: 'summary', now: NOW });
    assert.match(t, /擴充功能傳來的標題/);
});
