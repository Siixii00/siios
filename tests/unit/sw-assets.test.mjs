import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listAppAssets } from '../../scripts/update-sw-assets.mjs';

const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');

test('sw.js 的離線快取清單包含所有 js/、css/ 檔案（新增檔案後請執行 node scripts/update-sw-assets.mjs）', () => {
    const block = /\/\/ <<app-assets[\s\S]*?\/\/ app-assets>>/.exec(sw)?.[0] || '';
    const listed = new Set([...block.matchAll(/'(\/siios\/[^']+)'/g)].map(m => m[1]));
    const missing = listAppAssets(root).filter(f => !listed.has(f));
    assert.deepEqual(missing, []);
});

test('sw.js：外部 CDN 會被快取（idb 函式庫、圖示字型）', () => {
    assert.match(sw, /cdn\.jsdelivr\.net/);
    assert.match(sw, /fonts\.gstatic\.com/);
    assert.match(sw, /idb@8/);
});

// ───── 模擬 Service Worker 執行環境，確認安裝與 CDN 快取行為 ─────
function loadSw() {
    const handlers = {};
    const store = new Map();
    const added = [];
    const cache = {
        addAll: async urls => { urls.forEach(u => added.push(String(u))); },
        add: async req => { added.push(typeof req === 'string' ? req : req.url); },
        put: async (req, res) => { store.set(typeof req === 'string' ? req : req.url, res); },
        match: async req => store.get(typeof req === 'string' ? req : req.url)
    };
    const fetched = [];
    const env = {
        self: { addEventListener: (type, fn) => { handlers[type] = fn; }, skipWaiting: () => {}, clients: { claim: async () => {} } },
        location: { origin: 'http://localhost:8091' },
        caches: { open: async () => cache, keys: async () => [], delete: async () => true, match: async req => cache.match(req) },
        fetch: async req => { fetched.push(req.url); return { ok: true, status: 200, type: 'cors', clone() { return this; } }; },
        Request: class { constructor(url, init) { this.url = url; Object.assign(this, init); } },
        Response: class {}, URL, console: { log() {}, error() {} }, Promise
    };
    // eslint-disable-next-line no-new-func
    new Function(...Object.keys(env), sw)(...Object.values(env));
    return { handlers, store, added, fetched };
}

test('安裝時快取：核心檔案、CDN（idb、圖示字型）與全部 App 程式碼', async () => {
    const { handlers, added } = loadSw();
    let done; handlers.install({ waitUntil: p => { done = p; } });
    await done;
    assert.ok(added.includes('/siios/index.html'));
    assert.ok(added.includes('https://cdn.jsdelivr.net/npm/idb@8/+esm'));
    assert.ok(added.some(u => u.includes('Material+Symbols+Outlined')));
    assert.ok(added.includes('/siios/js/apps/farm/index.js'));
    assert.ok(added.includes('/siios/js/core/discord-memory-sync.js'));
});

test('外部 CDN 請求：快取優先，沒有才上網並存起來；其他網站不攔截', async () => {
    const { handlers, store, fetched } = loadSw();
    const run = url => {
        let p = null;
        handlers.fetch({ request: { url, method: 'GET', mode: 'cors' }, respondWith: x => { p = x; } });
        return p;
    };
    const first = run('https://fonts.gstatic.com/s/materialsymbols/v1/font.woff2');
    assert.ok(first, '應該攔截 CDN 請求');
    await first;
    assert.equal(fetched.length, 1);
    await new Promise(r => setTimeout(r, 0));
    assert.ok(store.has('https://fonts.gstatic.com/s/materialsymbols/v1/font.woff2'));
    await run('https://fonts.gstatic.com/s/materialsymbols/v1/font.woff2'); // 第二次走快取
    assert.equal(fetched.length, 1);
    assert.equal(run('https://example.com/x.js'), null, '非白名單的外部網站不攔截');
});
