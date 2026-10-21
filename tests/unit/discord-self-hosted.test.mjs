import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('Discord 機器人每個人用自己的 Worker：PWA 與 Worker 程式碼裡沒有寫死任何 workers.dev 網址或維護者的資源', () => {
    for (const f of ['scripts/discord-bot-worker.js', 'js/apps/settings/discord-settings.js', 'js/apps/settings/discord-guide.js', 'js/apps/settings/discord-guide-data.js', 'js/apps/settings/discord-user-binding.js', 'js/core/discord-memory-sync.js']) {
        const text = read(f);
        assert.ok(!/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i.test(text.replace(/你的worker\.workers\.dev|your-worker\.workers\.dev|名稱\.你的帳號\.workers\.dev|demo\.example\.workers\.dev/g, '')), f + ' 有寫死的 workers.dev 網址');
        assert.ok(!text.includes('4decb0c1'), f + ' 有維護者的資料庫 ID');
    }
});

test('版控裡的 discord-worker/wrangler.toml 是給別人用的範本：資料庫 ID 是佔位文字、有排程', () => {
    const toml = read('discord-worker/wrangler.toml');
    assert.ok(!toml.includes('4decb0c1'), '範本不能帶維護者的資料庫 ID');
    assert.match(toml, /database_id = "<[^>]+>"/);
    assert.match(toml, /crons = \["\*\/2 \* \* \* \*"\]/);
});

test('Worker 版本的資料表自動建立，新使用者不需要執行任何 SQL', () => {
    const src = read('scripts/discord-bot-worker.js');
    assert.match(src, /CREATE TABLE IF NOT EXISTS messages/);
    assert.match(src, /await ensureSchema\(env\)/);
});
